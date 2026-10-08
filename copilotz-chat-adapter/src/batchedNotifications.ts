import type { ToolCallDraftSource } from '@copilotz/chat-ui';

/**
 * Delivers store notifications to React at most once per task.
 *
 * The controller applies streamed frames as they arrive and notifies its
 * subscribers synchronously, which non-React consumers rely on. When several
 * tool calls stream at once, frames arrive in dense bursts. Delivered one by
 * one, each schedules a synchronous React update, and updates that land
 * between a commit and its passive effects count as nested; past 50 React
 * throws "Maximum update depth exceeded" (#185) and the chat stops updating.
 *
 * Coalescing to one notification per task lets React render the whole burst
 * in one commit. Snapshots are still read synchronously, so React always
 * renders the latest state; only the wake-up is deferred.
 */
type Subscribe = (listener: () => void) => () => void;
type Schedule = (run: () => void) => () => void;

const nextTask: Schedule = (run) => {
  const timer = setTimeout(run, 0);
  return () => clearTimeout(timer);
};

export function batchSubscription(
  subscribe: Subscribe,
  onError: (error: unknown) => void,
  schedule: Schedule = nextTask
): Subscribe {
  return (listener) => {
    let cancel: (() => void) | undefined;
    const unsubscribe = subscribe(() => {
      if (cancel) return;
      cancel = schedule(() => {
        cancel = undefined;
        try {
          listener();
        } catch (error) {
          // A deferred render failure would otherwise escape as an uncaught
          // error; report it through the controller like a synchronous one.
          onError(error);
        }
      });
    });
    return () => {
      cancel?.();
      cancel = undefined;
      unsubscribe();
    };
  };
}

/** The same per-task delivery for each streamed tool-call draft. */
export function batchDraftSource(
  source: ToolCallDraftSource,
  onError: (error: unknown) => void,
  schedule: Schedule = nextTask
): ToolCallDraftSource {
  return {
    getSnapshot: source.getSnapshot,
    subscribe: (draftId, listener) =>
      batchSubscription(
        (notify) => source.subscribe(draftId, notify),
        onError,
        schedule
      )(listener)
  };
}
