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
  let reconciliation:
    | ReturnType<typeof createHistoryReconciliation>
    | undefined;
  let checkpoint: string | undefined;
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
  const toolCallDraftSource = createToolCallDraftStore();
  const publish = (patch: Partial<ChatSnapshot>) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const report = (error: unknown) =>
    publish({
      error,
      specialState: options.runErrorInterceptor?.(error) ?? null,
      isRecoveringStream: false
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
  const clearPreparing = (operationId?: string) => {
    const id = operationId && preparingByOperation.get(operationId);
    if (!id) return undefined;
    preparingByOperation.delete(operationId);
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
              options.onToolOutput?.(tool.result as Record<string, unknown>);
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
  const bootstrap = createObservationBootstrap();
  const apply = (frame: ObservationFrame, generation: number) =>
    serialize(async () => {
      if (disposed || generation !== epoch) {
        throw new DOMException('Thread changed', 'AbortError');
      }
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
      let removedPreparing = next.state.messages.some(
        (message) =>
          message.metadata?.operationId === operationId &&
          message.metadata?.llmAttemptId
      )
        ? clearPreparing(operationId)
        : undefined;
      if (
        frame.kind === 'output' &&
        /^operation\.(completed|failed|cancelled)$/.test(frame.output.type)
      ) {
        removedPreparing ??= clearPreparing(operationId);
      }
      if (disposed || generation !== epoch) {
        throw new DOMException('Thread changed', 'AbortError');
      }
      projection = next.state;
      if (removedPreparing) {
        projection = {
          ...projection,
          messages: projection.messages.filter(
            (message) => message.id !== removedPreparing
          )
        };
      }
      for (const draft of next.drafts) toolCallDraftSource.apply(draft);
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
          : {})
      });
      checkpoint = frame.checkpoint;
      if ((next.refresh || restored.completed) && snapshot.currentThreadId) {
        reconciliation?.request();
      }
    });
  const observeThread = (
    id: string,
    generation: number,
    recovered: boolean
  ) => {
    observation?.close();
    let frameError: unknown;
    observation = createObservationSupervisor({
      observe: (signal, progress) => {
        frameError = undefined;
        return core.threads.observe(id, {
          checkpoint,
          signal,
          onFrame: async (frame) => {
            try {
              await apply(frame, generation);
              progress();
            } catch (error) {
              frameError = error;
              throw error;
            }
          }
        });
      },
      retryable: (error) =>
        error !== frameError && isTransientRequestError(error),
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
          void openThread(id, true);
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
    observation?.close();
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
              clearPreparing(receipt.operationId);
          }
        }
      });
      if (threadId && generation === epoch && !disposed) {
        observation?.start();
        reconciliation?.request();
      }
      if (submission.stopRequested) {
        await core.operations.cancel(receipt.operationId);
      }
      const result = (await settle(receipt, submission.controller.signal)) as {
        threadId: string;
      };
      // The send Action settles before downstream Agents. History bootstrap then
      // observes their overlapping work through the same conversation feed.
      settled = true;
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
      if (
        generation === epoch &&
        !submission.stopRequested &&
        !submission.controller.signal.aborted
      ) {
        report(error);
      }
    } finally {
      if ((!settled || submission.stopRequested) && submission.operationId) {
        await serialize(() => clearPreparing(submission.operationId));
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
          isStopping: false
        });
      }
    }
  };
  const stop = async () => {
    const ids = new Set(projection.operations);
    for (const submission of submissions) {
      if (submission.generation !== epoch) continue;
      submission.stopRequested = true;
      if (submission.operationId) ids.add(submission.operationId);
    }
    publish({ isStopping: true });
    try {
      await Promise.all([...ids].map((id) => core.operations.cancel(id)));
    } catch (error) {
      report(error);
    } finally {
      publish({ isStopping: false });
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
      observation?.close();
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
      lifetime.abort();
      historyAbort.abort();
      observation?.close();
      for (const submission of submissions) submission.controller.abort();
      bootstrap.clear();
      history.clear();
      listeners.clear();
      toolCallDraftSource.clear();
    }
  });
}
export type ChatController = ReturnType<typeof createChatController>;
