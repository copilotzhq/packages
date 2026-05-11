export { ChatUI } from './components/chat/ChatUI';
export { AssistantActivity } from './components/chat/AssistantActivity';
export { MessageSenderAvatar, resolveMessageSenderDisplay } from './components/chat/MessageSender';
export { ChatUserContextProvider, useChatUserContext } from './components/chat/UserContext';
export { defaultChatConfig, mergeConfig } from './config/chatConfig';
export { getAttachmentKindFromMimeType, getMimeTypeFromDataUrl } from './lib/utils';
export type * from './types/chatTypes';
