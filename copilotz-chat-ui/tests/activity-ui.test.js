import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantActivity, defaultChatConfig, mergeConfig, resolveMessageSenderDisplay } from '../dist/index.js';

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
