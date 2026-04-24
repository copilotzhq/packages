import React, { memo, useEffect, useMemo, useState } from 'react';
import type {
  ActivityDisplayMode,
  AssistantActivityState,
  ChatConfig,
  ToolCall,
} from '../../types/chatTypes';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Brain, ChevronDown, ChevronRight, LoaderCircle, Sparkles, Wrench } from 'lucide-react';

type ActivityLabels = ChatConfig['labels'];

interface AssistantActivityProps {
  activity?: AssistantActivityState;
  displayMode: ActivityDisplayMode;
  labels?: ActivityLabels;
}

const ROOT_SPACING_CLASS = 'mb-4 w-full max-w-full min-w-0';
const ACTION_SLOT_CLASS = 'inline-flex h-9 min-w-[132px] items-center justify-end px-2 text-xs';

const interpolate = (
  template: string,
  replacements: Record<string, string | number | undefined>,
): string => (
  Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value ?? '')),
    template,
  )
);

const resolveSummaryLabel = (
  activity: AssistantActivityState,
  labels?: ActivityLabels,
): string => {
  const summary = activity.summary;

  if (summary.kind === 'using_tools') {
    if (summary.toolName) {
      return interpolate(labels?.activityToolRunning || 'Using {{tool}}...', {
        tool: summary.toolName,
      });
    }
    if (typeof summary.toolCount === 'number' && summary.toolCount > 1) {
      return interpolate(labels?.activityMultipleTools || 'Using {{count}} tools...', {
        count: summary.toolCount,
      });
    }
    return labels?.activityUsingTools || 'Using tools...';
  }

  if (summary.kind === 'preparing_answer') {
    return labels?.activityPreparingAnswer || 'Preparing answer...';
  }

  if (summary.kind === 'working') {
    return labels?.activityWorking || 'Working...';
  }

  return labels?.activityThinking || 'Thinking...';
};

const getStatusBadge = (toolCall: ToolCall) => {
  if (toolCall.status === 'failed') {
    return <Badge variant="destructive">failed</Badge>;
  }

  if (toolCall.status === 'completed') {
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      >
        done
      </Badge>
    );
  }

  if (toolCall.status === 'running') {
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary">
        running
      </Badge>
    );
  }

  return <Badge variant="secondary">pending</Badge>;
};

const ActivitySummaryCard = memo(function ActivitySummaryCard({
  activity,
  labels,
}: {
  activity: AssistantActivityState;
  labels?: ActivityLabels;
}) {
  const label = useMemo(() => resolveSummaryLabel(activity, labels), [activity, labels]);
  const isActive = activity.isActive;

  const icon = activity.summary.kind === 'using_tools'
    ? <Wrench className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
    : activity.summary.kind === 'preparing_answer'
      ? <Sparkles className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
      : <Brain className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
        isActive
          ? 'border-primary/30 bg-primary/5 text-foreground'
          : 'border-border/60 bg-muted/20 text-muted-foreground',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isActive && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary" />}
    </div>
  );
});

const ActivitySummaryRow = memo(function ActivitySummaryRow({
  activity,
  labels,
  hasDetails,
  open,
}: {
  activity: AssistantActivityState;
  labels?: ActivityLabels;
  hasDetails: boolean;
  open: boolean;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <div className="min-w-0">
        <ActivitySummaryCard activity={activity} labels={labels} />
      </div>
      {hasDetails ? (
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className={cn(ACTION_SLOT_CLASS, 'shrink-0 text-muted-foreground')}>
            {open ? (labels?.activityHideDetails || 'Hide details') : (labels?.activityShowDetails || 'Show details')}
            {open ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
      ) : (
        <div aria-hidden="true" className={cn(ACTION_SLOT_CLASS, 'pointer-events-none invisible shrink-0')}>
          {labels?.activityShowDetails || 'Show details'}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
});

const ActivityDetails = memo(function ActivityDetails({
  activity,
}: {
  activity: AssistantActivityState;
}) {
  return (
    <div className="space-y-3 pt-3">
      {activity.reasoning && (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reasoning</div>
          <div className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {activity.reasoning}
          </div>
        </div>
      )}
      {Array.isArray(activity.toolCalls) && activity.toolCalls.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tools</div>
          {activity.toolCalls.map((toolCall) => (
            <Card key={toolCall.id} className="border-border/60 bg-background/70">
              <CardContent className="space-y-2 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{toolCall.name}</div>
                  </div>
                  {getStatusBadge(toolCall)}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Args
                    </div>
                    <pre className="overflow-x-auto rounded-md bg-muted/70 p-2 text-xs text-muted-foreground">
                      {JSON.stringify(toolCall.arguments, null, 2)}
                    </pre>
                  </div>
                  {typeof toolCall.result !== 'undefined' && (
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Result
                      </div>
                      <pre className="overflow-x-auto rounded-md bg-muted/70 p-2 text-xs text-muted-foreground">
                        {JSON.stringify(toolCall.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
});

const ActivitySkeleton = memo(function ActivitySkeleton() {
  return (
    <div className={ROOT_SPACING_CLASS}>
      <div className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary/80 animate-pulse" />
          <span className="inline-block h-2 w-2 rounded-full bg-primary/60 animate-pulse [animation-delay:120ms]" />
          <span className="inline-block h-2 w-2 rounded-full bg-primary/40 animate-pulse [animation-delay:240ms]" />
        </div>
        <div className="h-3 w-28 rounded-full bg-muted animate-pulse" />
      </div>
    </div>
  );
});

export const AssistantActivity = memo(function AssistantActivity({
  activity,
  displayMode,
  labels,
}: AssistantActivityProps) {
  if (!activity) return null;

  if (displayMode === 'hidden') {
    return activity.isActive ? <ActivitySkeleton /> : null;
  }

  if (displayMode === 'summary') {
    if (!activity.isActive && activity.isComplete) {
      return null;
    }

    return (
      <div className={ROOT_SPACING_CLASS}>
        <ActivitySummaryCard activity={activity} labels={labels} />
      </div>
    );
  }

  const hasDetails = Boolean(activity.reasoning) || Boolean(activity.toolCalls?.length);
  const [open, setOpen] = useState(activity.isActive && hasDetails);

  useEffect(() => {
    if (activity.isActive && hasDetails) {
      setOpen(true);
    }
  }, [activity.isActive, hasDetails]);

  return (
    <Collapsible
      open={hasDetails ? open : false}
      onOpenChange={hasDetails ? setOpen : undefined}
      className={ROOT_SPACING_CLASS}
    >
      <div className="space-y-2">
        <ActivitySummaryRow
          activity={activity}
          labels={labels}
          hasDetails={hasDetails}
          open={open}
        />
        {hasDetails && (
          <CollapsibleContent className="w-full overflow-hidden rounded-lg border border-border/60 bg-muted/10 px-3">
            <ActivityDetails activity={activity} />
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
});
