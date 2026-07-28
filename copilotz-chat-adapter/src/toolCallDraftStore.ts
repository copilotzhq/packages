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

export class ToolCallDraftStore implements ToolCallDraftSource {
  readonly #snapshots = new Map<string, ToolCallDraftSnapshot>();
  readonly #lastSequenceById = new Map<string, number>();
  readonly #listeners = new Map<string, Set<() => void>>();

  getSnapshot = (draftId: string): ToolCallDraftSnapshot | undefined =>
    this.#snapshots.get(draftId);

  subscribe = (draftId: string, listener: () => void): (() => void) => {
    const listeners = this.#listeners.get(draftId) ?? new Set<() => void>();
    listeners.add(listener);
    this.#listeners.set(draftId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(draftId);
    };
  };

  apply(delta: ParsedToolCallDelta): ToolCallDraftApplyResult {
    const lastSequence = this.#lastSequenceById.get(delta.draftId);
    if (lastSequence !== undefined && delta.sequence <= lastSequence) {
      return 'ignored';
    }
    this.#lastSequenceById.set(delta.draftId, delta.sequence);

    if (delta.phase === 'discarded') {
      const existed = this.#snapshots.delete(delta.draftId);
      if (existed) this.#notify(delta.draftId);
      return existed ? 'discarded' : 'ignored';
    }

    const current = this.#snapshots.get(delta.draftId);
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
    this.#snapshots.set(delta.draftId, next);
    this.#notify(delta.draftId);

    if (!current) return 'created';
    return delta.phase === 'complete' ? 'completed' : 'updated';
  }

  clear(): void {
    const ids = [...this.#snapshots.keys()];
    this.#snapshots.clear();
    this.#lastSequenceById.clear();
    for (const id of ids) this.#notify(id);
  }

  #notify(draftId: string): void {
    for (const listener of this.#listeners.get(draftId) ?? []) listener();
  }
}
