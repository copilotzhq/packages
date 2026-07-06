import React from "react";
import {
  Bot,
  ChevronUp,
  Cpu,
  Loader2,
  MessageSquare,
  User,
  Wrench,
} from "lucide-react";
import type {
  AdminMessage,
  AdminMessagePageInfo,
  AdminThreadDetail,
  AdminThreadSummary,
} from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  EmptyState,
  FilterBar,
  InspectorPanel,
  JsonPanel,
  PageHeader,
  ResourceTable,
  StatusBadge,
} from "../../components/patterns";
import { formatNumber } from "../usage/calculations";

const MESSAGE_PAGE_SIZE = 50;

export function threadsModule(): AdminModule {
  return {
    group: "operate",
    icon: MessageSquare,
    id: "threads",
    label: "Threads",
    navItems: [{
      group: "operate",
      icon: MessageSquare,
      id: "threads",
      label: "Threads",
      order: 40,
      routeId: "threads",
    }],
    routes: [
      {
        id: "threads",
        title: "Threads",
        render: (context) => <ThreadsPage context={context} />,
      },
      {
        id: "threads.detail",
        title: "Thread Detail",
        render: (context) => <ThreadDetailPage context={context} />,
      },
    ],
  };
}

function ThreadsPage({ context }: { context: AdminRuntimeContext }) {
  const [search, setSearch] = React.useState("");
  const [threads, setThreads] = React.useState<AdminThreadSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void context.client.listThreads({
      limit: 50,
      namespace: context.scope.namespace || undefined,
      search: search || undefined,
    }).then((next) => {
      if (active) setThreads(next);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load threads");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey, context.scope.namespace, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Threads"
        description="Search conversations, inspect participants, and drill into message timelines, tool calls, reasoning, and metadata."
        badges={isLoading ? [{ label: "Loading" }] : []}
      />
      <FilterBar
        onSearchChange={setSearch}
        searchPlaceholder="Search threads..."
        searchValue={search}
      />
      {error ? (
        <EmptyState title="Unable to load threads" description={error} />
      ) : (
        <ResourceTable
          rows={threads}
          getRowKey={(thread) => thread.threadId}
          onRowClick={(thread) =>
            context.navigate("threads.detail", { threadId: thread.threadId })}
          empty={
            <EmptyState
              icon={MessageSquare}
              title="No threads"
              description="Threads will appear after conversations start flowing."
            />
          }
          columns={[
            {
              id: "thread",
              header: "Thread",
              render: (thread) => (
                <div className="min-w-0">
                  <div className="max-w-xl truncate font-medium">
                    {thread.name || thread.threadId}
                  </div>
                  <div className="max-w-xl truncate text-xs text-muted-foreground">
                    {thread.summary ?? thread.lastMessagePreview ?? "No summary yet"}
                  </div>
                </div>
              ),
            },
            {
              id: "status",
              header: "Status",
              render: (thread) => <StatusBadge status={thread.status} />,
            },
            {
              align: "right",
              id: "participants",
              header: "Participants",
              render: (thread) => formatNumber(thread.participantIds.length),
            },
            {
              align: "right",
              id: "messages",
              header: "Messages",
              render: (thread) => formatNumber(thread.messageCount),
            },
            {
              id: "activity",
              header: "Last activity",
              render: (thread) => formatDateTime(thread.lastActivityAt),
            },
          ]}
        />
      )}
    </div>
  );
}

function ThreadDetailPage({ context }: { context: AdminRuntimeContext }) {
  const threadId = context.route.params?.threadId;
  if (!threadId) {
    return (
      <EmptyState
        title="Thread not selected"
        description="Select a thread from the table to inspect its messages."
      />
    );
  }
  return <ThreadInspector context={context} threadId={threadId} />;
}

function ThreadInspector({
  context,
  threadId,
}: {
  context: AdminRuntimeContext;
  threadId: string;
}) {
  const [thread, setThread] = React.useState<AdminThreadDetail | null>(null);
  const [messages, setMessages] = React.useState<AdminMessage[]>([]);
  const [pageInfo, setPageInfo] = React.useState<AdminMessagePageInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void Promise.all([
      context.client.getThread(threadId),
      context.client.getThreadMessages(threadId, { limit: MESSAGE_PAGE_SIZE }),
    ]).then(([nextThread, page]) => {
      if (!active) return;
      setThread(nextThread);
      setMessages(page.data);
      setPageInfo(page.pageInfo);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load thread");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey, threadId]);

  const loadMore = async () => {
    if (!pageInfo?.hasMoreBefore || !pageInfo.oldestMessageId || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const page = await context.client.getThreadMessages(threadId, {
        before: pageInfo.oldestMessageId,
        limit: MESSAGE_PAGE_SIZE,
      });
      setMessages((current) => [...page.data, ...current]);
      setPageInfo(page.pageInfo);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return <EmptyState icon={Loader2} title="Loading thread" />;
  }
  if (error) {
    return <EmptyState title="Unable to load thread" description={error} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={thread?.name ?? threadId}
        description={thread?.summary ?? "Message timeline and runtime metadata."}
        badges={[
          { label: thread?.status ?? "unknown" },
          { label: `${messages.length}${pageInfo?.hasMoreBefore ? "+" : ""} messages`, variant: "secondary" },
        ]}
        actions={
          <Button
            onClick={() => context.navigate("threads")}
            size="sm"
            type="button"
            variant="outline"
          >
            Back to threads
          </Button>
        }
      />
      <InspectorPanel
        side={<JsonPanel title="Thread JSON" value={thread} minHeight={420} />}
      >
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="text-sm font-medium">Timeline</div>
            {pageInfo?.hasMoreBefore && (
              <Button
                disabled={isLoadingMore}
                onClick={() => void loadMore()}
                size="sm"
                type="button"
                variant="ghost"
              >
                {isLoadingMore
                  ? <Loader2 className="size-3 animate-spin" />
                  : <ChevronUp className="size-3" />}
                Load older
              </Button>
            )}
          </div>
          {messages.length === 0 ? (
            <EmptyState title="No messages" description="This thread has no messages yet." />
          ) : (
            <div className="divide-y">
              {messages.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
      </InspectorPanel>
    </div>
  );
}

function MessageRow({ message }: { message: AdminMessage }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasToolCalls =
    Array.isArray(message.toolCalls) && message.toolCalls.length > 0;
  const hasReasoning = Boolean(message.reasoning);
  const hasMetadata = Boolean(message.metadata && Object.keys(message.metadata).length);

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <SenderIcon senderType={message.senderType} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">
              {message.senderId ?? message.senderUserId ?? message.senderType}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {message.senderType}
            </Badge>
            {message.targetId && (
              <Badge variant="secondary" className="text-[10px]">
                to {message.targetId}
              </Badge>
            )}
            {message.createdAt && (
              <span className="text-muted-foreground">
                {formatDateTime(message.createdAt)}
              </span>
            )}
          </div>
          {message.content && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {message.content}
            </p>
          )}
          {(hasToolCalls || hasReasoning || hasMetadata) && (
            <div className="mt-2">
              <button
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded((value) => !value)}
                type="button"
              >
                {hasToolCalls && <Wrench className="size-3" />}
                {hasReasoning && !hasToolCalls && <Cpu className="size-3" />}
                Details
              </button>
              {expanded && (
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify({
                    ...(hasToolCalls ? { toolCalls: message.toolCalls } : {}),
                    ...(hasReasoning ? { reasoning: message.reasoning } : {}),
                    ...(hasMetadata ? { metadata: message.metadata } : {}),
                  }, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SenderIcon({ senderType }: { senderType: string }) {
  const base = "flex size-7 shrink-0 items-center justify-center rounded-full";
  switch (senderType) {
    case "agent":
      return <div className={cn(base, "bg-primary/10 text-primary")}><Bot className="size-3.5" /></div>;
    case "user":
      return <div className={cn(base, "bg-secondary text-secondary-foreground")}><User className="size-3.5" /></div>;
    case "tool":
      return <div className={cn(base, "bg-muted text-muted-foreground")}><Wrench className="size-3.5" /></div>;
    default:
      return <div className={cn(base, "bg-muted text-muted-foreground")}><Cpu className="size-3.5" /></div>;
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}
