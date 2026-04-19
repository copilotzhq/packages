import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  ChevronUp,
  Loader2,
  User,
  Wrench,
  Cpu,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { fetchThreadDetail, fetchThreadMessages } from "../../adminService";
import type {
  AdminThreadDetail,
  AdminMessage,
  AdminMessagePageInfo,
  ResolvedAdminConfig,
  RequestHeadersProvider,
} from "../../types";

interface ThreadDetailViewProps {
  threadId: string;
  config: ResolvedAdminConfig;
  onBack: () => void;
}

const MESSAGES_PAGE_SIZE = 50;

export const ThreadDetailView: React.FC<ThreadDetailViewProps> = ({
  threadId,
  config,
  onBack,
}) => {
  const [thread, setThread] = useState<AdminThreadDetail | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [pageInfo, setPageInfo] = useState<AdminMessagePageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOptions = {
    baseUrl: config.baseUrl,
    getRequestHeaders: config.getRequestHeaders,
  };

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [threadData, messagesData] = await Promise.all([
        fetchThreadDetail(threadId, fetchOptions),
        fetchThreadMessages(threadId, { limit: MESSAGES_PAGE_SIZE }, fetchOptions),
      ]);
      setThread(threadData);
      setMessages(messagesData.data);
      setPageInfo(messagesData.pageInfo);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load thread"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [threadId, config.baseUrl, config.getRequestHeaders]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!pageInfo?.hasMoreBefore || !pageInfo.oldestMessageId || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const older = await fetchThreadMessages(
        threadId,
        { limit: MESSAGES_PAGE_SIZE, before: pageInfo.oldestMessageId },
        fetchOptions,
      );
      setMessages((prev) => [...older.data, ...prev]);
      setPageInfo(older.pageInfo);
    } catch {
      // silently fail on pagination
    } finally {
      setIsLoadingMore(false);
    }
  }, [threadId, pageInfo, isLoadingMore, config.baseUrl, config.getRequestHeaders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-destructive font-medium">{error.message}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button variant="destructive" onClick={() => void loadInitial()}>
            {config.labels.retry}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold truncate">
              {thread?.name ?? threadId}
            </h2>
            <Badge
              variant={thread?.status === "archived" ? "secondary" : "default"}
            >
              {thread?.status === "archived"
                ? config.labels.statusArchived
                : config.labels.statusActive}
            </Badge>
          </div>
          {thread?.summary && (
            <p className="mt-1 text-sm text-muted-foreground">
              {thread.summary}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {thread?.createdAt && (
              <span>Created {formatDate(thread.createdAt)}</span>
            )}
            {thread?.updatedAt && (
              <span>Updated {formatDate(thread.updatedAt)}</span>
            )}
            {thread?.participants && (
              <span>{thread.participants.length} participants</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Messages ({messages.length}
            {pageInfo?.hasMoreBefore ? "+" : ""})
          </h3>
        </div>

        {/* Load more */}
        {pageInfo?.hasMoreBefore && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <ChevronUp className="mr-2 h-3 w-3" />
              )}
              Load older messages
            </Button>
          </div>
        )}

        {/* Message list */}
        <div className="rounded-lg border bg-card">
          {messages.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No messages in this thread yet.
            </p>
          ) : (
            <div className="divide-y">
              {messages.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function MessageRow({ message }: { message: AdminMessage }) {
  const [expanded, setExpanded] = useState(false);
  const hasToolCalls =
    Array.isArray(message.toolCalls) && message.toolCalls.length > 0;
  const hasReasoning = !!message.reasoning;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <SenderIcon senderType={message.senderType} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium">
              {message.senderId ?? message.senderUserId ?? message.senderType}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {message.senderType}
            </Badge>
            {message.createdAt && (
              <span className="text-muted-foreground">
                {formatTimestamp(message.createdAt)}
              </span>
            )}
          </div>

          {message.content && (
            <p className="mt-1 text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {(hasToolCalls || hasReasoning) && (
            <div className="mt-2 space-y-2">
              {hasToolCalls && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Wrench className="h-3 w-3" />
                  {(message.toolCalls as unknown[]).length} tool call
                  {(message.toolCalls as unknown[]).length > 1 ? "s" : ""}
                </button>
              )}
              {hasReasoning && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Cpu className="h-3 w-3" />
                  Reasoning
                </button>
              )}
              {expanded && (
                <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-auto max-h-60">
                  {JSON.stringify(
                    {
                      ...(hasToolCalls ? { toolCalls: message.toolCalls } : {}),
                      ...(hasReasoning ? { reasoning: message.reasoning } : {}),
                    },
                    null,
                    2,
                  )}
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
  const base =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
  switch (senderType) {
    case "agent":
      return (
        <div className={cn(base, "bg-primary/10 text-primary")}>
          <Bot className="h-3.5 w-3.5" />
        </div>
      );
    case "user":
      return (
        <div className={cn(base, "bg-secondary text-secondary-foreground")}>
          <User className="h-3.5 w-3.5" />
        </div>
      );
    case "tool":
      return (
        <div className={cn(base, "bg-muted text-muted-foreground")}>
          <Wrench className="h-3.5 w-3.5" />
        </div>
      );
    default:
      return (
        <div className={cn(base, "bg-muted text-muted-foreground")}>
          <Cpu className="h-3.5 w-3.5" />
        </div>
      );
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
