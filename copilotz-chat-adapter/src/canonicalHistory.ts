import type { ConversationMessage, Page } from '@copilotz/copilotz/core/client';
export type CanonicalMessage = ConversationMessage;
export type CanonicalParticipant = ConversationMessage['sender'];
export type CanonicalContentRef = ConversationMessage['content'][number];
export type CanonicalResolvedContent = {
  ref: CanonicalContentRef;
  asset: { mediaType: string; byteLength: number };
  base64: string;
};
export type CanonicalMessagePageInfo = Page<ConversationMessage>['pageInfo'];
export type CanonicalMessagePage = Page<ConversationMessage> & {
  included: { content: CanonicalResolvedContent[] };
};
