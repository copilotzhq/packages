import type { CoreClient } from '@copilotz/copilotz/core/client';
import type { ObservationFrame } from '@copilotz/copilotz/client';
import type {
  ChatMessage,
  ChatThread,
  MediaAttachment,
  AgentOption,
  ChatUserContext
} from '@copilotz/chat-ui';
import { uploadAttachments } from './attachments.ts';
import { createHistoryReader } from './history.ts';
import { reconcileThreadMessages } from './messageReconciliation.ts';
import { mergePersistedToolResults } from './toolActivity.ts';
import { createToolCallDraftStore } from './toolCallDraftStore.ts';
import {
  emptyProjection,
  projectFrame,
  projectHistoryMessages,
  type ChatProjection
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
  let observation: AbortController | undefined;
  let checkpoint: string | undefined;
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
  const history = createHistoryReader(core);
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
  const projectHistory = (page: Parameters<typeof history.project>[0]) =>
    history.project(page, {
      signal: historyAbort.signal,
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
  const apply = (frame: ObservationFrame, generation: number) =>
    serialize(async () => {
      if (disposed || generation !== epoch)
        throw new DOMException('Thread changed', 'AbortError');
      const intercepted =
        frame.kind === 'output'
          ? options.eventInterceptor?.(frame.output)
          : undefined;
      const next = projectFrame(projection, frame, Date.now());
      if (next.refresh && snapshot.currentThreadId) {
        const result = await projectHistory(
          await core.threads.messages(
            snapshot.currentThreadId,
            {
              order: 'desc',
              limit: 50
            },
            { signal: historyAbort.signal }
          )
        );
        next.state = mergeHistory(next.state, result);
        for (const tool of result.toolResultUpdates) {
          const id = `${tool.toolExecutionId}:${tool.endTime}`;
          if (
            !reportedTools.has(id) &&
            tool.result &&
            typeof tool.result === 'object'
          ) {
            options.onToolOutput?.(tool.result as Record<string, unknown>);
            reportedTools.add(id);
          }
        }
      }
      if (disposed || generation !== epoch)
        throw new DOMException('Thread changed', 'AbortError');
      projection = next.state;
      for (const draft of next.drafts) toolCallDraftSource.apply(draft);
      publish({
        messages: projection.messages,
        isStreaming: projection.operations.size > 0,
        ...(intercepted && intercepted.specialState !== undefined
          ? { specialState: intercepted.specialState }
          : {})
      });
      checkpoint = frame.checkpoint;
    });
  const observeThread = (
    id: string,
    generation: number,
    recovered: boolean
  ) => {
    observation = new AbortController();
    const signal = observation.signal;
    void core.threads
      .observe(id, {
        checkpoint,
        signal,
        onFrame: (frame) => apply(frame, generation)
      })
      .catch(async (error) => {
        if (signal.aborted || generation !== epoch || disposed) return;
        if (
          !recovered &&
          (error.code === 'operation_replay_capacity_exceeded' ||
            error.code === 'invalid_replay_cursor')
        ) {
          publish({ isRecoveringStream: true });
          await openThread(id, true);
        } else {
          observation?.abort();
          publish({ isStreaming: false });
          report(error);
        }
      });
  };
  const openThread = async (id: string, recovered = false) => {
    const generation = ++epoch;
    observation?.abort();
    historyAbort.abort();
    historyAbort = new AbortController();
    const signal = historyAbort.signal;
    await serialize(() => {
      projection = emptyProjection();
    });
    history.clear();
    toolCallDraftSource.clear();
    publish({
      currentThreadId: id,
      messages: [],
      isMessagesLoading: true,
      isLoadingOlderMessages: false,
      isStreaming: false,
      error: null
    });
    try {
      const page = await core.threads.messages(
        id,
        {
          order: 'desc',
          limit: 50
        },
        { signal }
      );
      if (generation !== epoch || disposed) return;
      const result = await projectHistory(page);
      if (generation !== epoch || disposed) return;
      projection = mergeHistory(emptyProjection(), result);
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
        if (generation === epoch && !disposed)
          projection.operations.add(receipt.operationId);
      });
      if (submission.stopRequested)
        await core.operations.cancel(receipt.operationId);
      const result = (await settle(receipt, submission.controller.signal)) as {
        threadId: string;
      };
      if (title)
        await settle(
          await core.threads.update(
            result.threadId,
            { name: title },
            { idempotencyKey: `${idempotencyKey}:title` }
          )
        );
      // The send Action settles before downstream Agents. History bootstrap then
      // observes their overlapping work through the same conversation feed.
      if (!threadId && generation === epoch && !disposed)
        await openThread(result.threadId);
      await refreshThreads();
    } catch (error) {
      if (
        generation === epoch &&
        !submission.stopRequested &&
        !submission.controller.signal.aborted
      )
        report(error);
    } finally {
      submissions.delete(submission);
      if (generation === epoch)
        publish({
          isStreaming:
            !observation?.signal.aborted && projection.operations.size > 0,
          isStopping: false
        });
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
        else if (options.bootstrap?.initialMessage)
          await send(options.bootstrap.initialMessage);
      } catch (error) {
        report(error);
      }
    },
    createThread(title?: string) {
      draftName = title?.trim() || undefined;
      ++epoch;
      observation?.abort();
      historyAbort.abort();
      historyAbort = new AbortController();
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
      )
        return;
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
              messages: projection.messages,
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
      observation?.abort();
      for (const submission of submissions) submission.controller.abort();
      history.clear();
      listeners.clear();
      toolCallDraftSource.clear();
    }
  });
}
export type ChatController = ReturnType<typeof createChatController>;
