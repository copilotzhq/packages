import React, { memo, useCallback, useState, useSyncExternalStore } from 'react';
import type {
  AgentOption,
  AssistantActivityBlock,
  AssistantActivityItem,
  ChatConfig,
  ToolCallDraftSource,
  ToolRendererMap,
} from '../../types/chatTypes';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { CheckCircle2, ChevronDown, ChevronRight, CircleAlert, LoaderCircle, Wrench, Brain, Sparkles } from 'lucide-react';
import { builtInToolRenderers } from './AskToolRenderer';

type ActivityLabels = ChatConfig['labels'];

export const resolveToolRenderer = (
  toolId: string | undefined,
  toolRenderers: ToolRendererMap | undefined,
) => toolId ? toolRenderers?.[toolId] ?? builtInToolRenderers[toolId] : undefined;

export const formatToolDetailValue = (value: unknown): string =>
  JSON.stringify(value, null, 2) ?? String(value);

export const resolveActivityStableId = (
  item: AssistantActivityItem,
): string => item.details?.toolCallDraftId
  ? `tool-draft:${item.details.toolCallDraftId}`
  : item.id;

interface AssistantActivityProps {
  activity?: AssistantActivityBlock;
  showActivity?: boolean;
  showActivityDetails?: boolean;
  labels?: ActivityLabels;
  toolRenderers?: ToolRendererMap;
  toolCallDraftSource?: ToolCallDraftSource;
  agents?: readonly AgentOption[];
}

const ROOT_CLASS = 'mb-4 w-full max-w-full min-w-0';

const interpolate = (
  template: string,
  replacements: Record<string, string | number | undefined>,
): string => Object.entries(replacements).reduce(
  (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value ?? '')),
  template,
);

const hasActiveItem = (activity: AssistantActivityBlock): boolean =>
  activity.items.some((item) => item.status === 'active');

const toolIdForItem = (item: AssistantActivityItem): string | undefined =>
  item.toolId || item.details?.toolCall?.toolId || item.toolName || item.details?.toolCall?.name;

const hasInlineToolPresentation = (item: AssistantActivityItem): boolean =>
  item.kind === 'tool' && toolIdForItem(item) === 'ask';

const hasDetails = (item: AssistantActivityItem): boolean =>
  Boolean(item.details?.reasoning || item.details?.toolCall || item.details?.toolCallDraftId || item.details?.result !== undefined || item.details?.toolOutput || item.details?.error);

const resolveActivityLabel = (
  item: AssistantActivityItem,
  labels?: ActivityLabels,
): string => {
  const tool = item.toolName || item.details?.toolCall?.name || 'tool';

  if (item.kind === 'tool') {
    if (item.status === 'failed') {
      return interpolate(labels?.activityToolFailed || '{{tool}} failed', { tool });
    }
    if (item.status === 'complete') {
      return interpolate(labels?.activityToolComplete || 'Used {{tool}}', { tool });
    }
    return interpolate(labels?.activityToolActive || 'Using {{tool}}', { tool });
  }

  if (item.kind === 'answering') {
    return item.status === 'active'
      ? (labels?.activityAnsweringActive || 'Preparing response')
      : (labels?.activityAnsweringComplete || 'Prepared response');
  }

  return item.status === 'active'
    ? (labels?.activityThinkingActive || 'Thinking')
    : (labels?.activityThinkingComplete || 'Thought through request');
};

const ActivityIcon = ({ item }: { item: AssistantActivityItem }) => {
  if (item.status === 'active') return <LoaderCircle className="h-4 w-4 animate-spin text-primary" />;
  if (item.status === 'failed') return <CircleAlert className="h-4 w-4 text-destructive" />;
  if (item.status === 'complete') return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
  if (item.kind === 'tool') return <Wrench className="h-4 w-4 text-muted-foreground" />;
  if (item.kind === 'answering') return <Sparkles className="h-4 w-4 text-muted-foreground" />;
  if (item.kind === 'thinking') return <Brain className="h-4 w-4 text-muted-foreground" />;
  return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
};

const ActivityDetails = memo(function ActivityDetails({
  item,
  toolRenderers,
  toolCallDraftSource,
  agents,
  inline = false,
}: {
  item: AssistantActivityItem;
  toolRenderers?: ToolRendererMap;
  toolCallDraftSource?: ToolCallDraftSource;
  agents?: readonly AgentOption[];
  inline?: boolean;
}) {
  const toolCall = item.details?.toolCall;
  const draftId = item.details?.toolCallDraftId;
  const subscribe = useCallback(
    (listener: () => void) => (
      draftId && toolCallDraftSource
        ? toolCallDraftSource.subscribe(draftId, listener)
        : () => {}
    ),
    [draftId, toolCallDraftSource],
  );
  const getSnapshot = useCallback(
    () => (
      draftId && toolCallDraftSource
        ? toolCallDraftSource.getSnapshot(draftId)
        : undefined
    ),
    [draftId, toolCallDraftSource],
  );
  const draft = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toolId = toolIdForItem(item);
  const toolName = item.toolName || toolCall?.name;
  const ToolRenderer = resolveToolRenderer(toolId, toolRenderers);
  const status = toolCall?.status ?? (item.status === 'failed'
    ? 'failed'
    : item.status === 'complete'
      ? 'completed'
      : 'streaming');

  if (ToolRenderer && toolId && toolName) {
    return (
      <div className={inline ? 'pb-1 pt-1' : 'pb-1 pl-7 pt-2'}>
        <ToolRenderer
          toolId={toolId}
          toolName={toolName}
          toolCall={toolCall}
          draft={draft}
          status={status}
          result={item.details?.result ?? toolCall?.result}
          output={item.details?.toolOutput}
          error={item.details?.error}
          agents={agents}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-1 pl-7 pt-2 text-sm text-muted-foreground">
      {item.details?.reasoning && (
        <div className="whitespace-pre-wrap break-words leading-6">
          {item.details.reasoning}
        </div>
      )}
      {item.details?.error && (
        <div className="text-destructive">{item.details.error}</div>
      )}
      {toolCall && (
        <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 text-xs">
          {formatToolDetailValue(toolCall.arguments)}
        </pre>
      )}
      {!toolCall && draft?.rawInput && (
        <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 text-xs">
          {draft.rawInput}
        </pre>
      )}
      {item.details?.result !== undefined && (
        <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 text-xs">
          {formatToolDetailValue(item.details.result)}
        </pre>
      )}
      {item.details?.result === undefined && item.details?.toolOutput && (
        <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 text-xs">
          {formatToolDetailValue(Object.fromEntries(
            Object.entries(item.details.toolOutput.channels).map(
              ([channel, state]) => [channel, state.value],
            ),
          ))}
        </pre>
      )}
    </div>
  );
});

const ActivitySkeleton = memo(function ActivitySkeleton() {
  return (
    <div className={ROOT_CLASS}>
      <div className="flex w-full min-w-0 items-center gap-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary/80" />
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary/60 [animation-delay:120ms]" />
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary/40 [animation-delay:240ms]" />
        </div>
        <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
});

const ActivityTimeline = memo(function ActivityTimeline({
  activity,
  showActivityDetails,
  labels,
  toolRenderers,
  toolCallDraftSource,
  agents,
}: {
  activity: AssistantActivityBlock;
  showActivityDetails: boolean;
  labels?: ActivityLabels;
  toolRenderers?: ToolRendererMap;
  toolCallDraftSource?: ToolCallDraftSource;
  agents?: readonly AgentOption[];
}) {
  const [openById, setOpenById] = useState<Record<string, boolean>>({});

  return (
    <div className={ROOT_CLASS}>
      <div className="space-y-1">
        {activity.items.map((item, index) => {
          const stableId = resolveActivityStableId(item);
          if (hasInlineToolPresentation(item)) {
            return (
              <ActivityDetails
                key={stableId}
                item={item}
                toolRenderers={toolRenderers}
                toolCallDraftSource={toolCallDraftSource}
                agents={agents}
                inline
              />
            );
          }
          const detailsAvailable = showActivityDetails && hasDetails(item);
          const open = Boolean(openById[stableId]);
          const isLast = index === activity.items.length - 1;

          return (
            <div key={stableId} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
              {!isLast && <div className="absolute left-2 top-5 h-[calc(100%-0.25rem)] w-px bg-border" />}
              <div className="relative z-10 mt-1 flex h-4 w-4 items-center justify-center bg-background">
                <ActivityIcon item={item} />
              </div>
              <div className="min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!detailsAvailable}
                  onClick={() => setOpenById((prev) => ({ ...prev, [stableId]: !prev[stableId] }))}
                  className={cn(
                    'h-auto min-h-6 w-full justify-start gap-1 px-0 py-0 text-left text-sm font-normal text-muted-foreground hover:bg-transparent',
                    item.status === 'active' && 'text-foreground',
                    !detailsAvailable && 'pointer-events-none opacity-100',
                  )}
                >
                  <span className="min-w-0 truncate">{resolveActivityLabel(item, labels)}</span>
                  {detailsAvailable && (
                    open
                      ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
                </Button>
                {detailsAvailable && open && (
                  <ActivityDetails
                    item={item}
                    toolRenderers={toolRenderers}
                    toolCallDraftSource={toolCallDraftSource}
                    agents={agents}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export const AssistantActivity = memo(function AssistantActivity({
  activity,
  showActivity = true,
  showActivityDetails = true,
  labels,
  toolRenderers,
  toolCallDraftSource,
  agents,
}: AssistantActivityProps) {
  if (!activity || activity.items.length === 0) return null;
  if (!showActivity) {
    const publicItems = activity.items.filter(hasInlineToolPresentation);
    if (publicItems.length > 0) {
      return (
        <ActivityTimeline
          activity={{ items: publicItems }}
          showActivityDetails
          labels={labels}
          toolRenderers={toolRenderers}
          toolCallDraftSource={toolCallDraftSource}
          agents={agents}
        />
      );
    }
    return hasActiveItem(activity) ? <ActivitySkeleton /> : null;
  }
  return (
    <ActivityTimeline
      activity={activity}
      showActivityDetails={showActivityDetails}
      labels={labels}
      toolRenderers={toolRenderers}
      toolCallDraftSource={toolCallDraftSource}
      agents={agents}
    />
  );
});
