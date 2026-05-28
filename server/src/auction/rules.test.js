import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeMaxBid, validateBid } from './rules.js';

/**
 * Unit tests for the auction safety logic — the most important correctness
 * guarantee in the whole platform. These are pure functions (no DB), so they
 * run anywhere with `node --test`.
 *
 * They cover:
 *  - the dynamic reserve maths (safeMaxBid)
 *  - every rejection branch and the happy path of validateBid
 *  - boundary values (exact minimum increment, exact safe maximum)
 *  - the dynamic-reserve scenario where the cheapest floor rises mid-auction
 */

/* ----------------------------- safeMaxBid ------------------------------- */

test('safeMaxBid reserves nothing on a team\'s last open slot', () => {
  // openSlots === 1 → winning fills the roster → reserve 0 → whole budget.
  assert.equal(safeMaxBid({ currentBudget: 80, openSlots: 1, cheapestFloor: 5 }), 80);
});

test('safeMaxBid reserves (openSlots-1) * cheapestFloor', () => {
  // 3 open slots, cheapest floor 5 → must keep 2*5=10 → safeMax 90.
  assert.equal(safeMaxBid({ currentBudget: 100, openSlots: 3, cheapestFloor: 5 }), 90);
});

test('safeMaxBid never reserves for negative slot counts', () => {
  assert.equal(safeMaxBid({ currentBudget: 60, openSlots: 0, cheapestFloor: 5 }), 60);
});

test('safeMaxBid drops as the cheapest available floor rises (dynamic reserve)', () => {
  const base = { currentBudget: 100, openSlots: 3 };
  const cheap = safeMaxBid({ ...base, cheapestFloor: 5 });   // reserve 10 → 90
  const dearer = safeMaxBid({ ...base, cheapestFloor: 12 }); // reserve 24 → 76
  assert.equal(cheap, 90);
  assert.equal(dearer, 76);
  assert.ok(dearer < cheap, 'a higher cheapest floor must lower the safe maximum');
});

/* ----------------------------- validateBid ------------------------------ */

const ok = {
  auctionStatus: 'live',
  amount: 10,
  currentPrice: 5,
  minIncrement: 1,
  teamIsHighestBidder: false,
  openSlots: 2,
  currentBudget: 100,
  cheapestFloor: 5,
};

test('validateBid accepts a clean bid', () => {
  assert.deepEqual(validateBid(ok), { ok: true });
});

test('validateBid rejects when bidding is not open', () => {
  const r = validateBid({ ...ok, auctionStatus: 'showcase' });
  assert.equal(r.ok, false);
});

test('validateBid rejects a non-finite or non-positive amount', () => {
  assert.equal(validateBid({ ...ok, amount: NaN }).ok, false);
  assert.equal(validateBid({ ...ok, amount: 0 }).ok, false);
  assert.equal(validateBid({ ...ok, amount: -5 }).ok, false);
});

test('validateBid enforces the minimum increment', () => {
  // currentPrice 5, minIncrement 1 → must bid >= 6.
  assert.equal(validateBid({ ...ok, amount: 5 }).ok, false);
  assert.equal(validateBid({ ...ok, amount: 6 }).ok, true);
});

test('validateBid blocks the team that is already top bidder', () => {
  assert.equal(validateBid({ ...ok, teamIsHighestBidder: true }).ok, false);
});

test('validateBid blocks a team with no open slots', () => {
  assert.equal(validateBid({ ...ok, openSlots: 0 }).ok, false);
});

test('validateBid blocks a bid above the safe maximum', () => {
  // budget 50, openSlots 3, cheapestFloor 10 → safeMax = 50 - 2*10 = 30.
  const params = { ...ok, currentBudget: 50, openSlots: 3, cheapestFloor: 10, currentPrice: 1 };
  assert.equal(validateBid({ ...params, amount: 31 }).ok, false);
  assert.equal(validateBid({ ...params, amount: 30 }).ok, true); // exact safe max allowed
});

test('validateBid allows spending the entire budget on a final slot', () => {
  const params = { ...ok, currentBudget: 42, openSlots: 1, cheapestFloor: 5, currentPrice: 1 };
  assert.equal(validateBid({ ...params, amount: 42 }).ok, true);
  assert.equal(validateBid({ ...params, amount: 43 }).ok, false); // can't exceed budget
});

test('validateBid: a captain can never be stranded unable to fill the roster', () => {
  // Simulate down to the last slot after spending. With 2 slots left and the
  // cheapest floor at 8, the reserve (1*8) guarantees the final slot is fundable.
  const r = validateBid({
    auctionStatus: 'live',
    amount: 20,
    currentPrice: 1,
    minIncrement: 1,
    teamIsHighestBidder: false,
    openSlots: 2,
    currentBudget: 27, // safeMax = 27 - 8 = 19, so 20 must be rejected
    cheapestFloor: 8,
  });
  assert.equal(r.ok, false, 'bid that would strand the last slot must be blocked');
  assert.equal(validateBid({
    auctionStatus: 'live', amount: 19, currentPrice: 1, minIncrement: 1,
    teamIsHighestBidder: false, openSlots: 2, currentBudget: 27, cheapestFloor: 8,
  }).ok, true, 'bid leaving exactly the reserve must be allowed');
});
