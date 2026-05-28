import 'dotenv/config';
import { io } from 'socket.io-client';

/**
 * Headless auction smoke test. Drives a full auction over Socket.io against a
 * running server (no browser), asserting the rules that matter most:
 *   - an authenticated socket joins and receives a state snapshot
 *   - a valid bid is accepted and updates the price + timer
 *   - a bid above a team's safe maximum is REJECTED (reserve rule)
 *   - hammering sells to the highest bidder (budget down, roster up)
 *   - undo-last-sale refunds the team and frees the slot
 *
 * Prerequisites: MongoDB up, `npm run seed` run, and `npm start` running in
 * another terminal. Then:  npm run smoke
 *
 * It uses the seeded dev accounts/passwords from src/seed/config.js.
 */

const BASE = process.env.SMOKE_BASE || `http://localhost:${process.env.PORT || 4000}`;
const PASS = { admin: 'ntg-admin-2026', auctioneer: 'ntg-auctioneer-2026', captain: 'captain-2026' };

let failures = 0;
function check(label, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  if (!cond) failures += 1;
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${username}: ${res.status}`);
  return res.json(); // { account, token }
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

// Wait for the next `state` snapshot after running `trigger`.
function nextState(socket, trigger) {
  return new Promise((resolve) => {
    socket.once('state', resolve);
    trigger?.();
  });
}

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // --- health ---
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  check('GET /api/health responds ok', health.ok === true);

  // --- logins ---
  const auc = await login('auctioneer', PASS.auctioneer);
  check('auctioneer can log in', !!auc.token);

  const tournaments = await fetch(`${BASE}/api/tournaments`, {
    headers: { Authorization: `Bearer ${auc.token}` },
  }).then((r) => r.json());
  const tournamentId = tournaments.tournaments?.[0]?._id;
  check('tournament exists (run npm run seed first)', !!tournamentId);
  if (!tournamentId) return;

  // Pick two captains from the seeded data.
  const full = await fetch(`${BASE}/api/tournaments/${tournamentId}`, {
    headers: { Authorization: `Bearer ${auc.token}` },
  }).then((r) => r.json());
  const teamSlugs = full.teams.map((t) =>
    t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  );
  const capA = await login(teamSlugs[0], PASS.captain);
  const capB = await login(teamSlugs[1], PASS.captain);

  // --- sockets ---
  const aucSock = await connect(auc.token);
  const aSock = await connect(capA.token);
  const bSock = await connect(capB.token);

  const snap0 = await nextState(aucSock, () => aucSock.emit('join', { tournamentId }));
  await nextState(aSock, () => aSock.emit('join', { tournamentId }));
  await nextState(bSock, () => bSock.emit('join', { tournamentId }));
  check('socket join returns a state snapshot', !!snap0 && Array.isArray(snap0.teams));

  // --- draw + start ---
  const drawAck = await emit(aucSock, 'selectPlayer', { pass: 1 });
  check('auctioneer can draw a player', drawAck?.ok === true, drawAck?.error || '');
  const startAck = await emit(aucSock, 'startAuction', {});
  check('auction goes live', startAck?.ok === true, startAck?.error || '');

  // Grab live state to know current price + the player.
  const live = await emit(aucSock, 'resync', {});
  const floor = live.currentPrice;
  check('live snapshot has a current player + price', !!live.currentPlayer && floor > 0);

  // --- a valid bid from captain A ---
  const bid1 = await emit(aSock, 'bid', { amount: floor + 1 });
  check('valid bid accepted', bid1?.ok === true, bid1?.error || '');
  const afterBid = await emit(aucSock, 'resync', {});
  check('price updated after bid', afterBid.currentPrice === floor + 1);
  check('highest bidder is captain A', String(afterBid.highestBidder) === String(capA.account.team));

  // --- over-safe-max bid from captain B is rejected (reserve rule) ---
  const teamB = afterBid.teams.find((t) => String(t.id) === String(capB.account.team));
  const unsafe = teamB.safeMax + 1;
  const bidBad = await emit(bSock, 'bid', { amount: unsafe });
  check('bid above safe maximum is rejected', bidBad?.ok !== true, bidBad?.error || 'no error returned');

  // --- a safe higher bid from captain B is accepted ---
  const safeHigher = Math.min(afterBid.currentPrice + 1, teamB.safeMax);
  const bid2 = await emit(bSock, 'bid', { amount: safeHigher });
  check('safe higher bid from B accepted', bid2?.ok === true, bid2?.error || '');

  // --- hammer: sells to highest bidder ---
  const beforeSale = await emit(aucSock, 'resync', {});
  const winnerId = beforeSale.highestBidder;
  const price = beforeSale.currentPrice;
  const winnerBefore = beforeSale.teams.find((t) => String(t.id) === String(winnerId));
  await emit(aucSock, 'hammer', {});
  await sleep(150);
  const afterSale = await emit(aucSock, 'resync', {});
  const winnerAfter = afterSale.teams.find((t) => String(t.id) === String(winnerId));
  check('status returns to idle after sale', afterSale.status === 'idle');
  check('winner budget reduced by price', winnerAfter.currentBudget === winnerBefore.currentBudget - price);
  check('winner roster grew by one', winnerAfter.rosterCount === winnerBefore.rosterCount + 1);
  check('a sale was logged', afterSale.saleLog.length >= 1);

  // --- undo last sale: refund + free slot ---
  await emit(aucSock, 'undoLastSale', {});
  await sleep(150);
  const afterUndo = await emit(aucSock, 'resync', {});
  const winnerUndone = afterUndo.teams.find((t) => String(t.id) === String(winnerId));
  check('undo refunds the team', winnerUndone.currentBudget === winnerBefore.currentBudget);
  check('undo frees the roster slot', winnerUndone.rosterCount === winnerBefore.rosterCount);

  [aucSock, aSock, bSock].forEach((s) => s.close());

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('smoke test error:', err.message);
  process.exitCode = 1;
});
