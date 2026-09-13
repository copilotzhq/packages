import { createHistoryReconciliation } from './historyReconciliation.ts';
import { createObservationSupervisor } from './observationSupervisor.ts';
import { isTransientRequestError, retryRead } from './requestRetry.ts';
import { createObservationBootstrap } from './observationBootstrap.ts';
import type { CoreClient } from '@copilotz/copilotz/core/client';
import type { ObservationFrame } from '@copilotz/copilotz/client';
import type {
  AgentOption,
  ChatMessage,
  ChatThread,
  ChatUserContext,
  MediaAttachment
} from '@copilotz/chat-ui';
import { uploadAttachments } from './attachments.ts';
import { createHistoryReader } from './history.ts';
import { reconcileThreadMessages } from './messageReconciliation.ts';
import { mergePersistedToolResults } from './toolActivity.ts';
import { createToolCallDraftStore } from './toolCallDraftStore.ts';
import {
  type ChatProjection,
  emptyProjection,
  projectFrame,
  projectHistoryMessages
} from './projection.ts';
import type {
  EventInterceptor,
  RunErrorInterceptor,
  SpecialChatState
} from './specialState.ts';

export type ControllerOptions = {
  userId: string | null;
  userName?: string;
  userAvatar?: string;
  assistantName?: string;
  agentOptions?: AgentOption[];
  participants?: string[] | null;
  preferredAgentName?: string | null;
  targetAgentName?: string | null;
  initialContext?: ChatUserContext;
  defaultThreadName?: string;
  bootstrap?: {
    initialMessage?: string;
  };
  onToolOutput?: (value: Record<string, unknown>) => void;
  eventInterceptor?: EventInterceptor;
  runErrorInterceptor?: RunErrorInterceptor;
};
export type ChatSnapshot = {
  messages: ChatMessage[];
  threads: ChatThread[];
  currentThreadId: string | null;
  isMessagesLoading: boolean;
  isLoadingOlderMessages: boolean;
  isStreaming: boolean;
  isStopping: boolean;
  isRecoveringStream: boolean;
  messagePageInfo: { hasMore: boolean; next?: string };
  specialState: SpecialChatState | null;
  error: unknown;
};

const MAX_FRAME_RECOVERY_ATTEMPTS = 3;

/** A failed frame can be recovered without cancelling durable work. */
class RecoverableFrameError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super('The live conversation stream is being resynchronized.', { cause });
    this.cause = cause;
    Object.defineProperty(this, 'name', { value: 'RecoverableFrameError' });
  }
}

/** Repeated poison frames detach observation until the user requests recovery. */
class FrameRecoveryExhaustedError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(
      'The conversation stream could not be applied repeatedly. Retry to resynchronize.',
      { cause }
    );
    this.cause = cause;
    Object.defineProperty(this, 'name', {
      value: 'FrameRecoveryExhaustedError'
    });
  }
}

/** Owns connection lifetime independently of React. */
export function createChatController(
  core: CoreClient,
  initialOptions: ControllerOptions
) {
  let options = initialOptions;
  let snapshot: ChatSnapshot = {
    messages: [],
    threads: [],
    currentThreadId: null,
    isMessagesLoading: false,
    isLoadingOlderMessages: false,
    isStreaming: false,
    isStopping: false,
    isRecoveringStream: false,
    messagePageInfo: { hasMore: false },
    specialState: null,
    error: null
  };
  let projection = emptyProjection();
  let epoch = 0;
  let draftName: string | undefined;
  let disposed = false;
  const lifetime = new AbortController();
  let historyAbort = new AbortController();
  let observation: ReturnType<typeof createObservationSupervisor> | undefined;
  let observationToken = 0;
  let reconciliation:
    | ReturnType<typeof createHistoryReconciliation>
    | undefined;
  let checkpoint: string | undefined;
  let frameRecoveryFailures = 0;
  let frameRecoveryNotice: unknown;
  const stoppingOperations = new Map<string, number>();
  const preparingByOperation = new Map<string, string>();
  const submissions = new Set<{
    controller: AbortController;
    operationId?: string;
    stopRequested: boolean;
    generation: number;
  }>();
  let projectionTask = Promise.resolve();
  const serialize = <T>(work: () => T | Promise<T>): Promise<T> => {
    const next = projectionTask.then(work);
    projectionTask = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
  const listeners = new Set<() => void>();
  const history = createHistoryReader();
  const reportedTools = new Set<string>();
  let notifying = false;
  const specialStateFor = (error: unknown): SpecialChatState | null => {
    try {
      return options.runErrorInterceptor?.(error) ?? null;
    } catch {
      return null;
    }
  };
  const subscriberError = (error: unknown) => {
    snapshot = {
      ...snapshot,
      error,
      specialState: specialStateFor(error),
      isRecoveringStream: false
    };
  };
  const publish = (patch: Partial<ChatSnapshot>) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...patch };
    if (notifying) return;
    notifying = true;
    try {
      const failed: unknown[] = [];
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          listeners.delete(listener);
          failed.push(error);
        }
      }
      if (failed.length === 0) return;
      subscriberError(failed[0]);
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          listeners.delete(listener);
        }
      }
    } finally {
      notifying = false;
    }
  };
  const report = (error: unknown) => {
    publish({
      error,
      specialState: specialStateFor(error),
      isRecoveringStream: false
    });
  };
  const reportSubscriberFailure = (error: unknown) => {
    subscriberError(error);
    publish({});
  };
  const toolCallDraftSource = createToolCallDraftStore({
    onSubscriberError: reportSubscriberFailure
  });
  const projectHistory = (
    page: Parameters<typeof history.project>[0],
    signal = historyAbort.signal
  ) =>
    history.project(page, {
      signal,
      senderOptions: {
        agents: options.agentOptions,
        user: options.userId
          ? {
              id: options.userId,
              name: options.userName,
              avatarUrl: options.userAvatar
            }
          : null,
        assistantName: options.assistantName
      }
    });
  const mergeHistory = (
    current: ChatProjection,
    result: Awaited<ReturnType<typeof projectHistory>>
  ) =>
    projectHistoryMessages(
      current,
      mergePersistedToolResults(
        reconcileThreadMessages(current.messages, result.viewMessages).messages,
        result.toolResultUpdates
      )
    );
  const preparingForOperation = (operationId?: string) => {
    const id = operationId && preparingByOperation.get(operationId);
    return id;
  };
  const removePreparing = (operationId?: string) => {
    const id = preparingForOperation(operationId);
    if (!id) return undefined;
    if (operationId) preparingByOperation.delete(operationId);
    projection = {
      ...projection,
      messages: projection.messages.filter((message) => message.id !== id)
    };
    return id;
  };
  const configureReconciliation = (
    id: string,
    generation: number,
    signal: AbortSignal
  ) =>
    createHistoryReconciliation({
      signal,
      load: async () =>
        projectHistory(
          await core.threads.messages(
            id,
            { order: 'desc', limit: 50 },
            { signal }
          ),
          signal
        ),
      apply: (result) =>
        serialize(() => {
          if (disposed || generation !== epoch || signal.aborted) return;
          projection = mergeHistory(projection, result);
          for (const tool of result.toolResultUpdates) {
            const key = `${tool.toolExecutionId}:${tool.endTime}`;
            if (
              !reportedTools.has(key) &&
              tool.result &&
              typeof tool.result === 'object'
            ) {
              try {
                options.onToolOutput?.(tool.result as Record<string, unknown>);
              } catch (error) {
                reportSubscriberFailure(error);
              }
              reportedTools.add(key);
            }
          }
          publish({ messages: bootstrap.visible(projection).messages });
        }),
      onError: (error) => {
        if (generation === epoch && !disposed) report(error);
      },
      onRecovered: (error) => {
        if (generation === epoch && snapshot.error === error) {
          publish({ error: null, specialState: null });
        }
      }
    });
  const refreshThreads = async () => {
    const page = await core.threads.list(
      { order: 'desc' },
      { signal: lifetime.signal }
    );
    publish({
      threads: page.data.map((thread) => ({
        id: thread.id,
        title: thread.name ?? options.defaultThreadName ?? 'Conversation',
        createdAt: Date.parse(thread.createdAt),
        updatedAt: Date.parse(thread.updatedAt),
        messageCount: 0,
        isArchived: thread.status === 'archived',
        metadata: thread.metadata,
        tags: (
          thread.metadata.public as { tags?: ChatThread['tags'] } | undefined
        )?.tags
      }))
    });
  };
  const hasStoppingForGeneration = (generation: number) =>
    [...stoppingOperations.values()].some((value) => value === generation) ||
    [...submissions].some(
      (submission) =>
        submission.generation === generation &&
        submission.stopRequested &&
        !submission.operationId
    );
  const confirmOperation = (
    operationId: string,
    generation: number,
    notify = true
  ) => {
    if (stoppingOperations.get(operationId) !== generation) return;
    stoppingOperations.delete(operationId);
    if (notify && generation === epoch && !disposed) {
      publish({ isStopping: hasStoppingForGeneration(generation) });
    }
  };
  const isTerminalOperationStatus = (
    value: unknown
  ): value is { state: 'completed' | 'failed' | 'cancelled' } => {
    const state = (value as { state?: unknown })?.state;
    return (
      state === 'completed' || state === 'failed' || state === 'cancelled'
    );
  };
  const waitForStopConfirmation = async (
    operationId: string,
    signal: AbortSignal
  ) => {
    try {
      await settle({ operationId }, signal);
      return true;
    } catch (error) {
      if (signal.aborted || disposed) return false;
      try {
        const status = await core.operations.get(operationId);
        if (isTerminalOperationStatus(status)) return true;
      } catch {
        // Preserve the result error below when status cannot be read.
      }
      throw error;
    }
  };
  const settleStoppedSubmission = async (
    operationId: string,
    generation: number,
    signal: AbortSignal
  ) => {
    try {
      const confirmed = await waitForStopConfirmation(operationId, signal);
      if (confirmed) confirmOperation(operationId, generation, false);
      return confirmed;
    } catch (error) {
      if (signal.aborted || generation !== epoch || disposed) return false;
      report(error);
      return true;
    }
  };
  const reportFrameRecoveryError = (error: unknown, generation: number) => {
    if (generation !== epoch || disposed) return;
    frameRecoveryNotice = error;
    report(error);
  };
  const bootstrap = createObservationBootstrap();
  // Status reads never block replay. Heartbeats repair a missed terminal frame,
  // while the projection remembers terminal operations throughout observation.
  const operationStatusReads = new Set<string>();
  const reconcileOperationStatus = (
    operationId: string,
    generation: number,
    token: number
  ) => {
    const key = `${generation}:${token}:${operationId}`;
    if (operationStatusReads.has(key) || projection.terminalOperations.has(operationId)) return;
    operationStatusReads.add(key);
    void Promise.resolve().then(() => core.operations.get(operationId)).then(async (status) => {
      if (disposed || generation !== epoch || token !== observationToken ||
          projection.terminalOperations.has(operationId) || !isTerminalOperationStatus(status)) return;
      await apply({
        kind: 'output',
        checkpoint: checkpoint!,
        output: { type: `operation.${status.state}`, operationId }
      } as ObservationFrame, generation, undefined, token);
    }).catch(() => {
      // A failed read is not completion. Retry on the next observation heartbeat.
    }).finally(() => {
      operationStatusReads.delete(key);
    });
  };
  const apply = (
    frame: ObservationFrame,
    generation: number,
    signal?: AbortSignal,
    token?: number
  ) =>
    serialize(async () => {
      if (
        disposed ||
        generation !== epoch ||
        signal?.aborted ||
        (token !== undefined && token !== observationToken)
      ) {
        throw new DOMException('Thread changed', 'AbortError');
      }
      const previousOperations = projection.operations;
      const intercepted =
        frame.kind === 'output'
          ? options.eventInterceptor?.(frame.output)
          : undefined;
      const next = projectFrame(projection, frame, Date.now());
      const restored = bootstrap.apply(
        frame,
        next.state,
        snapshot.messages.map((message) => message.id)
      );
      next.state = restored.state;
      const operationId =
        frame.kind === 'output' && typeof frame.output.operationId === 'string'
          ? frame.output.operationId
          : undefined;
      const terminalOutput =
        frame.kind === 'output' &&
        /^operation\.(completed|failed|cancelled)$/.test(frame.output.type)
      const removedPreparing =
        (next.state.messages.some(
          (message) =>
            message.metadata?.operationId === operationId &&
            (message.metadata?.llmAttemptId ||
              message.metadata?.contextCompactionRunId)
        ) || terminalOutput)
          ? preparingForOperation(operationId)
          : undefined;
      if (
        disposed ||
        generation !== epoch ||
        signal?.aborted ||
        (token !== undefined && token !== observationToken)
      ) {
        throw new DOMException('Thread changed', 'AbortError');
      }
      const committedState = removedPreparing
        ? {
            ...next.state,
            messages: next.state.messages.filter(
              (message) => message.id !== removedPreparing
            )
          }
        : next.state;
      for (const draft of next.drafts) toolCallDraftSource.apply(draft);
      projection = committedState;
      if (removedPreparing && operationId) {
        preparingByOperation.delete(operationId);
      }
      checkpoint = frame.checkpoint;
      const terminalOperation =
        terminalOutput ? operationId : undefined;
      if (terminalOperation) confirmOperation(terminalOperation, generation, false);
      const clearFrameRecoveryError =
        frameRecoveryNotice !== undefined && snapshot.error === frameRecoveryNotice;
      frameRecoveryNotice = undefined;
      const visible = restored.visible;
      publish({
        messages: visible.messages.filter(
          (message) => message.id !== removedPreparing
        ),
        isRecoveringStream: restored.pending,
        isStreaming:
          projection.operations.size > 0 ||
          [...submissions].some(
            (submission) =>
              submission.generation === epoch && !submission.stopRequested
          ),
        ...(intercepted && intercepted.specialState !== undefined
          ? { specialState: intercepted.specialState }
          : {}),
        ...(clearFrameRecoveryError ? { error: null, specialState: null } : {}),
        ...(terminalOperation
          ? { isStopping: hasStoppingForGeneration(generation) }
          : {})
      });
      if ((next.refresh || restored.completed) && snapshot.currentThreadId) {
        reconciliation?.request();
      }
      for (const id of projection.operations) {
        if (!previousOperations.has(id) || restored.completed ||
            (frame.kind === 'output' && frame.output.type === 'observation.heartbeat')) {
          reconcileOperationStatus(id, generation, observationToken);
        }
      }
    });
  const resyncHistory = async (
    id: string,
    generation: number,
    signal: AbortSignal,
    token?: number
  ) => {
    const page = await retryRead(
      () =>
        core.threads.messages(
          id,
          { order: 'desc', limit: 50 },
          { signal }
        ),
      signal
    );
    if (
      disposed ||
      generation !== epoch ||
      signal.aborted ||
      (token !== undefined && token !== observationToken)
    ) {
      throw new DOMException('Thread changed', 'AbortError');
    }
    history.clear();
    const result = await projectHistory(page, signal);
    await serialize(() => {
      if (
        disposed ||
        generation !== epoch ||
        signal.aborted ||
        (token !== undefined && token !== observationToken)
      ) {
        throw new DOMException('Thread changed', 'AbortError');
      }
      const localPending = projection.messages.filter((message) =>
        message.id.startsWith('pending:')
      );
      const pendingOperations = new Set(
        [...submissions]
          .filter(
            (submission) =>
              submission.generation === generation && submission.operationId
          )
          .map((submission) => submission.operationId!)
      );
      const nextProjection = mergeHistory(
        {
          ...emptyProjection(),
          messages: localPending,
          operations: pendingOperations
        },
        result
      );
      const localPendingIds = new Set(localPending.map((message) => message.id));
      projection = nextProjection;
      bootstrap.clear();
      toolCallDraftSource.clear();
      for (const [operationId, messageId] of preparingByOperation) {
        if (!localPendingIds.has(messageId)) preparingByOperation.delete(operationId);
      }
      history.clear();
      checkpoint = page.pageInfo.checkpoint;
      publish({
        messages: projection.messages,
        messagePageInfo: page.pageInfo,
        isRecoveringStream: true,
        isMessagesLoading: false
      });
    });
  };
  const observeThread = (
    id: string,
    generation: number,
    recovered: boolean
  ) => {
    const token = ++observationToken;
    observation?.close();
    observation = createObservationSupervisor({
      observe: (signal, progress) => {
        return core.threads.observe(id, {
          checkpoint,
          signal,
          onFrame: async (frame) => {
            try {
              await apply(frame, generation, signal, token);
              progress();
            } catch (error) {
              if (
                disposed ||
                generation !== epoch ||
                signal.aborted ||
                token !== observationToken ||
                (error as { name?: string })?.name === 'AbortError'
              ) {
                throw error;
              }
              frameRecoveryFailures += 1;
              publish({ isRecoveringStream: true });
              try {
                await resyncHistory(id, generation, signal, token);
              } catch (resyncError) {
                if (signal.aborted || generation !== epoch || disposed) {
                  throw resyncError;
                }
                frameRecoveryNotice = resyncError;
              }
              if (frameRecoveryFailures >= MAX_FRAME_RECOVERY_ATTEMPTS) {
                const exhausted = new FrameRecoveryExhaustedError(
                  frameRecoveryNotice ?? error
                );
                reportFrameRecoveryError(exhausted, generation);
                throw exhausted;
              }
              throw new RecoverableFrameError(error);
            }
          }
        });
      },
      retryable: (error) =>
        error instanceof RecoverableFrameError ||
        isTransientRequestError(error),
      onRetry: () => {
        if (generation === epoch && !disposed) {
          publish({ isRecoveringStream: true });
        }
      },
      onError: (error) => {
        if (generation !== epoch || disposed) return;
        const code = (error as { code?: string })?.code;
        if (
          !recovered &&
          (code === 'operation_replay_capacity_exceeded' ||
            code === 'invalid_replay_cursor')
        ) {
          publish({ isRecoveringStream: true });
          void recover();
        } else {
          publish({ isStreaming: false });
          report(error);
        }
      }
    });
    observation.start();
  };
  const openThread = async (
    id: string,
    recovered = false,
    pending?: { messages: ChatMessage[]; operationId: string }
  ) => {
    const generation = ++epoch;
    observationToken++;
    observation?.close();
    for (const [operationId, owner] of stoppingOperations) {
      if (owner !== generation) stoppingOperations.delete(operationId);
    }
    frameRecoveryFailures = 0;
    frameRecoveryNotice = undefined;
    historyAbort.abort();
    historyAbort = new AbortController();
    const signal = historyAbort.signal;
    reconciliation = configureReconciliation(id, generation, signal);
    preparingByOperation.clear();
    await serialize(() => {
      if (generation !== epoch || disposed) return;
      projection = emptyProjection();
      if (pending) {
        projection.messages = pending.messages;
        projection.operations.add(pending.operationId);
        const preparing = pending.messages.find((message) =>
          message.id.endsWith(':preparing')
        );
        if (preparing)
          preparingByOperation.set(pending.operationId, preparing.id);
      }
    });
    if (generation !== epoch || disposed) return;
    bootstrap.clear();
    history.clear();
    toolCallDraftSource.clear();
    publish({
      currentThreadId: id,
      messages: projection.messages,
      isMessagesLoading: true,
      isLoadingOlderMessages: false,
      isStreaming: Boolean(pending),
      isStopping: false,
      error: null
    });
    try {
      const page = await retryRead(
        () =>
          core.threads.messages(id, { order: 'desc', limit: 50 }, { signal }),
        signal
      );
      if (generation !== epoch || disposed) return;
      const result = await projectHistory(page, signal);
      if (generation !== epoch || disposed) return;
      projection = mergeHistory(projection, result);
      checkpoint = page.pageInfo.checkpoint;
      publish({
        messages: projection.messages,
        messagePageInfo: page.pageInfo,
        isMessagesLoading: false,
        isRecoveringStream: false
      });
      observeThread(id, generation, recovered);
    } catch (error) {
      if (generation === epoch) {
        publish({ isMessagesLoading: false });
        report(error);
      }
    }
  };
  const settle = (receipt: { operationId: string }, signal?: AbortSignal) =>
    core.operations.result(receipt.operationId, signal);
  const send = async (text: string, attachments: MediaAttachment[] = []) => {
    const generation = epoch;
    const threadId = snapshot.currentThreadId;
    const title = !threadId ? draftName : undefined;
    const idempotencyKey = crypto.randomUUID();
    const submission = {
      controller: new AbortController(),
      generation,
      stopRequested: false,
      operationId: undefined as string | undefined
    };
    const preparingAgentId =
      options.targetAgentName ??
      options.participants?.[0] ??
      options.preferredAgentName ??
      undefined;
    const preparingId = preparingAgentId
      ? `pending:${idempotencyKey}:preparing`
      : undefined;
    let settled = false;
    let sendGeneration = generation;
    submissions.add(submission);
    await serialize(() => {
      if (generation !== epoch || disposed) return;
      projection.messages = [
        ...projection.messages,
        {
          id: `pending:${idempotencyKey}`,
          role: 'user',
          content: text,
          attachments,
          timestamp: Date.now(),
          metadata: { clientMessageId: idempotencyKey }
        }
      ];
      if (preparingId) {
        const agent = options.agentOptions?.find(
          (value) => value.id === preparingAgentId
        );
        projection.messages = [
          ...projection.messages,
          {
            id: preparingId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            sender: {
              type: 'agent',
              id: preparingAgentId!,
              agentId: preparingAgentId!,
              name: agent?.name ?? preparingAgentId!
            },
            metadata: { clientMessageId: idempotencyKey },
            activity: {
              items: [
                {
                  id: `${idempotencyKey}:preparing`,
                  kind: 'answering',
                  status: 'active',
                  startedAt: Date.now()
                }
              ]
            }
          }
        ];
      }
      publish({
        error: null,
        isStreaming: true,
        messages: projection.messages
      });
    });
    try {
      const content: unknown[] = text ? [text] : [];
      content.push(
        ...(await uploadAttachments(core.assets, attachments, {
          idempotencyKey,
          signal: submission.controller.signal
        }))
      );
      if (submission.stopRequested) return;
      const recipientIds = options.targetAgentName
        ? [options.targetAgentName]
        : options.participants ??
          (options.preferredAgentName ? [options.preferredAgentName] : []);
      const receipt = await core.threads.send(
        {
          ...(threadId
            ? { threadId }
            : { externalThreadId: crypto.randomUUID() }),
          content: content as Parameters<
            CoreClient['threads']['send']
          >[0]['content'],
          participantIds: options.participants ?? undefined,
          recipientIds
        },
        { idempotencyKey, signal: submission.controller.signal }
      );
      submission.operationId = receipt.operationId;
      if (submission.stopRequested && generation === epoch && !disposed) {
        stoppingOperations.set(receipt.operationId, generation);
      }
      await serialize(() => {
        if (generation === epoch && !disposed) {
          projection.operations.add(receipt.operationId);
          if (preparingId) {
            preparingByOperation.set(receipt.operationId, preparingId);
            if (
              projection.messages.some(
                (message) =>
                  message.metadata?.operationId === receipt.operationId &&
                  message.metadata?.llmAttemptId
              )
            )
              removePreparing(receipt.operationId);
          }
        }
      });
      if (threadId && generation === epoch && !disposed) {
        observation?.start();
        reconciliation?.request();
      }
      if (submission.stopRequested) {
        try {
          await core.operations.cancel(receipt.operationId);
        } catch (error) {
          stoppingOperations.delete(receipt.operationId);
          if (generation === epoch && !disposed) {
            report(error);
          }
        }
      }
      const result = (await settle(receipt, submission.controller.signal)) as {
        threadId: string;
      };
      // The send Action settles before downstream Agents. History bootstrap then
      // observes their overlapping work through the same conversation feed.
      settled = true;
      confirmOperation(receipt.operationId, generation, false);
      if (!threadId && generation === epoch && !disposed) {
        const messages = projection.messages.filter(
          (message) =>
            message.id === `pending:${idempotencyKey}` ||
            message.id === preparingId
        );
        sendGeneration = generation + 1;
        await openThread(result.threadId, false, {
          messages,
          operationId: receipt.operationId
        });
      }
      // Renaming does not precede observation or erase its preparation feedback.
      if (title && sendGeneration === epoch && !disposed) {
        await settle(
          await core.threads.update(
            result.threadId,
            { name: title },
            { idempotencyKey: `${idempotencyKey}:title` }
          )
        );
      }
      await refreshThreads();
    } catch (error) {
      let handledStoppedSubmission = false;
      if (submission.stopRequested && submission.operationId) {
        handledStoppedSubmission = await settleStoppedSubmission(
          submission.operationId,
          generation,
          historyAbort.signal
        );
      }
      if (
        !handledStoppedSubmission &&
        !submission.stopRequested &&
        generation === epoch &&
        !submission.controller.signal.aborted
      ) {
        report(error);
      }
    } finally {
      if ((!settled || submission.stopRequested) && submission.operationId) {
        await serialize(() => removePreparing(submission.operationId));
      } else if (!settled && preparingId) {
        await serialize(() => {
          projection = {
            ...projection,
            messages: projection.messages.filter(
              (message) => message.id !== preparingId
            )
          };
        });
      }
      submissions.delete(submission);
      if (sendGeneration === epoch) {
        publish({
          messages: bootstrap.visible(projection).messages,
          isStreaming:
            Boolean(observation?.active) &&
            (projection.operations.size > 0 ||
              [...submissions].some(
                (pending) =>
                  pending.generation === epoch && !pending.stopRequested
              )),
          isStopping: hasStoppingForGeneration(sendGeneration)
        });
      }
    }
  };
  const stop = async () => {
    const generation = epoch;
    const ids = new Set(projection.operations);
    for (const submission of submissions) {
      if (submission.generation !== generation) continue;
      submission.stopRequested = true;
      if (submission.operationId) ids.add(submission.operationId);
    }
    for (const id of ids) stoppingOperations.set(id, generation);
    publish({ isStopping: true });
    const results = await Promise.allSettled(
      [...ids].map((id) =>
        Promise.resolve().then(() => core.operations.cancel(id))
      )
    );
    for (const [index, result] of results.entries()) {
      if (result.status !== 'rejected') continue;
      const id = [...ids][index];
      stoppingOperations.delete(id);
      if (generation === epoch && !disposed) report(result.reason);
    }
    if (generation === epoch && !disposed) {
      publish({ isStopping: hasStoppingForGeneration(generation) });
      const signal = historyAbort.signal;
      for (const id of ids) {
        if (stoppingOperations.get(id) !== generation) continue;
        void waitForStopConfirmation(id, signal)
          .then((confirmed) => {
            if (!confirmed) return;
            confirmOperation(id, generation);
          })
          .catch((error) => {
            if (
              generation !== epoch ||
              disposed ||
              signal.aborted
            )
              return;
            stoppingOperations.delete(id);
            report(error);
            publish({ isStopping: hasStoppingForGeneration(generation) });
          });
      }
    }
  };
  const recover = async () => {
    const id = snapshot.currentThreadId;
    if (!id || disposed) return false;
    const generation = epoch;
    observation?.close();
    const token = ++observationToken;
    frameRecoveryFailures = 0;
    frameRecoveryNotice = undefined;
    publish({
      error: null,
      specialState: null,
      isRecoveringStream: true
    });
    try {
      await resyncHistory(id, generation, historyAbort.signal, token);
      if (generation !== epoch || disposed) return false;
      observeThread(id, generation, true);
      return true;
    } catch (error) {
      if (generation === epoch && !disposed) report(error);
      return false;
    }
  };
  const mutate = async (operation: Promise<{ operationId: string }>) => {
    const generation = epoch;
    try {
      await settle(await operation);
      await refreshThreads();
      return true;
    } catch (error) {
      if (generation === epoch) report(error);
      return false;
    }
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateOptions(value: ControllerOptions) {
      options = value;
    },
    refreshThreads,
    openThread,
    recover,
    send,
    stop,
    toolCallDraftSource,
    async start(threadId?: string | null) {
      if (!options.userId) return;
      const generation = epoch;
      try {
        await refreshThreads();
        if (disposed || generation !== epoch) return;
        if (threadId) await openThread(threadId);
        else if (options.bootstrap?.initialMessage) {
          await send(options.bootstrap.initialMessage);
        }
      } catch (error) {
        report(error);
      }
    },
    createThread(title?: string) {
      draftName = title?.trim() || undefined;
      ++epoch;
      observationToken++;
      observation?.close();
      stoppingOperations.clear();
      frameRecoveryFailures = 0;
      frameRecoveryNotice = undefined;
      historyAbort.abort();
      historyAbort = new AbortController();
      reconciliation = undefined;
      preparingByOperation.clear();
      projection = emptyProjection();
      checkpoint = undefined;
      toolCallDraftSource.clear();
      publish({
        currentThreadId: null,
        messages: [],
        isMessagesLoading: false,
        isLoadingOlderMessages: false,
        isStreaming: false,
        isStopping: false,
        messagePageInfo: { hasMore: false }
      });
    },
    renameThread(id: string, name: string) {
      return mutate(
        core.threads.update(
          id,
          { name },
          { idempotencyKey: crypto.randomUUID() }
        )
      );
    },
    updateThreadTags(
      id: string,
      tags: { id: string; name: string; color?: string }[]
    ) {
      return mutate(
        core.threads.update(
          id,
          { tags },
          { idempotencyKey: crypto.randomUUID() }
        )
      );
    },
    archiveThread(id: string) {
      return mutate(
        core.threads.update(
          id,
          { status: 'archived' },
          { idempotencyKey: crypto.randomUUID() }
        )
      );
    },
    async deleteThread(id: string) {
      const deleted = await mutate(
        core.threads.delete(id, { idempotencyKey: crypto.randomUUID() })
      );
      if (deleted && snapshot.currentThreadId === id) this.createThread();
    },
    async editMessage(messageId: string, content: string) {
      const id = snapshot.currentThreadId;
      const generation = epoch;
      if (!id) return;
      const edited = await mutate(
        core.messages.edit(
          id,
          messageId,
          { content },
          { idempotencyKey: crypto.randomUUID() }
        )
      );
      if (edited && generation === epoch && !disposed) await openThread(id);
    },
    async loadOlderMessages() {
      if (
        !snapshot.currentThreadId ||
        !snapshot.messagePageInfo.hasMore ||
        snapshot.isLoadingOlderMessages
      ) {
        return;
      }
      const generation = epoch;
      publish({ isLoadingOlderMessages: true });
      try {
        const page = await core.threads.messages(
          snapshot.currentThreadId,
          {
            order: 'desc',
            after: snapshot.messagePageInfo.next,
            limit: 50
          },
          { signal: historyAbort.signal }
        );
        if (generation !== epoch || disposed) return;
        const result = await projectHistory(page);
        await serialize(() => {
          if (generation === epoch && !disposed) {
            projection = mergeHistory(projection, result);
            publish({
              messages: bootstrap.isPending()
                ? mergeHistory(
                    { ...projection, messages: snapshot.messages },
                    result
                  ).messages
                : projection.messages,
              messagePageInfo: page.pageInfo
            });
          }
        });
      } catch (error) {
        if (generation === epoch) report(error);
      } finally {
        if (generation === epoch) publish({ isLoadingOlderMessages: false });
      }
    },
    clearSpecialState() {
      publish({ specialState: null });
    },
    dispose() {
      disposed = true;
      ++epoch;
      observationToken++;
      lifetime.abort();
      historyAbort.abort();
      observation?.close();
      for (const submission of submissions) submission.controller.abort();
      stoppingOperations.clear();
      bootstrap.clear();
      history.clear();
      listeners.clear();
      toolCallDraftSource.clear();
    }
  });
}
export type ChatController = ReturnType<typeof createChatController>;
