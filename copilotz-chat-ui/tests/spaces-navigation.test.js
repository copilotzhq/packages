import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatUI, ChatUserContextProvider } from '../dist/index.js';

const space = { id: 'research', name: 'Research' };
const thread = {
  id: 'conversation',
  title: 'Course conversation',
  spaceId: space.id,
  createdAt: 0,
  updatedAt: 0,
  messageCount: 0,
};
const disabledConfig = { features: { spaces: { enabled: false } } };

const renderChat = (props = {}) => {
  globalThis.window = { innerWidth: 1024 };
  globalThis.document = {
    cookie: '',
    documentElement: { classList: { contains: () => false } },
  };
  return renderToStaticMarkup(
    React.createElement(
      ChatUserContextProvider,
      { initial: {} },
      React.createElement(ChatUI, { threads: [thread], ...props }),
    ),
  );
};

test('disabled Spaces hides the entire navigation switch and keeps chats visible', () => {
  const html = renderChat({ config: disabledConfig });

  assert.doesNotMatch(html, /aria-label="Navigation"/);
  assert.doesNotMatch(html, />Spaces<\/button>/);
  assert.doesNotMatch(html, />Chats<\/button>/);
  assert.match(html, /Course conversation/);
  assert.match(html, /placeholder="Search conversations\.\.\."/);
});

test('disabled Spaces hides supplied Space data and ignores a stale Space selection', () => {
  const html = renderChat({
    config: {
      features: { spaces: { enabled: false, defaultGroupBy: 'space' } },
      headerActions: React.createElement('span', null, 'Conversation action'),
    },
    spaces: [space],
    selectedSpaceId: space.id,
    spaceViewSpace: space,
    callbacks: {
      onCreateSpace: async () => space,
      onManageSpace: () => {},
      onMoveThreadToSpace: () => {},
    },
  });

  assert.doesNotMatch(html, /aria-label="Navigation"/);
  assert.doesNotMatch(html, /Research/);
  assert.doesNotMatch(html, /Back to conversation/);
  assert.doesNotMatch(html, /Overview/);
  assert.doesNotMatch(html, /data-touch-drag-handle/);
  assert.match(html, /Course conversation/);
  assert.match(html, /Conversation action/);
});

test('disabled Spaces ignores an unavailable controlled Space selection', () => {
  const html = renderChat({
    config: disabledConfig,
    selectedSpaceId: 'missing',
    spaceViewSpace: null,
    spaceViewStatus: { isLoading: false },
  });

  assert.doesNotMatch(html, /This Space is unavailable/);
  assert.doesNotMatch(html, /Back to conversation/);
  assert.match(html, /placeholder="Type your message/);
});

test('enabled and available Spaces preserves the navigation switch and Space indicators', () => {
  const html = renderChat({
    config: { features: { spaces: { enabled: true } } },
    spaces: [space],
  });

  assert.match(html, /aria-label="Navigation"/);
  assert.match(html, /aria-pressed="true"[^>]*>Chats<\/button>/);
  assert.match(html, /aria-pressed="false"[^>]*>Spaces<\/button>/);
  assert.match(html, /aria-label="Space: Research"/);
});

test('Spaces callbacks make the navigation switch available without Space records', () => {
  const html = renderChat({ callbacks: { onCreateSpace: async () => space } });

  assert.match(html, /aria-label="Navigation"/);
  assert.match(html, />Spaces<\/button>/);
});

test('unavailable Spaces hides the navigation switch even when enabled', () => {
  const html = renderChat({ config: { features: { spaces: { enabled: true } } } });

  assert.doesNotMatch(html, /aria-label="Navigation"/);
  assert.doesNotMatch(html, />Spaces<\/button>/);
  assert.match(html, /Course conversation/);
});
