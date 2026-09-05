import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import { createCopilotzClient } from '@copilotz/copilotz/client';
import { createCoreClient } from '@copilotz/copilotz/core/client';
import {
  createChatController,
  type ChatController,
  type ChatSnapshot,
  type ControllerOptions
} from './controller';
import { useUrlState } from './useUrlState';

export type RequestHeadersProvider = () => HeadersInit | Promise<HeadersInit>;
export type UseCopilotzChatOptions = ControllerOptions & {
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
};
const idle: ChatSnapshot = {
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
const subscribeIdle = () => () => {};
const getIdle = () => idle;

/** React owns subscription and lifecycle; the controller owns conversation behavior. */
export function useCopilotzChat(options: UseCopilotzChatOptions) {
  const headers = useRef(options.getRequestHeaders);
  headers.current = options.getRequestHeaders;
  const latest = useRef(options);
  latest.current = options;
  const core = useMemo(
    () =>
      createCoreClient(
        createCopilotzClient({
          baseUrl: options.baseUrl ?? '/api',
          getRequestHeaders: () => headers.current?.() ?? {}
        })
      ),
    [options.baseUrl, options.userId]
  );
  const [controller, setController] = useState<ChatController>();
  const url = useUrlState((threadId) => {
    if (!controller || controller.getSnapshot().currentThreadId === threadId)
      return;
    if (threadId) void controller.openThread(threadId);
    else controller.createThread();
  });
  useEffect(() => {
    const next = createChatController(core, latest.current);
    setController(next);
    void next.start(url.initialThreadId);
    return () => next.dispose();
  }, [core]);
  useEffect(() => {
    controller?.updateOptions(options);
  }, [controller, options]);
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? subscribeIdle,
    controller?.getSnapshot ?? getIdle,
    getIdle
  );
  useEffect(() => {
    if (snapshot.currentThreadId) url.setThreadId(snapshot.currentThreadId);
  }, [snapshot.currentThreadId, url.setThreadId]);
  return {
    ...snapshot,
    activityNotice: snapshot.error
      ? {
          tone: 'error' as const,
          message:
            snapshot.error instanceof Error
              ? snapshot.error.message
              : 'Unable to update the conversation.'
        }
      : undefined,
    toolCallDraftSource: controller?.toolCallDraftSource,
    userContextSeed: options.initialContext ?? {},
    sendMessage: (
      content: string,
      attachments?: Parameters<ChatController['send']>[1]
    ) => controller?.send(content, attachments),
    stopGeneration: () => controller?.stop(),
    createThread: (title?: string) => {
      controller?.createThread(title);
      url.setThreadId(null);
    },
    selectThread: (id: string) => controller?.openThread(id),
    renameThread: (id: string, name: string) =>
      controller?.renameThread(id, name),
    archiveThread: (id: string) => controller?.archiveThread(id),
    updateThreadTags: (
      id: string,
      tags: Parameters<ChatController['updateThreadTags']>[1]
    ) => controller?.updateThreadTags(id, tags),
    editMessage: (id: string, content: string) =>
      controller?.editMessage(id, content),
    deleteThread: (id: string) => controller?.deleteThread(id),
    loadOlderMessages: () => controller?.loadOlderMessages(),
    clearSpecialState: () => controller?.clearSpecialState()
  };
}
