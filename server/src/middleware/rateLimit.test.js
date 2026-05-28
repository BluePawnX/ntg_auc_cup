import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindow } from './rateLimit.js';

test('allows up to max hits within the window', () => {
  const w = new SlidingWindow({ windowMs: 1000, max: 3 });
  assert.equal(w.hit('a', 0).allowed, true);
  assert.equal(w.hit('a', 100).allowed, true);
  assert.equal(w.hit('a', 200).allowed, true);
  const blocked = w.hit('a', 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test('window slides — old hits expire', () => {
  const w = new SlidingWindow({ windowMs: 1000, max: 2 });
  w.hit('a', 0);
  w.hit('a', 500);
  assert.equal(w.hit('a', 900).allowed, false); // 3rd within window
  assert.equal(w.hit('a', 1100).allowed, true); // first (t=0) expired
});

test('keys are independent', () => {
  const w = new SlidingWindow({ windowMs: 1000, max: 1 });
  assert.equal(w.hit('a', 0).allowed, true);
  assert.equal(w.hit('b', 0).allowed, true); // different key, own budget
  assert.equal(w.hit('a', 10).allowed, false);
});

test('sweep prunes empty keys', () => {
  const w = new SlidingWindow({ windowMs: 1000, max: 5 });
  w.hit('a', 0);
  w.sweep(5000);
  assert.equal(w.hits.has('a'), false);
});
