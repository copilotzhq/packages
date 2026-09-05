import type { AgentOption, ChatSender } from '@copilotz/chat-ui';
import {
  ContractViolation,
  expectRecord,
  expectString,
  isRecord
} from './contract.ts';
import type { CanonicalParticipant } from './canonicalHistory.ts';

type SenderType = ChatSender['type'];
type AgentIdentity = { id?: string | null; name?: string | null };
type UserIdentity = {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
};

export type SenderResolutionOptions = {
  agents?: AgentOption[];
  user?: UserIdentity | null;
  assistantName?: string | null;
};

const clean = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;

const expectSenderType = (value: unknown, path: string): SenderType => {
  if (
    value === 'user' ||
    value === 'agent' ||
    value === 'tool' ||
    value === 'system' ||
    value === 'job'
  )
    return value;
  throw new ContractViolation(
    `${path} must be user, agent, tool, system, or job`
  );
};

const defined = <const T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;

const findAgent = (
  agents: AgentOption[] | undefined,
  ...candidates: Array<string | undefined>
): AgentOption | undefined => {
  const values = candidates
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  if (!agents || values.length === 0) return undefined;
  return agents.find(
    (agent) =>
      values.includes(agent.id.toLowerCase()) ||
      values.includes(agent.name.toLowerCase())
  );
};

const fromAgent = (
  agent: AgentOption,
  overrides: Partial<ChatSender> = {}
): ChatSender =>
  defined({
    type: overrides.type ?? 'agent',
    id: agent.id,
    name: agent.name,
    agentId: agent.id,
    avatarUrl: agent.avatarUrl,
    color: agent.color,
    ...overrides
  });

export const resolveUserSender = (user: UserIdentity): ChatSender =>
  defined({
    type: 'user',
    id: user.id,
    externalId: user.id,
    name: clean(user.name) ?? user.id,
    avatarUrl: clean(user.avatarUrl)
  });

export const resolveAssistantFallbackSender = (
  options: SenderResolutionOptions = {}
): ChatSender => ({
  type: 'agent',
  id: 'assistant',
  name: clean(options.assistantName) ?? 'Assistant',
  agentId: 'assistant'
});

export const resolveAgentSender = (
  identity: AgentIdentity,
  options: SenderResolutionOptions = {},
  overrides: Partial<ChatSender> = {}
): ChatSender => {
  const id = expectString(identity.id, 'agent.id');
  const name = expectString(identity.name, 'agent.name');
  const agent = findAgent(options.agents, id, name);
  if (agent) {
    return fromAgent(
      agent,
      defined({
        ...overrides,
        externalId: id && id !== agent.id ? id : undefined
      })
    );
  }

  return defined({
    type: overrides.type ?? 'agent',
    id,
    name,
    agentId: id,
    ...overrides
  });
};

export const resolveCanonicalParticipantSender = (
  participant: CanonicalParticipant,
  options: SenderResolutionOptions = {}
): ChatSender => {
  const type = expectSenderType(
    participant.participantType === 'human'
      ? 'user'
      : participant.participantType,
    'participant.participantType'
  );
  const participantId = expectString(participant.id, 'participant.id');
  const externalId = expectString(
    participant.externalId,
    'participant.externalId'
  );
  const displayName = expectString(
    participant.name ?? participant.agentId ?? participant.externalId,
    'participant.name'
  );

  if (type === 'agent' || type === 'tool' || type === 'job') {
    const agent = findAgent(
      options.agents,
      participant.agentId,
      externalId,
      displayName,
      participantId
    );
    if (agent) {
      return fromAgent(
        agent,
        defined({
          type,
          participantId,
          externalId:
            externalId && externalId !== agent.id ? externalId : undefined
        })
      );
    }

    return defined({
      type,
      id: externalId,
      name: displayName,
      agentId: participant.agentId ?? externalId,
      participantId,
      externalId
    });
  }

  if (type === 'user') {
    const isCurrentUser =
      options.user?.id === externalId || options.user?.id === participantId;
    const currentUserName = isCurrentUser
      ? clean(options.user?.name)
      : undefined;

    return defined({
      type: 'user',
      id: externalId,
      externalId,
      name: currentUserName ?? displayName,
      avatarUrl: clean(options.user?.avatarUrl),
      participantId
    });
  }

  return defined({
    type: 'system',
    id: externalId,
    name: displayName,
    participantId,
    externalId
  });
};

export const resolveLiveEventSender = (
  event: unknown,
  options: SenderResolutionOptions = {}
): ChatSender => {
  const raw = expectRecord(event, 'stream event');
  const payload =
    raw.payload === undefined
      ? raw
      : expectRecord(raw.payload, 'stream event.payload');
  const agent = payload.agent ?? raw.agent;
  if (isRecord(agent)) {
    return resolveAgentSender(
      {
        id: expectString(agent.id, 'stream event.payload.agent.id'),
        name: expectString(agent.name, 'stream event.payload.agent.name')
      },
      options
    );
  }

  const sender = payload.sender ?? raw.sender;
  if (!isRecord(sender)) {
    throw new ContractViolation(
      'stream event sender contract requires payload.agent or payload.sender'
    );
  }

  const type = expectSenderType(
    sender.type ?? payload.senderType,
    'stream event.payload.sender.type'
  );
  if (type !== 'user') {
    return resolveAgentSender(
      {
        id: expectString(
          sender.id ?? sender.externalId,
          'stream event.payload.sender.id'
        ),
        name: expectString(sender.name, 'stream event.payload.sender.name')
      },
      options,
      { type }
    );
  }

  if (!options.user) {
    throw new ContractViolation(
      'user stream sender requires current user context'
    );
  }
  return resolveUserSender(options.user);
};
