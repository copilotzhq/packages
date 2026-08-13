import type {
  ToolCallDraftSnapshot,
  ToolCallDraftSource,
} from '@copilotz/chat-ui';
import type { ParsedToolCallDelta } from './toolActivity.ts';

export type ToolCallDraftApplyResult =
  | 'created'
  | 'updated'
  | 'completed'
  | 'discarded'
  | 'ignored';

export type ToolCallDraftStore = ToolCallDraftSource & Readonly<{
  apply(delta: ParsedToolCallDelta): ToolCallDraftApplyResult;
  clear(): void;
}>;

export const createToolCallDraftStore = (): ToolCallDraftStore => {
  const snapshots = new Map<string, ToolCallDraftSnapshot>();
  const lastSequenceById = new Map<string, number>();
  const listenersById = new Map<string, Set<() => void>>();
  const notify = (draftId: string): void => {
    for (const listener of listenersById.get(draftId) ?? []) listener();
  };

  const store: ToolCallDraftStore = {
    getSnapshot: (draftId) => snapshots.get(draftId),
    subscribe(draftId, listener) {
      const listeners = listenersById.get(draftId) ?? new Set<() => void>();
      listeners.add(listener);
      listenersById.set(draftId, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) listenersById.delete(draftId);
      };
    },
    apply(delta) {
    const lastSequence = lastSequenceById.get(delta.draftId);
    if (lastSequence !== undefined && delta.sequence <= lastSequence) {
      return 'ignored';
    }
    lastSequenceById.set(delta.draftId, delta.sequence);

    if (delta.phase === 'discarded') {
      const existed = snapshots.delete(delta.draftId);
      if (existed) notify(delta.draftId);
      return existed ? 'discarded' : 'ignored';
    }

    const current = snapshots.get(delta.draftId);
    if (delta.phase !== 'start' && !current) return 'ignored';

    const next: ToolCallDraftSnapshot = current
      ? {
        ...current,
        sequence: delta.sequence,
        rawInput: current.rawInput + delta.delta,
        phase: delta.phase === 'complete' ? 'complete' : current.phase,
        ...(delta.toolCallId ? { toolCallId: delta.toolCallId } : {}),
      }
      : {
        llmAttemptId: delta.llmAttemptId,
        draftId: delta.draftId,
        callIndex: delta.callIndex,
        sequence: delta.sequence,
        toolName: delta.toolName,
        rawInput: delta.delta,
        phase: delta.phase === 'complete' ? 'complete' : 'streaming',
        ...(delta.toolCallId ? { toolCallId: delta.toolCallId } : {}),
      };
    snapshots.set(delta.draftId, next);
    notify(delta.draftId);

    if (!current) return 'created';
    return delta.phase === 'complete' ? 'completed' : 'updated';
    },
    clear() {
      const ids = [...snapshots.keys()];
      snapshots.clear();
      lastSequenceById.clear();
      for (const id of ids) notify(id);
    },
  };
  return Object.freeze(store);
};
