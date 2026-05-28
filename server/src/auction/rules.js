import Player from '../models/Player.js';

/**
 * Pure auction-rule helpers. Kept separate from the socket engine so the
 * logic can be reasoned about and unit-tested on its own.
 */

/**
 * The cheapest floor price among players still available to be won - i.e.
 * still in the pool or currently on the block. This drives the reserve rule
 * and is DYNAMIC: once the cheapest players are sold it rises automatically.
 *
 * @returns {number} cheapest floor, or 0 if no players remain.
 */
export async function cheapestAvailableFloor(tournamentId) {
  const cheapest = await Player.find({
    tournament: tournamentId,
    isCore: false,
    status: { $in: ['pool', 'on_auction'] },
  })
    .sort({ floorPrice: 1 })
    .limit(1)
    .lean();

  return cheapest.length ? cheapest[0].floorPrice : 0;
}

/**
 * The most a team may safely bid right now without leaving itself unable to
 * fill its remaining roster slots.
 *
 *   safeMax = currentBudget - (slotsLeftAfterThisWin) * cheapestAvailableFloor
 *
 * slotsLeftAfterThisWin = openSlots - 1, because winning the current player
 * fills one slot. If this is the team's last slot, nothing is reserved.
 *
 * @returns {number} the highest legal bid amount for this team.
 */
export function safeMaxBid({ currentBudget, openSlots, cheapestFloor }) {
  const slotsLeftAfterThisWin = Math.max(openSlots - 1, 0);
  const reserve = slotsLeftAfterThisWin * cheapestFloor;
  return currentBudget - reserve;
}

/**
 * Validates a proposed bid against every auction rule. Returns
 * { ok: true } or { ok: false, reason } - the single place bid legality is
 * decided. The socket engine calls this, then applies the bid atomically.
 */
export function validateBid({
  auctionStatus,
  amount,
  currentPrice,
  minIncrement,
  teamIsHighestBidder,
  openSlots,
  currentBudget,
  cheapestFloor,
}) {
  if (auctionStatus !== 'live') {
    return { ok: false, reason: 'Bidding is not open right now' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'Invalid bid amount' };
  }
  if (amount < currentPrice + minIncrement) {
    return { ok: false, reason: `Bid must be at least ${currentPrice + minIncrement}` };
  }
  if (teamIsHighestBidder) {
    return { ok: false, reason: 'You are already the highest bidder' };
  }
  if (openSlots <= 0) {
    return { ok: false, reason: 'Your roster is already full' };
  }
  const safeMax = safeMaxBid({ currentBudget, openSlots, cheapestFloor });
  if (amount > safeMax) {
    return {
      ok: false,
      reason: `Bid exceeds your safe maximum of ${safeMax} (credits must be kept to fill your remaining slots)`,
    };
  }
  return { ok: true };
}
