import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultChatConfig, mergeConfig } from '../dist/index.js';
import { loadTsx } from './helpers/load-tsx.js';

const { SpaceCreateForm } = await loadTsx(new URL('../src/components/chat/SpaceCreateForm.tsx', import.meta.url));
const { Input } = await loadTsx(new URL('../src/components/ui/input.tsx', import.meta.url));
const renderForm = (props = {}) => renderToStaticMarkup(
  React.createElement(SpaceCreateForm, {
    name: 'Lançamento do curso',
    onNameChange: () => {},
    working: false,
    onCreate: () => {},
    onCancel: () => {},
    ...props,
  }),
);
const classes = (tag) => new Set(tag.match(/class="([^"]*)"/)[1].split(/\s+/));

test('inline Space confirmation uses its own compact default label', () => {
  const html = renderForm({ labels: defaultChatConfig.labels });

  assert.match(html, />Create<\/button>/);
  assert.doesNotMatch(html, /Create Conversation/);
  assert.equal(defaultChatConfig.labels.createSpaceConfirm, 'Create');
  assert.equal(defaultChatConfig.labels.create, 'Create Conversation');
  assert.equal(defaultChatConfig.labels.createSpace, 'Create Space');
});

test('inline Space confirmation supports a custom label and preserves existing labels', () => {
  const config = mergeConfig(defaultChatConfig, {
    labels: {
      createSpaceConfirm: 'Criar',
      create: 'Criar conversa',
      createSpace: 'Criar espaço',
      newSpace: 'Novo espaço',
    },
  });
  const html = renderForm({ labels: config.labels });

  assert.match(html, />Criar<\/button>/);
  assert.doesNotMatch(html, /Criar conversa|Criar espaço|Novo espaço/);
  assert.equal(config.labels.create, 'Criar conversa');
  assert.equal(config.labels.createSpace, 'Criar espaço');
  assert.equal(config.labels.newSpace, 'Novo espaço');
});

test('inline Space confirmation falls back without borrowing legacy labels', () => {
  for (const labels of [undefined, { create: 'Create Conversation' }, { createSpaceConfirm: '' }]) {
    assert.match(renderForm({ labels }), />Create<\/button>/);
  }
});

test('inline Space name takes the remaining row width alongside fixed-size actions', () => {
  const html = renderForm();
  const rowClasses = classes(html.match(/<div\b[^>]*>/)[0]);
  const inputClasses = classes(html.match(/<input\b[^>]*>/)[0]);

  assert.ok(rowClasses.has('flex'));
  assert.ok(rowClasses.has('min-w-0'));
  assert.ok(inputClasses.has('min-w-0'));
  assert.ok(inputClasses.has('flex-1'));
  for (const button of html.matchAll(/<button\b[^>]*>/g)) {
    assert.ok(classes(button[0]).has('shrink-0'));
  }
});

test('inline Space name renders Unicode unchanged with an explicit text type', () => {
  const html = renderForm();

  assert.match(html, /<input type="text"/);
  assert.match(html, /value="Lançamento do curso"/);
});

// SSR cannot model Chromium selection. This guards the cause: an omitted type
// makes React removeAttribute('type') during each controlled input update.
test('shared Input keeps an explicit text type for every Unicode prefix', () => {
  let value = '';
  for (const char of 'Lançamento do curso') {
    value += char;
    const html = renderToStaticMarkup(React.createElement(Input, { value, onChange: () => {} }));
    assert.match(html, /<input type="text"/);
    assert.ok(html.includes(`value="${value}"`));
  }
});

test('shared Input preserves explicit non-text types', () => {
  for (const type of ['email', 'password', 'number', 'file']) {
    const html = renderToStaticMarkup(React.createElement(Input, { type }));
    assert.ok(html.includes(`type="${type}"`));
  }
});
