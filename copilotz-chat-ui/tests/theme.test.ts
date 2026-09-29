import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDarkMode } from '../src/lib/theme.ts';

test('a configured theme applies when nothing is saved', () => {
  assert.equal(resolveDarkMode('dark', null, false), true);
  assert.equal(resolveDarkMode('light', null, true), false);
});

test('auto follows the system', () => {
  assert.equal(resolveDarkMode('auto', null, true), true);
  assert.equal(resolveDarkMode('auto', null, false), false);
});

test('a saved toggle choice wins over the configured default', () => {
  assert.equal(resolveDarkMode('dark', 'light', true), false);
  assert.equal(resolveDarkMode('light', 'dark', false), true);
});

test('an unknown saved value is ignored', () => {
  assert.equal(resolveDarkMode('dark', 'system', false), true);
});
