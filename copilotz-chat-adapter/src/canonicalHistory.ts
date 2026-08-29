import {
  ContractViolation,
  expectRecord,
  expectString,
  expectStringValue,
  // @ts-expect-error Direct Node TypeScript tests require the source extension.
} from './contract.ts';

export type CanonicalParticipantType = 'human' | 'agent' | 'tool' | 'job';
export type CanonicalContentKind = 'text' | 'json' | 'image' | 'audio' | 'video' | 'file';

export type CanonicalParticipant = {
  id: string;
  namespace: string;
  externalId: string;
  participantType: CanonicalParticipantType;
  name?: string;
  email?: string;
  agentId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CanonicalContentRef = {
  assetId: string;
  kind: CanonicalContentKind;
  role: string;
  mediaType: string;
  name?: string;
  alt?: string;
  language?: string;
  disposition?: 'inline' | 'attachment';
  metadata?: Record<string, unknown>;
};

export type CanonicalMessage = {
  id: string;
  namespace: string;
  threadId: string;
  sender: CanonicalParticipant;
  recipientIds: string[];
  content: CanonicalContentRef[];
  metadata: Record<string, unknown>;
  revision?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CanonicalAssetRecord = {
  id: string;
  namespace: string;
  mediaType: string;
  byteLength: number;
  digest: string;
  state: 'staging' | 'ready' | 'failed' | 'abandoned' | 'deleted';
  createdAt: string;
  readyAt?: string;
  deletedAt?: string;
  metadata?: Record<string, unknown>;
};

export type CanonicalResolvedContent = {
  ref: CanonicalContentRef;
  asset: CanonicalAssetRecord;
  base64: string;
};

export type CanonicalMessageHistoryIncluded = {
  content: CanonicalResolvedContent[];
};

export type CanonicalMessagePageInfo = {
  next?: string;
  hasMore: boolean;
};

export type CanonicalMessagePage = {
  data: CanonicalMessage[];
  included: CanonicalMessageHistoryIncluded;
  pageInfo: CanonicalMessagePageInfo;
};

const optionalString = (value: unknown, path: string): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return expectString(value, path);
};

const expectStringArray = (value: unknown, path: string): string[] => {
  if (!Array.isArray(value)) throw new ContractViolation(`${path} must be an array`);
  return value.map((entry, index) => expectString(entry, `${path}[${index}]`));
};

const expectRecordValue = (value: unknown, path: string): Record<string, unknown> =>
  value === undefined || value === null ? {} : expectRecord(value, path);

const expectNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ContractViolation(`${path} must be a number`);
  }
  return value;
};

const expectContentKind = (value: unknown, path: string): CanonicalContentKind => {
  if (value === 'text' || value === 'json' || value === 'image' || value === 'audio' || value === 'video' || value === 'file') return value;
  throw new ContractViolation(`${path} must be a canonical content kind`);
};

const parseContentRef = (value: unknown, path: string): CanonicalContentRef => {
  const ref = expectRecord(value, path);
  const disposition = optionalString(ref.disposition, `${path}.disposition`);
  if (disposition !== undefined && disposition !== 'inline' && disposition !== 'attachment') {
    throw new ContractViolation(`${path}.disposition must be inline or attachment`);
  }
  return {
    assetId: expectString(ref.assetId, `${path}.assetId`),
    kind: expectContentKind(ref.kind, `${path}.kind`),
    role: expectString(ref.role, `${path}.role`),
    mediaType: expectString(ref.mediaType, `${path}.mediaType`),
    ...(optionalString(ref.name, `${path}.name`) ? { name: optionalString(ref.name, `${path}.name`) } : {}),
    ...(optionalString(ref.alt, `${path}.alt`) ? { alt: optionalString(ref.alt, `${path}.alt`) } : {}),
    ...(optionalString(ref.language, `${path}.language`) ? { language: optionalString(ref.language, `${path}.language`) } : {}),
    ...(disposition ? { disposition } : {}),
    ...(ref.metadata === undefined ? {} : { metadata: expectRecord(ref.metadata, `${path}.metadata`) }),
  };
};

const parseContent = (value: unknown, path: string): CanonicalContentRef[] => {
  if (!Array.isArray(value)) throw new ContractViolation(`${path} must be an array`);
  return value.map((ref, index) => parseContentRef(ref, `${path}[${index}]`));
};

const parseParticipant = (value: unknown, path: string): CanonicalParticipant => {
  const participant = expectRecord(value, path);
  const participantType = participant.participantType;
  if (participantType !== 'human' && participantType !== 'agent' && participantType !== 'tool' && participantType !== 'job') {
    throw new ContractViolation(`${path}.participantType must be human, agent, tool, or job`);
  }
  return {
    id: expectString(participant.id, `${path}.id`),
    namespace: expectString(participant.namespace, `${path}.namespace`),
    externalId: expectString(participant.externalId, `${path}.externalId`),
    participantType,
    ...(optionalString(participant.name, `${path}.name`) ? { name: optionalString(participant.name, `${path}.name`) } : {}),
    ...(optionalString(participant.email, `${path}.email`) ? { email: optionalString(participant.email, `${path}.email`) } : {}),
    ...(optionalString(participant.agentId, `${path}.agentId`) ? { agentId: optionalString(participant.agentId, `${path}.agentId`) } : {}),
    metadata: expectRecordValue(participant.metadata, `${path}.metadata`),
    createdAt: expectString(participant.createdAt, `${path}.createdAt`),
    updatedAt: expectString(participant.updatedAt, `${path}.updatedAt`),
  };
};

const parseMessage = (value: unknown, path: string): CanonicalMessage => {
  const message = expectRecord(value, path);
  return {
    id: expectString(message.id, `${path}.id`),
    namespace: expectString(message.namespace, `${path}.namespace`),
    threadId: expectString(message.threadId, `${path}.threadId`),
    sender: parseParticipant(message.sender, `${path}.sender`),
    recipientIds: expectStringArray(message.recipientIds, `${path}.recipientIds`),
    content: parseContent(message.content, `${path}.content`),
    metadata: expectRecordValue(message.metadata, `${path}.metadata`),
    ...(message.revision === undefined ? {} : { revision: expectRecord(message.revision, `${path}.revision`) }),
    createdAt: expectString(message.createdAt, `${path}.createdAt`),
    updatedAt: expectString(message.updatedAt, `${path}.updatedAt`),
  };
};

const parseWorkflowStatus = <T extends string>(value: unknown, allowed: readonly T[], path: string): T => {
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T;
  throw new ContractViolation(`${path} has an unsupported status`);
};

const parseAsset = (value: unknown, path: string): CanonicalAssetRecord => {
  const asset = expectRecord(value, path);
  const state = parseWorkflowStatus(asset.state, ['staging', 'ready', 'failed', 'abandoned', 'deleted'], `${path}.state`);
  return {
    id: expectString(asset.id, `${path}.id`),
    namespace: expectString(asset.namespace, `${path}.namespace`),
    mediaType: expectString(asset.mediaType, `${path}.mediaType`),
    byteLength: expectNumber(asset.byteLength, `${path}.byteLength`),
    digest: expectString(asset.digest, `${path}.digest`),
    state,
    createdAt: expectString(asset.createdAt, `${path}.createdAt`),
    ...(optionalString(asset.readyAt, `${path}.readyAt`) ? { readyAt: optionalString(asset.readyAt, `${path}.readyAt`) } : {}),
    ...(optionalString(asset.deletedAt, `${path}.deletedAt`) ? { deletedAt: optionalString(asset.deletedAt, `${path}.deletedAt`) } : {}),
    ...(asset.metadata === undefined ? {} : { metadata: expectRecord(asset.metadata, `${path}.metadata`) }),
  };
};

export const parseCanonicalMessagePage = (value: unknown): CanonicalMessagePage => {
  const document = expectRecord(value, 'message history response');
  if (!Array.isArray(document.data)) throw new ContractViolation('message history response.data must be an array');
  const included = expectRecord(document.included, 'message history response.included');
  const content = included.content;
  if (!Array.isArray(content)) {
    throw new ContractViolation('message history response.included must contain a content array');
  }
  const pageInfo = expectRecord(document.pageInfo, 'message history response.pageInfo');
  if (typeof pageInfo.hasMore !== 'boolean') throw new ContractViolation('message history response.pageInfo.hasMore must be a boolean');
  return {
    data: document.data.map((message, index) => parseMessage(message, `message history response.data[${index}]`)),
    included: {
      content: content.map((entry, index) => {
        const resolved = expectRecord(entry, `message history response.included.content[${index}]`);
        return {
          ref: parseContentRef(resolved.ref, `message history response.included.content[${index}].ref`),
          asset: parseAsset(resolved.asset, `message history response.included.content[${index}].asset`),
          base64: expectStringValue(resolved.base64, `message history response.included.content[${index}].base64`),
        };
      }),
    },
    pageInfo: {
      hasMore: pageInfo.hasMore,
      ...(optionalString(pageInfo.next, 'message history response.pageInfo.next')
        ? {
            next: optionalString(pageInfo.next, 'message history response.pageInfo.next'),
          }
        : {}),
    },
  };
};
