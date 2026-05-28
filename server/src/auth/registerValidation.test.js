import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration } from './registerValidation.js';

const rankTable = [{ rank: 'Diamond' }, { rank: 'Gold' }];
const ok = { username: 'newplayer', password: 'secret1', name: 'New Player', inGameName: 'NP#1', rank: 'Gold', role: 'Duelist' };

test('accepts a complete valid registration and normalizes fields', () => {
  const { account, player } = validateRegistration(ok, rankTable);
  assert.equal(account.username, 'newplayer');
  assert.equal(account.role, 'player');
  assert.equal(account.displayName, 'New Player');
  assert.equal(player.rank, 'Gold');
  assert.equal(player.inGameName, 'NP#1');
});

test('lowercases + validates username format', () => {
  assert.equal(validateRegistration({ ...ok, username: 'MixedCase' }, rankTable).account.username, 'mixedcase');
  assert.throws(() => validateRegistration({ ...ok, username: 'ab' }, rankTable), /3-30/);
  assert.throws(() => validateRegistration({ ...ok, username: 'has spaces' }, rankTable), /3-30/);
});

test('requires the mandatory fields', () => {
  assert.throws(() => validateRegistration({ ...ok, name: '' }, rankTable), /name is required/);
  assert.throws(() => validateRegistration({ ...ok, inGameName: '' }, rankTable), /inGameName is required/);
});

test('enforces password length', () => {
  assert.throws(() => validateRegistration({ ...ok, password: '123' }, rankTable), /at least 6/);
});

test('rejects a rank not in the rank table', () => {
  assert.throws(() => validateRegistration({ ...ok, rank: 'Radiant' }, rankTable), /Unknown rank/);
});
