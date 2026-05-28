import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import Player from '../models/Player.js';
import Team from '../models/Team.js';
import AuctionState from '../models/AuctionState.js';
import { accountFromToken } from '../middleware/auth.js';
import { cheapestAvailableFloor, safeMaxBid, validateBid } from './rules.js';

/**
 * The auction engine. Owns the live auction: the state machine, the
 * server-side countdown timer, atomic bid handling and broadcasting.
 *
 * Design rules:
 *  - The SERVER is the single source of truth. Clients only render.
 *  - The TIMER lives here, not on any client. The server decides when a
 *    player is sold. Clients render a countdown from `timerEndsAt`.
 *  - Bids are applied with an ATOMIC conditional update, so two bids landing
 *    at the same instant cannot corrupt the price - one wins, one is told to
 *    re-bid.
 */

// In-memory timer handles, keyed by tournamentId. Not persisted - rebuilt on
// boot from AuctionState (see resumeTimers).
const timers = new Map();

let ioRef = null;

/** Room name all clients of one tournament share. */
const room = (tournamentId) => `auction:${tournamentId}`;

/**
 * Builds the full public auction snapshot sent to clients. Includes per-team
 * budgets/rosters so captains and the observer screen see everything live.
 */
async function buildSnapshot(tournamentId) {
  const [tournament, state, teams, players] = await Promise.all([
    Tournament.findById(tournamentId).lean(),
    AuctionState.findOne({ tournament: tournamentId }).lean(),
    Team.find({ tournament: tournamentId }).lean(),
    Player.find({ tournament: tournamentId }).lean(),
  ]);
  if (!tournament || !state) return null;

  const rosterSize = tournament.settings.rosterSize;
  const cheapestFloor = await cheapestAvailableFloor(tournamentId);

  const currentPlayer = state.currentPlayer
    ? players.find((p) => String(p._id) === String(state.currentPlayer)) || null
    : null;

  const teamView = teams.map((t) => {
    const openSlots = rosterSize - t.roster.length;
    return {
      id: t._id,
      name: t.name,
      currentBudget: t.currentBudget,
      rosterCount: t.roster.length,
      rosterSize,
      openSlots,
      roster: t.roster,
      // The team's safe maximum for the player currently on the block.
      safeMax: safeMaxBid({ currentBudget: t.currentBudget, openSlots, cheapestFloor }),
    };
  });

  return {
    tournamentId,
    status: state.status,
    pass: state.pass,
    settings: {
      minBidIncrement: tournament.settings.minBidIncrement,
      rosterSize,
      timerSeconds: tournament.settings.timerSeconds,
    },
    currentPlayer,
    currentPrice: state.currentPrice,
    highestBidder: state.highestBidder,
    highestBidderName: state.highestBidderName,
    timerEndsAt: state.timerEndsAt,
    bidHistory: state.bidHistory,
    saleLog: state.saleLog.slice(-8), // recent sales ticker
    teams: teamView,
    counts: {
      pool: players.filter((p) => !p.isCore && p.status === 'pool').length,
      sold: players.filter((p) => p.status === 'sold').length,
      unsold: players.filter((p) => p.status === 'unsold').length,
    },
    serverTime: Date.now(), // lets clients correct for clock offset
  };
}

/** Broadcasts the current snapshot to everyone in the tournament room. */
async function broadcast(tournamentId) {
  const snap = await buildSnapshot(tournamentId);
  if (snap) ioRef.to(room(tournamentId)).emit('state', snap);
}

/** Clears any pending sell-timer for a tournament. */
function clearTimer(tournamentId) {
  const handle = timers.get(String(tournamentId));
  if (handle) {
    clearTimeout(handle);
    timers.delete(String(tournamentId));
  }
}

/**
 * Arms the server-side sell timer. When it fires, the player is sold to the
 * current highest bidder (or marked unsold if there were no bids).
 */
function armTimer(tournamentId, msFromNow) {
  clearTimer(tournamentId);
  const handle = setTimeout(() => finalizeSale(tournamentId), msFromNow);
  timers.set(String(tournamentId), handle);
}

/**
 * Concludes the current player's auction. Called by the timer firing or by
 * the auctioneer hammering. Sells to the highest bidder, or marks unsold.
 */
async function finalizeSale(tournamentId) {
  clearTimer(tournamentId);
  const state = await AuctionState.findOne({ tournament: tournamentId });
  if (!state || !['live', 'paused'].includes(state.status)) return;
  if (!state.currentPlayer) return;

  const player = await Player.findById(state.currentPlayer);
  if (!player) return;

  if (state.highestBidder) {
    // SOLD. Deduct credits and add the player to the winning roster.
    const team = await Team.findById(state.highestBidder);
    team.currentBudget -= state.currentPrice;
    team.roster.push(player._id);
    await team.save();

    player.status = 'sold';
    player.soldPrice = state.currentPrice;
    player.currentTeam = team._id;
    await player.save();

    state.saleLog.push({
      player: player._id,
      playerName: player.name,
      team: team._id,
      teamName: team.name,
      price: state.currentPrice,
      at: new Date(),
    });
    ioRef.to(room(tournamentId)).emit('playerSold', {
      playerName: player.name,
      teamName: team.name,
      price: state.currentPrice,
    });
  } else {
    // UNSOLD. No bids - it goes to the pass-2 re-auction pool.
    player.status = 'unsold';
    await player.save();
    ioRef.to(room(tournamentId)).emit('playerUnsold', { playerName: player.name });
  }

  // Reset the block back to idle, ready for the next player.
  state.status = 'idle';
  state.currentPlayer = null;
  state.currentPrice = 0;
  state.highestBidder = null;
  state.highestBidderName = null;
  state.timerEndsAt = null;
  state.pausedRemainingMs = null;
  state.bidHistory = [];
  await state.save();

  await broadcast(tournamentId);
}

/* ------------------------------------------------------------------ */
/* Auctioneer actions                                                  */
/* ------------------------------------------------------------------ */

/** Draws a random player from the pool and puts them in the showcase. */
async function selectPlayer(tournamentId, { pass }) {
  const state = await AuctionState.findOne({ tournament: tournamentId });
  if (!state || state.status !== 'idle') {
    return { error: 'Finish the current player before drawing the next' };
  }

  // Pass 1 draws from 'pool'; pass 2 re-auctions 'unsold' players.
  const drawStatus = pass === 2 ? 'unsold' : 'pool';
  const available = await Player.find({
    tournament: tournamentId,
    isCore: false,
    status: drawStatus,
  }).lean();

  if (!available.length) {
    return { error: pass === 2 ? 'No unsold players remain' : 'The pool is empty' };
  }

  const pick = available[Math.floor(Math.random() * available.length)];
  await Player.findByIdAndUpdate(pick._id, { status: 'on_auction' });

  state.status = 'showcase';
  state.pass = pass || 1;
  state.currentPlayer = pick._id;
  state.currentPrice = pick.floorPrice;
  state.highestBidder = null;
  state.highestBidderName = null;
  state.timerEndsAt = null;
  state.bidHistory = [];
  await state.save();

  await broadcast(tournamentId);
  return { ok: true };
}

/** Opens bidding on the showcased player and arms the timer. */
async function startAuction(tournamentId) {
  const [state, tournament] = await Promise.all([
    AuctionState.findOne({ tournament: tournamentId }),
    Tournament.findById(tournamentId),
  ]);
  if (!state || state.status !== 'showcase') {
    return { error: 'No player is in the showcase' };
  }

  const ms = tournament.settings.timerSeconds * 1000;
  state.status = 'live';
  state.timerEndsAt = new Date(Date.now() + ms);
  await state.save();

  armTimer(tournamentId, ms);
  await broadcast(tournamentId);
  return { ok: true };
}

/** Auctioneer ends the current player early ("hammer"). */
async function hammer(tournamentId) {
  const state = await AuctionState.findOne({ tournament: tournamentId });
  if (!state || state.status !== 'live') return { error: 'Nothing live to hammer' };
  await finalizeSale(tournamentId);
  return { ok: true };
}

/** Pauses a live auction, banking the remaining time. */
async function pause(tournamentId) {
  const state = await AuctionState.findOne({ tournament: tournamentId });
  if (!state || state.status !== 'live') return { error: 'Nothing live to pause' };

  clearTimer(tournamentId);
  state.pausedRemainingMs = Math.max(new Date(state.timerEndsAt).getTime() - Date.now(), 0);
  state.status = 'paused';
  state.timerEndsAt = null;
  await state.save();
  await broadcast(tournamentId);
  return { ok: true };
}

/** Resumes a paused auction with the banked time restored. */
async function resume(tournamentId) {
  const state = await AuctionState.findOne({ tournament: tournamentId });
  if (!state || state.status !== 'paused') return { error: 'Auction is not paused' };

  const ms = state.pausedRemainingMs ?? 0;
  state.status = 'live';
  state.timerEndsAt = new Date(Date.now() + ms);
  state.pausedRemainingMs = null;
  await state.save();

  armTimer(tournamentId, ms);
  await broadcast(tournamentId);
  return { ok: true };
}

/**
 * Undoes the most recent completed sale: refunds the team, frees the roster
 * slot, and returns the player to the pool. Only safe to call while idle
 * (between players).
 */
async function undoLastSale(tournamentId) {
  const state = await AuctionState.findOne({ tournament: tournamentId });
  if (!state) return { error: 'No auction' };
  if (state.status !== 'idle') {
    return { error: 'Finish or hammer the current player before undoing' };
  }
  if (!state.saleLog.length) return { error: 'Nothing to undo' };

  const last = state.saleLog[state.saleLog.length - 1];
  const player = await Player.findById(last.player);

  if (player && player.status === 'sold') {
    const team = await Team.findById(last.team);
    if (team) {
      team.currentBudget += last.price;
      team.roster = team.roster.filter((id) => String(id) !== String(player._id));
      await team.save();
    }
    player.status = 'pool';
    player.soldPrice = null;
    player.currentTeam = null;
    await player.save();
  }

  state.saleLog.pop();
  await state.save();
  await broadcast(tournamentId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Captain action: bid                                                 */
/* ------------------------------------------------------------------ */

/**
 * Handles a bid from a captain. Validates against all rules, then applies it
 * with an atomic conditional update so simultaneous bids cannot corrupt the
 * price. A successful bid resets the countdown timer.
 */
async function placeBid(tournamentId, teamId, amount) {
  const [tournament, state, team] = await Promise.all([
    Tournament.findById(tournamentId),
    AuctionState.findOne({ tournament: tournamentId }),
    Team.findById(teamId),
  ]);
  if (!tournament || !state || !team) return { error: 'Auction not available' };

  const rosterSize = tournament.settings.rosterSize;
  const openSlots = rosterSize - team.roster.length;
  const cheapestFloor = await cheapestAvailableFloor(tournamentId);

  const check = validateBid({
    auctionStatus: state.status,
    amount,
    currentPrice: state.currentPrice,
    minIncrement: tournament.settings.minBidIncrement,
    teamIsHighestBidder: String(state.highestBidder) === String(teamId),
    openSlots,
    currentBudget: team.currentBudget,
    cheapestFloor,
  });
  if (!check.ok) return { error: check.reason };

  // Atomic apply: only succeeds if the auction is still live AND the price
  // has not moved past what this bid beats. If another bid landed first this
  // update matches nothing and we tell the captain to re-bid.
  const ms = tournament.settings.timerSeconds * 1000;
  const updated = await AuctionState.findOneAndUpdate(
    {
      tournament: tournamentId,
      status: 'live',
      currentPrice: { $lt: amount },
    },
    {
      currentPrice: amount,
      highestBidder: team._id,
      highestBidderName: team.name,
      timerEndsAt: new Date(Date.now() + ms),
      $push: { bidHistory: { team: team._id, teamName: team.name, amount, at: new Date() } },
    },
    { new: true }
  );

  if (!updated) {
    return { error: 'Someone bid first - the price moved. Try again.' };
  }

  // Bid stuck: reset the timer and tell everyone.
  armTimer(tournamentId, ms);
  ioRef.to(room(tournamentId)).emit('bidPlaced', {
    teamName: team.name,
    amount,
  });
  await broadcast(tournamentId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Boot-time recovery                                                  */
/* ------------------------------------------------------------------ */

/**
 * On server start, re-arm timers for any auction that was live when the
 * process stopped. If the banked time already elapsed, finalize immediately.
 */
async function resumeTimers() {
  const liveStates = await AuctionState.find({ status: 'live' });
  for (const state of liveStates) {
    const msLeft = new Date(state.timerEndsAt).getTime() - Date.now();
    if (msLeft > 0) {
      armTimer(state.tournament, msLeft);
      console.log(`[auction] resumed timer for tournament ${state.tournament}`);
    } else {
      await finalizeSale(state.tournament);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Socket.io wiring                                                     */
/* ------------------------------------------------------------------ */

/**
 * Attaches the auction engine to a Socket.io server. Authenticates each
 * socket from its handshake token and enforces role permissions per action.
 */
export function initAuctionEngine(io) {
  ioRef = io;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const account = await accountFromToken(token);
    if (!account) return next(new Error('Authentication required'));
    socket.account = account;
    next();
  });

  io.on('connection', (socket) => {
    const { account } = socket;

    // Join a tournament room and immediately receive the current snapshot.
    socket.on('join', async ({ tournamentId }) => {
      if (!tournamentId) return;
      socket.join(room(tournamentId));
      socket.tournamentId = tournamentId;
      const snap = await buildSnapshot(tournamentId);
      if (snap) socket.emit('state', snap);
    });

    // ---- Auctioneer / admin actions --------------------------------------
    const isController = ['auctioneer', 'admin'].includes(account.role);

    const guard = (fn) => async (payload, ack) => {
      const tournamentId = socket.tournamentId;
      if (!tournamentId) return ack?.({ error: 'Join a tournament first' });
      if (!isController) return ack?.({ error: 'Auctioneer only' });
      try {
        const result = await fn(tournamentId, payload || {});
        ack?.(result);
      } catch (err) {
        console.error('[auction] action failed:', err);
        ack?.({ error: 'Server error - action did not complete' });
      }
    };

    socket.on('selectPlayer', guard((tid, p) => selectPlayer(tid, p)));
    socket.on('startAuction', guard((tid) => startAuction(tid)));
    socket.on('hammer', guard((tid) => hammer(tid)));
    socket.on('pause', guard((tid) => pause(tid)));
    socket.on('resume', guard((tid) => resume(tid)));
    socket.on('undoLastSale', guard((tid) => undoLastSale(tid)));

    // ---- Captain action: bid --------------------------------------------
    socket.on('bid', async ({ amount }, ack) => {
      const tournamentId = socket.tournamentId;
      if (!tournamentId) return ack?.({ error: 'Join a tournament first' });
      if (account.role !== 'captain' || !account.team) {
        return ack?.({ error: 'Only captains can bid' });
      }
      try {
        const result = await placeBid(tournamentId, account.team, Number(amount));
        ack?.(result);
      } catch (err) {
        console.error('[auction] bid failed:', err);
        ack?.({ error: 'Server error - bid did not register' });
      }
    });

    // Lets a reconnecting client pull fresh state on demand.
    socket.on('resync', async (_p, ack) => {
      const snap = socket.tournamentId ? await buildSnapshot(socket.tournamentId) : null;
      ack?.(snap || { error: 'Not in a tournament' });
    });
  });

  resumeTimers().catch((e) => console.error('[auction] resumeTimers failed:', e));
}
