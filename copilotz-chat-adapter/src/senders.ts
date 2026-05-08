import type { AgentOption, ChatSender } from '@copilotz/chat-ui';
import {
  ContractViolation,
  expectOptionalString,
  expectRecord,
  expectString,
  isRecord,
} from './contract.ts';

type SenderType = ChatSender['type'];
type AgentIdentity = { id?: string | null; name?: string | null };
type UserIdentity = { id: string; name?: string | null; avatarUrl?: string | null };

type ServerMessageLike = {
  senderId: string | null;
  senderType: string;
  senderUserId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SenderResolutionOptions = {
  agents?: AgentOption[];
  user?: UserIdentity | null;
  assistantName?: string | null;
};

const clean = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const expectSenderType = (value: unknown, path: string): SenderType => {
  if (value === 'user' || value === 'agent' || value === 'tool' || value === 'system') return value;
  throw new ContractViolation(`${path} must be user, agent, tool, or system`);
};

const defined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;

const findAgent = (
  agents: AgentOption[] | undefined,
  ...candidates: Array<string | undefined>
): AgentOption | undefined => {
  const values = candidates.filter(Boolean).map((value) => value!.toLowerCase());
  if (!agents || values.length === 0) return undefined;
  return agents.find((agent) =>
    values.includes(agent.id.toLowerCase()) ||
    values.includes(agent.name.toLowerCase())
  );
};

const fromAgent = (
  agent: AgentOption,
  overrides: Partial<ChatSender> = {},
): ChatSender => defined({
  type: overrides.type ?? 'agent',
  id: agent.id,
  name: agent.name,
  agentId: agent.id,
  avatarUrl: agent.avatarUrl,
  color: agent.color,
  ...overrides,
});

export const resolveUserSender = (user: UserIdentity): ChatSender => defined({
  type: 'user',
  id: user.id,
  externalId: user.id,
  name: clean(user.name) ?? user.id,
  avatarUrl: clean(user.avatarUrl),
});

export const resolveAssistantFallbackSender = (
  options: SenderResolutionOptions = {},
): ChatSender => ({
  type: 'agent',
  id: 'assistant',
  name: clean(options.assistantName) ?? 'Assistant',
  agentId: 'assistant',
});

export const resolveAgentSender = (
  identity: AgentIdentity,
  options: SenderResolutionOptions = {},
  overrides: Partial<ChatSender> = {},
): ChatSender => {
  const id = expectString(identity.id, 'agent.id');
  const name = expectString(identity.name, 'agent.name');
  const agent = findAgent(options.agents, id, name);
  if (agent) {
    return fromAgent(agent, defined({
      ...overrides,
      externalId: id && id !== agent.id ? id : undefined,
    }));
  }

  return defined({
    type: overrides.type ?? 'agent',
    id,
    name,
    agentId: id,
    ...overrides,
  });
};

export const resolveHydratedMessageSender = (
  message: ServerMessageLike,
  options: SenderResolutionOptions = {},
): ChatSender => {
  const metadata = message.metadata ? expectRecord(message.metadata, 'message.metadata') : {};
  const type = expectSenderType(message.senderType, 'message.senderType');
  const storedId = expectOptionalString(message.senderId, 'message.senderId');
  const participantId = expectOptionalString(metadata.senderParticipantId, 'message.metadata.senderParticipantId') ??
    expectOptionalString(message.senderUserId, 'message.senderUserId');
  const externalId = expectString(metadata.senderExternalId, 'message.metadata.senderExternalId');
  const displayName = expectString(metadata.senderDisplayName, 'message.metadata.senderDisplayName');

  if (type === 'agent' || type === 'tool') {
    const agent = findAgent(options.agents, externalId, displayName, storedId);
    if (agent) {
      return fromAgent(agent, defined({
        type,
        participantId: participantId ?? storedId,
        externalId: externalId && externalId !== agent.id ? externalId : undefined,
      }));
    }

    return defined({
      type,
      id: externalId,
      name: displayName,
      agentId: externalId,
      participantId: participantId ?? storedId,
      externalId,
    });
  }

  if (type === 'user') {
    return defined({
      type: 'user',
      id: externalId,
      externalId,
      name: displayName,
      avatarUrl: clean(options.user?.avatarUrl),
      participantId: participantId ?? storedId,
    });
  }

  return defined({
    type: 'system',
    id: externalId,
    name: displayName,
    participantId: participantId ?? storedId,
    externalId,
  });
};

export const resolveLiveEventSender = (
  event: unknown,
  options: SenderResolutionOptions = {},
): ChatSender => {
  const raw = expectRecord(event, 'stream event');
  const payload = raw.payload === undefined ? raw : expectRecord(raw.payload, 'stream event.payload');
  const agent = payload.agent ?? raw.agent;
  if (isRecord(agent)) {
    return resolveAgentSender({
      id: expectString(agent.id, 'stream event.payload.agent.id'),
      name: expectString(agent.name, 'stream event.payload.agent.name'),
    }, options);
  }

  const sender = payload.sender ?? raw.sender;
  if (!isRecord(sender)) {
    throw new ContractViolation('stream event sender contract requires payload.agent or payload.sender');
  }

  const type = expectSenderType(sender.type ?? payload.senderType, 'stream event.payload.sender.type');
  if (type !== 'user') {
    return resolveAgentSender({
      id: expectString(sender.id ?? sender.externalId, 'stream event.payload.sender.id'),
      name: expectString(sender.name, 'stream event.payload.sender.name'),
    }, options, { type });
  }

  if (!options.user) {
    throw new ContractViolation('user stream sender requires current user context');
  }
  return resolveUserSender(options.user);
};
