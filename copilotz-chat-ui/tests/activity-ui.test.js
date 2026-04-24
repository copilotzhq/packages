import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantActivity, defaultChatConfig, mergeConfig } from '../dist/index.js';

test('mergeConfig keeps activityDisplay full by default', () => {
  const config = mergeConfig(defaultChatConfig, undefined);
  assert.equal(config.features.activityDisplay, 'full');
});

test('AssistantActivity renders compact summary in summary mode', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      displayMode: 'summary',
      labels: {
        activityThinking: 'Thinking now...',
      },
      activity: {
        isActive: true,
        summary: { kind: 'thinking' },
        reasoning: 'Internal reasoning',
      },
    }),
  );

  assert.match(html, /Thinking now\.\.\./);
  assert.match(html, /w-full/);
  assert.doesNotMatch(html, /Internal reasoning/);
});

test('AssistantActivity hides completed historical activity in summary mode', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      displayMode: 'summary',
      labels: {
        activityThinking: 'Co-criando...',
      },
      activity: {
        isActive: false,
        isComplete: true,
        summary: { kind: 'thinking' },
        reasoning: 'Persisted reasoning',
      },
    }),
  );

  assert.equal(html, '');
});

test('AssistantActivity renders loader only in hidden mode', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      displayMode: 'hidden',
      activity: {
        isActive: true,
        summary: { kind: 'working' },
      },
    }),
  );

  assert.match(html, /animate-pulse/);
});

test('AssistantActivity renders collapsed details affordance in full mode', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      displayMode: 'full',
      activity: {
        isActive: false,
        isComplete: true,
        summary: { kind: 'using_tools', toolName: 'instagramProfile' },
        reasoning: 'Reasoning trace',
        toolCalls: [{
          id: 'tool-1',
          name: 'instagramProfile',
          arguments: { username: 'gil' },
          result: { ok: true },
          status: 'completed',
        }],
      },
    }),
  );

  assert.match(html, /instagramProfile/);
  assert.match(html, /Show details/);
});

test('AssistantActivity keeps the same header grid when no details are available', () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistantActivity, {
      displayMode: 'full',
      activity: {
        isActive: false,
        isComplete: true,
        summary: { kind: 'thinking' },
      },
    }),
  );

  assert.match(html, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(html, /invisible/);
});
