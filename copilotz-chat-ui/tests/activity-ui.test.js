import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AssistantActivity,
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

test('mergeConfig enables thread tags by default', () => {
  const config = mergeConfig(defaultChatConfig, undefined);
  assert.equal(config.features.threadTags.enabled, true);
  assert.equal(config.features.threadTags.groupingEnabled, true);
  assert.equal(config.features.threadTags.allowCreate, true);
  assert.equal(config.features.threadTags.allowDrag, true);
});

test('mergeConfig preserves thread tag defaults for partial overrides', () => {
  const config = mergeConfig(defaultChatConfig, {
    features: {
      threadTags: {
        defaultGroupBy: 'tag',
      },
    },
  });

  assert.equal(config.features.threadTags.enabled, true);
  assert.equal(config.features.threadTags.groupingEnabled, true);
  assert.equal(config.features.threadTags.defaultGroupBy, 'tag');
  assert.equal(config.features.threadTags.allowCreate, true);
  assert.equal(config.features.threadTags.allowDrag, true);
});

test('mergeConfig allows consumers to disable thread tags', () => {
  const config = mergeConfig(defaultChatConfig, {
    features: {
      threadTags: {
        enabled: false,
      },
    },
  });

  assert.equal(config.features.threadTags.enabled, false);
  assert.equal(config.features.threadTags.groupingEnabled, true);
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
