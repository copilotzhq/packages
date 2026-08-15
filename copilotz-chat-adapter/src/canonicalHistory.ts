import {
  ContractViolation,
  expectRecord,
  expectString,
  expectStringValue,
  isRecord,
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

export type CanonicalSafeWorkflowError = {
  name?: string;
  message: string;
  code?: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
};

export type CanonicalLlmAttempt = {
  id: string;
  namespace: string;
  threadId: string;
  messageId?: string;
  participantId?: string;
  initiatorParticipantId?: string;
  agentId?: string;
  provider?: string;
  model?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'superseded';
  attemptIndex: number;
  parentAttemptId?: string;
  inputMessageIds: string[];
  availableToolIds: string[];
  content: CanonicalContentRef[];
  finishReason?: string;
  usage?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  safeError?: CanonicalSafeWorkflowError;
  startedAt: string;
  finishedAt?: string;
  metricsFinalizedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CanonicalToolExecution = {
  id: string;
  namespace: string;
  threadId: string;
  messageId?: string;
  participantId?: string;
  agentId?: string;
  toolCallId: string;
  tool: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  content: CanonicalContentRef[];
  historyVisibility?: string;
  safeError?: CanonicalSafeWorkflowError;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  metadata: Record<string, unknown>;
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
  llmAttempts: CanonicalLlmAttempt[];
  toolExecutions: CanonicalToolExecution[];
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

const expectRecordValue = (value: unknown, path: string): Record<string, unknown> => (
  value === undefined || value === null ? {} : expectRecord(value, path)
);

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

const parseWorkflowStatus = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T => {
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T;
  throw new ContractViolation(`${path} has an unsupported status`);
};

const parseSafeError = (value: unknown, path: string): CanonicalSafeWorkflowError | undefined => {
  if (value === undefined || value === null) return undefined;
  const error = expectRecord(value, path);
  return {
    message: expectString(error.message, `${path}.message`),
    ...(optionalString(error.name, `${path}.name`) ? { name: optionalString(error.name, `${path}.name`) } : {}),
    ...(optionalString(error.code, `${path}.code`) ? { code: optionalString(error.code, `${path}.code`) } : {}),
    ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
    ...(error.metadata === undefined ? {} : { metadata: expectRecord(error.metadata, `${path}.metadata`) }),
  };
};

const parseLlmAttempt = (value: unknown, path: string): CanonicalLlmAttempt => {
  const attempt = expectRecord(value, path);
  return {
    id: expectString(attempt.id, `${path}.id`),
    namespace: expectString(attempt.namespace, `${path}.namespace`),
    threadId: expectString(attempt.threadId, `${path}.threadId`),
    ...(optionalString(attempt.messageId, `${path}.messageId`) ? { messageId: optionalString(attempt.messageId, `${path}.messageId`) } : {}),
    ...(optionalString(attempt.participantId, `${path}.participantId`) ? { participantId: optionalString(attempt.participantId, `${path}.participantId`) } : {}),
    ...(optionalString(attempt.initiatorParticipantId, `${path}.initiatorParticipantId`) ? { initiatorParticipantId: optionalString(attempt.initiatorParticipantId, `${path}.initiatorParticipantId`) } : {}),
    ...(optionalString(attempt.agentId, `${path}.agentId`) ? { agentId: optionalString(attempt.agentId, `${path}.agentId`) } : {}),
    ...(optionalString(attempt.provider, `${path}.provider`) ? { provider: optionalString(attempt.provider, `${path}.provider`) } : {}),
    ...(optionalString(attempt.model, `${path}.model`) ? { model: optionalString(attempt.model, `${path}.model`) } : {}),
    status: parseWorkflowStatus(attempt.status, ['pending', 'running', 'completed', 'failed', 'cancelled', 'superseded'], `${path}.status`),
    attemptIndex: expectNumber(attempt.attemptIndex, `${path}.attemptIndex`),
    ...(optionalString(attempt.parentAttemptId, `${path}.parentAttemptId`) ? { parentAttemptId: optionalString(attempt.parentAttemptId, `${path}.parentAttemptId`) } : {}),
    inputMessageIds: expectStringArray(attempt.inputMessageIds, `${path}.inputMessageIds`),
    availableToolIds: expectStringArray(attempt.availableToolIds, `${path}.availableToolIds`),
    content: parseContent(attempt.content, `${path}.content`),
    ...(optionalString(attempt.finishReason, `${path}.finishReason`) ? { finishReason: optionalString(attempt.finishReason, `${path}.finishReason`) } : {}),
    ...(isRecord(attempt.usage) ? { usage: attempt.usage } : {}),
    ...(isRecord(attempt.cost) ? { cost: attempt.cost } : {}),
    ...(parseSafeError(attempt.safeError, `${path}.safeError`) ? { safeError: parseSafeError(attempt.safeError, `${path}.safeError`) } : {}),
    startedAt: expectString(attempt.startedAt, `${path}.startedAt`),
    ...(optionalString(attempt.finishedAt, `${path}.finishedAt`) ? { finishedAt: optionalString(attempt.finishedAt, `${path}.finishedAt`) } : {}),
    ...(optionalString(attempt.metricsFinalizedAt, `${path}.metricsFinalizedAt`) ? { metricsFinalizedAt: optionalString(attempt.metricsFinalizedAt, `${path}.metricsFinalizedAt`) } : {}),
    metadata: expectRecordValue(attempt.metadata, `${path}.metadata`),
    createdAt: expectString(attempt.createdAt, `${path}.createdAt`),
    updatedAt: expectString(attempt.updatedAt, `${path}.updatedAt`),
  };
};

const parseToolExecution = (value: unknown, path: string): CanonicalToolExecution => {
  const execution = expectRecord(value, path);
  return {
    id: expectString(execution.id, `${path}.id`),
    namespace: expectString(execution.namespace, `${path}.namespace`),
    threadId: expectString(execution.threadId, `${path}.threadId`),
    ...(optionalString(execution.messageId, `${path}.messageId`) ? { messageId: optionalString(execution.messageId, `${path}.messageId`) } : {}),
    ...(optionalString(execution.participantId, `${path}.participantId`) ? { participantId: optionalString(execution.participantId, `${path}.participantId`) } : {}),
    ...(optionalString(execution.agentId, `${path}.agentId`) ? { agentId: optionalString(execution.agentId, `${path}.agentId`) } : {}),
    toolCallId: expectString(execution.toolCallId, `${path}.toolCallId`),
    tool: expectRecord(execution.tool, `${path}.tool`),
    status: parseWorkflowStatus(execution.status, ['pending', 'running', 'completed', 'failed', 'cancelled'], `${path}.status`),
    content: parseContent(execution.content, `${path}.content`),
    ...(optionalString(execution.historyVisibility, `${path}.historyVisibility`) ? { historyVisibility: optionalString(execution.historyVisibility, `${path}.historyVisibility`) } : {}),
    ...(parseSafeError(execution.safeError, `${path}.safeError`) ? { safeError: parseSafeError(execution.safeError, `${path}.safeError`) } : {}),
    startedAt: expectString(execution.startedAt, `${path}.startedAt`),
    ...(optionalString(execution.finishedAt, `${path}.finishedAt`) ? { finishedAt: optionalString(execution.finishedAt, `${path}.finishedAt`) } : {}),
    ...(typeof execution.durationMs === 'number' ? { durationMs: execution.durationMs } : {}),
    metadata: expectRecordValue(execution.metadata, `${path}.metadata`),
    createdAt: expectString(execution.createdAt, `${path}.createdAt`),
    updatedAt: expectString(execution.updatedAt, `${path}.updatedAt`),
  };
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
  const llmAttempts = included.llmAttempts;
  const toolExecutions = included.toolExecutions;
  const content = included.content;
  if (!Array.isArray(llmAttempts) || !Array.isArray(toolExecutions) || !Array.isArray(content)) {
    throw new ContractViolation('message history response.included must contain llmAttempts, toolExecutions, and content arrays');
  }
  const pageInfo = expectRecord(document.pageInfo, 'message history response.pageInfo');
  if (typeof pageInfo.hasMore !== 'boolean') throw new ContractViolation('message history response.pageInfo.hasMore must be a boolean');
  return {
    data: document.data.map((message, index) => parseMessage(message, `message history response.data[${index}]`)),
    included: {
      llmAttempts: llmAttempts.map((attempt, index) => parseLlmAttempt(attempt, `message history response.included.llmAttempts[${index}]`)),
      toolExecutions: toolExecutions.map((execution, index) => parseToolExecution(execution, `message history response.included.toolExecutions[${index}]`)),
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
      ...(optionalString(pageInfo.next, 'message history response.pageInfo.next') ? { next: optionalString(pageInfo.next, 'message history response.pageInfo.next') } : {}),
    },
  };
};
