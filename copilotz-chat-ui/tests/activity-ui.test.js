import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AssistantActivity,
  AskToolRenderer,
  ChatUI,
  ChatUserContextProvider,
  SpaceView,
  defaultChatConfig,
  formatToolDetailValue,
  mergeConfig,
  resolveActivityStableId,
  resolveMessageSenderDisplay,
  resolveToolRenderer,
} from '../dist/index.js';

test('mergeConfig enables activity timeline by default', () => {
  const config = mergeConfig(defaultChatConfig, undefined);
  assert.equal(config.features.showActivity, true);
  assert.equal(config.features.showActivityDetails, true);
});

test('header participant renderer receives participant state and callback', () => {
  globalThis.window = { innerWidth: 1024 };
  globalThis.document = {
    cookie: '',
    documentElement: { classList: { contains: () => false } },
  };
  let context;
  const onParticipantsChange = (ids) => {
    context.changedIds = ids;
  };
  const html = renderToStaticMarkup(
    React.createElement(
      ChatUserContextProvider,
      { initial: {} },
      React.createElement(ChatUI, {
        config: {
          agentSelector: {
          enabled: true,
          mode: 'multi',
          hideIfSingle: false,
            renderParticipants: (value) => {
              context = value;
              return React.createElement('button', { type: 'button' }, 'Team picker');
            },
          },
        },
        agentOptions: [{ id: 'north', name: 'North' }],
        participantIds: ['north'],
        onParticipantsChange,
      }),
    ),
  );

  assert.match(html, /Team picker/);
  assert.deepEqual(context.agents.map((agent) => agent.id), ['north']);
  assert.deepEqual([...context.participantIds], ['north']);
  context.onParticipantsChange(['south']);
  assert.deepEqual(context.changedIds, ['south']);
});

test('mergeConfig enables Spaces navigation by default', () => {
  const config = mergeConfig(defaultChatConfig, undefined);
  assert.equal(config.features.spaces.enabled, true);
  assert.equal(config.features.spaces.groupingEnabled, true);
  assert.equal(config.features.spaces.allowCreate, true);
  assert.equal(config.features.spaces.allowDrag, true);
});

test('mergeConfig preserves Space defaults for partial overrides', () => {
  const config = mergeConfig(defaultChatConfig, {
    features: {
      spaces: {
        defaultGroupBy: 'space',
      },
    },
  });

  assert.equal(config.features.spaces.enabled, true);
  assert.equal(config.features.spaces.groupingEnabled, true);
  assert.equal(config.features.spaces.defaultGroupBy, 'space');
  assert.equal(config.features.spaces.allowCreate, true);
  assert.equal(config.features.spaces.allowDrag, true);
});

test('mergeConfig allows consumers to disable Spaces navigation', () => {
  const config = mergeConfig(defaultChatConfig, {
    features: {
      spaces: {
        enabled: false,
      },
    },
  });

  assert.equal(config.features.spaces.enabled, false);
  assert.equal(config.features.spaces.groupingEnabled, true);
});

test('native SpaceView shows only supplied default data sources', () => {
  const html = renderToStaticMarkup(
    React.createElement(SpaceView, {
      space: { id: 'research', name: 'Research', description: 'Shared **work**' },
      data: {
        conversations: {
          status: 'ready',
          items: [{ id: 'thread-a', title: 'Plan', createdAt: 0, updatedAt: 0, messageCount: 0 }],
        },
      },
      selectedSection: 'conversations',
    }),
  );
  assert.match(html, /Overview/);
  assert.match(html, /Conversations/);
  assert.match(html, /Plan/);
  assert.doesNotMatch(html, />Members</);
  assert.doesNotMatch(html, /Edit Space/);
  const overviewHtml = renderToStaticMarkup(
    React.createElement(SpaceView, {
      space: { id: 'research', name: 'Research', description: 'Shared **work**' },
    }),
  );
  assert.match(overviewHtml, /<strong>work<\/strong>/);
});

test('native SpaceView keeps data-only Spaces read-only and omits empty tabs', () => {
  const html = renderToStaticMarkup(
    React.createElement(SpaceView, {
      space: { id: 'research', name: 'Research', description: 'Read only' },
      canEditSpace: true,
    }),
  );
  assert.match(html, /Overview/);
  assert.doesNotMatch(html, />Conversations</);
  assert.doesNotMatch(html, />Members</);
  assert.doesNotMatch(html, /Edit Space/);
});

test('Space main view suppresses conversation-only header controls', () => {
  globalThis.window = { innerWidth: 1024 };
  globalThis.document = {
    cookie: '',
    documentElement: { classList: { contains: () => false } },
  };
  const html = renderToStaticMarkup(
    React.createElement(ChatUI, {
      selectedSpaceId: 'research',
      spaces: [{ id: 'research', name: 'Research' }],
      agentOptions: [{ id: 'north', name: 'North' }],
      onSelectAgent: () => {},
      callbacks: { onCreateThread: () => {} },
      config: {
        agentSelector: { enabled: true },
        customComponent: {
          component: React.createElement('div', null, 'Custom panel'),
          label: 'Open custom panel',
        },
        headerActions: React.createElement('span', null, 'Thread action'),
        headerMenuItems: [{ id: 'thread-action', label: 'Thread menu action', onSelect: () => {} }],
      },
    }),
  );

  assert.match(html, /Research/);
  assert.match(html, /Overview/);
  assert.doesNotMatch(html, /North/);
  assert.doesNotMatch(html, /Open custom panel/);
  assert.doesNotMatch(html, /Thread action/);
  assert.doesNotMatch(html, /Thread menu action/);
  assert.doesNotMatch(html, /New Thread/);
});

test('Chat navigation exposes mode selector and mode-aware search affordances', () => {
  globalThis.window = { innerWidth: 1024 };
  globalThis.document = {
    cookie: '',
    documentElement: { classList: { contains: () => false } },
  };
  const html = renderToStaticMarkup(
    React.createElement(
      ChatUserContextProvider,
      { initial: {} },
      React.createElement(ChatUI, {
        spaces: [{ id: 'research', name: 'Research' }],
        callbacks: {
          onCreateThread: () => {},
          onCreateSpace: async () => ({ id: 'new', name: 'New' }),
        },
      }),
    ),
  );

  assert.match(html, /aria-label="Navigation"/);
  assert.match(html, />Chats</);
  assert.match(html, />Spaces</);
  assert.match(html, /placeholder="Search conversations\.\.\."/);
  assert.match(html, /New Conversation/);
  assert.doesNotMatch(html, /Create Space<\/button>/);
});

test('Space view keeps its title in the global header and uses a compact conversation list', () => {
  globalThis.window = { innerWidth: 1024 };
  globalThis.document = {
    cookie: '',
    documentElement: { classList: { contains: () => false } },
  };
  const standalone = renderToStaticMarkup(
    React.createElement(SpaceView, {
      space: { id: 'research', name: 'Research' },
      data: {
        conversations: {
          status: 'ready',
          items: [{ id: 'thread-a', title: 'Plan', createdAt: 0, updatedAt: 0, messageCount: 0 }],
        },
      },
      selectedSection: 'conversations',
    }),
  );
  assert.doesNotMatch(standalone, /<header/);
  assert.match(standalone, /max-w-2xl/);
  assert.match(standalone, />1 conversation</);

  const chatView = renderToStaticMarkup(
    React.createElement(ChatUI, {
      selectedSpaceId: 'research',
      spaces: [{ id: 'research', name: 'Research' }],
    }),
  );
  assert.match(chatView, /aria-label="Back to conversation"/);
});

test('unknown controlled Space selection stays explicit instead of falling back to chat', () => {
  const html = renderToStaticMarkup(
    React.createElement(ChatUI, {
      selectedSpaceId: 'missing',
      spaces: [{ id: 'missing', name: 'Cached Space' }],
      spaceViewSpace: null,
      spaceViewStatus: { isLoading: false },
    }),
  );

  assert.match(html, /This Space is unavailable\./);
  assert.match(html, /Back to conversation/);
  assert.doesNotMatch(html, /Cached Space/);
  assert.doesNotMatch(html, /Loading Space…/);
});

test('managed empty member lists keep the add control available', () => {
  const html = renderToStaticMarkup(
    React.createElement(SpaceView, {
      space: { id: 'research', name: 'Research' },
      data: { members: { status: 'empty', items: [] } },
      selectedSection: 'members',
      canManageMembers: true,
      onAddMember: async () => {},
    }),
  );

  assert.match(html, /Member id/);
  assert.match(html, />Add</);
  assert.match(html, /No members yet/);
});

test('AssistantActivity renders generic timeline labels', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      labels: {
        activityThinkingActive: 'Pensando',
      },
      activity: {
        items: [{
          id: 'thinking',
          kind: 'thinking',
          status: 'active',
          details: { reasoning: 'Internal reasoning' },
        }],
      },
    }),
  );

  assert.match(html, /Pensando/);
  assert.doesNotMatch(html, /Internal reasoning/);
});

test('AssistantActivity interpolates customized tool labels', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      labels: {
        activityToolComplete: 'Usou {{tool}}',
      },
      activity: {
        items: [{
          id: 'tool-1',
          kind: 'tool',
          status: 'complete',
          toolName: 'kanban',
        }],
      },
    }),
  );

  assert.match(html, /Usou kanban/);
});

test('tool renderer registry uses exact names and preserves JSON fallback formatting', () => {
  const TerminalRenderer = () => null;
  const renderers = { terminal: TerminalRenderer };

  assert.equal(resolveToolRenderer('terminal', renderers), TerminalRenderer);
  assert.equal(resolveToolRenderer('Terminal', renderers), undefined);
  assert.equal(resolveToolRenderer('search', renderers), undefined);
  assert.equal(
    formatToolDetailValue({ query: 'evidence' }),
    '{\n  "query": "evidence"\n}',
  );
});

test('built-in ask renderer presents a public agent mention and remains overridable', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      agents: [{ id: 'east', name: 'East', color: '#84cc16' }],
      activity: {
        items: [{
          id: 'call-ask',
          kind: 'tool',
          status: 'active',
          toolId: 'ask',
          toolName: 'Ask Agent',
          details: {
            toolCall: {
              id: 'call-ask',
              toolId: 'ask',
              name: 'Ask Agent',
              arguments: { target: 'east', message: 'Review this plan.' },
              status: 'running',
            },
          },
        }],
      },
    }),
  );
  assert.match(html, /@East/);
  assert.match(html, /Review this plan\./);
  assert.doesNotMatch(html, /Using Ask Agent/);
  assert.equal(resolveToolRenderer('ask', undefined), AskToolRenderer);

  const Override = () => React.createElement('div', null, 'Custom ask');
  assert.equal(resolveToolRenderer('ask', { ask: Override }), Override);
});

test('tool activity keeps one expansion identity across draft reconciliation', () => {
  assert.equal(resolveActivityStableId({
    id: 'tool-draft:draft-1',
    kind: 'tool',
    status: 'active',
    details: { toolCallDraftId: 'draft-1' },
  }), 'tool-draft:draft-1');
  assert.equal(resolveActivityStableId({
    id: 'call-1',
    kind: 'tool',
    status: 'active',
    details: {
      toolCallDraftId: 'draft-1',
      toolCall: {
        id: 'call-1',
        name: 'terminal',
        arguments: { stdin: 'pwd' },
        status: 'running',
      },
    },
  }), 'tool-draft:draft-1');
});

test('AssistantActivity renders skeleton when activity is disabled during active work', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      showActivity: false,
      activity: {
        items: [{
          id: 'answering',
          kind: 'answering',
          status: 'active',
        }],
      },
    }),
  );

  assert.match(html, /animate-pulse/);
});

test('AssistantActivity hides inactive activity when activity is disabled', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      showActivity: false,
      activity: {
        items: [{
          id: 'thinking',
          kind: 'thinking',
          status: 'complete',
        }],
      },
    }),
  );

  assert.equal(html, '');
});

test('resolveMessageSenderDisplay never exposes participant ids as display names', () => {
  const display = resolveMessageSenderDisplay({
    fallbackName: 'Assistant',
    sender: {
      type: 'agent',
      id: 'east',
      name: 'East',
      participantId: '01KQVCMZZE8W5Z99E94VP3EYWN',
      color: '#84cc16',
    },
  });

  assert.equal(display.name, 'East');
  assert.equal(display.color, '#84cc16');
});
