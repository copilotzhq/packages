import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import { createCopilotzClient } from '@copilotz/copilotz/client';
import {
  createCoreClient,
  type CoreClient
} from '@copilotz/copilotz/core/client';
import {
  createChatController,
  type ChatController,
  type ChatSnapshot,
  type ControllerOptions
} from './controller';
import { useUrlState } from './useUrlState';

export type RequestHeadersProvider = () => HeadersInit | Promise<HeadersInit>;
export type UseCopilotzChatOptions = ControllerOptions & {
  /** Optional host-owned Core client. The adapter creates one when omitted. */
  coreClient?: CoreClient;
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
};
const idle: ChatSnapshot = {
  messages: [],
  threads: [],
  spaces: [],
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
      options.coreClient ??
      createCoreClient(
        createCopilotzClient({
          baseUrl: options.baseUrl ?? '/api',
          getRequestHeaders: () => headers.current?.() ?? {}
        })
      ),
    [options.baseUrl, options.coreClient, options.userId]
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
  }, [core, options.userId]);
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
              : 'Unable to update the conversation.',
          ...(snapshot.currentThreadId
            ? {
                action: {
                  label: 'Reload conversation',
                  onClick: () => {
                    void controller?.recover();
                  }
                }
              }
            : {})
        }
      : undefined,
    toolCallDraftSource: controller?.toolCallDraftSource,
    userContextSeed: options.initialContext ?? {},
    sendMessage: (
      content: string,
      attachments?: Parameters<ChatController['send']>[1]
    ) => controller?.send(content, attachments),
    stopGeneration: () => controller?.stop(),
    recoverConversation: () => controller?.recover(),
    createThread: (title?: string) => {
      controller?.createThread(title);
      url.setThreadId(null);
    },
    selectThread: (id: string) => controller?.openThread(id),
    renameThread: (id: string, name: string) =>
      controller?.renameThread(id, name),
    archiveThread: (id: string) => controller?.archiveThread(id),
    createSpace: (name: string) => controller?.createSpace(name),
    refreshSpaces: () => controller?.refreshSpaces(),
    moveThreadToSpace: (id: string, spaceId: string | null) =>
      controller?.moveThreadToSpace(id, spaceId),
    editMessage: (id: string, content: string) =>
      controller?.editMessage(id, content),
    deleteThread: (id: string) => controller?.deleteThread(id),
    loadOlderMessages: () => controller?.loadOlderMessages(),
    clearSpecialState: () => controller?.clearSpecialState()
  };
}
