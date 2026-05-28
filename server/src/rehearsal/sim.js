import { io } from 'socket.io-client';

/**
 * The auction rehearsal simulation. Connects one auctioneer and ten captains
 * over real Socket.io, then drives a full auction (pass 1 + pass 2) the way a
 * live room would — captains bidding competitively, bounded by each team's
 * server-computed safe maximum.
 *
 * Woven into the run are the four stress scenarios from the no-bug checklist:
 *   - simultaneous identical bids  → exactly one wins, the rest re-bid
 *   - a captain disconnects/reconnects → full state resync on return
 *   - reserve rule under pressure → an over-safe-max bid is rejected
 *   - undo last sale → refund + freed slot
 *
 * Throughout, hard invariants are asserted after every sale (no negative
 * budget, never more than rosterSize), and a full budget reconciliation runs
 * at the end. Returns { failures, total } and prints a PASS/FAIL line per check.
 */

const PASS = { auctioneer: 'ntg-auctioneer-2026', captain: 'captain-2026' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function runRehearsal(BASE) {
  const results = [];
  const check = (label, cond, extra = '') => {
    const ok = !!cond;
    results.push({ label, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
    return ok;
  };

  async function api(path, opts = {}) {
    const res = await fetch(`${BASE}${path}`, opts);
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  }
  const login = (username, password) =>
    api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  const connect = (token) =>
    new Promise((resolve, reject) => {
      const s = io(BASE, { auth: { token }, transports: ['websocket'] });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  const emit = (sock, event, payload = {}) =>
    new Promise((resolve) => sock.emit(event, payload, (ack) => resolve(ack || {})));
  // `join` has no ack — the server replies with a `state` snapshot instead, so
  // wait for that (with a timeout fallback) rather than an acknowledgment.
  const joinRoom = (sock) =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      sock.once('state', finish);
      sock.emit('join', { tournamentId });
      setTimeout(finish, 1500);
    });

  // --- set up auctioneer + look up the tournament/teams ---
  const auc = await login('auctioneer', PASS.auctioneer);
  const { tournaments } = await api('/api/tournaments', {
    headers: { Authorization: `Bearer ${auc.token}` },
  });
  const tournamentId = tournaments[0]._id;
  const full = await api(`/api/tournaments/${tournamentId}`, {
    headers: { Authorization: `Bearer ${auc.token}` },
  });
  const teamSlugs = full.teams.map((t) => slugify(t.name));

  const aucSock = await connect(auc.token);
  await joinRoom(aucSock);
  const state = () => emit(aucSock, 'resync', {});

  // --- connect all ten captains ---
  const captains = [];
  for (const sl of teamSlugs) {
    const acc = await login(sl, PASS.captain);
    const sock = await connect(acc.token);
    const cap = { slug: sl, token: acc.token, team: acc.account.team, sock, snap: null, states: 0 };
    sock.on('state', (s) => { cap.snap = s; cap.states += 1; });
    await joinRoom(sock);
    captains.push(cap);
  }
  await sleep(150);
  check('all 10 captains connected and received state', captains.length === 10 && captains.every((c) => c.snap));

  const view = (snap, teamId) => snap.teams.find((t) => String(t.id) === String(teamId));

  // scenario flags (fired once each, at a natural moment)
  let didSimultaneous = false, didReserve = false, didDisconnect = false, didUndo = false;
  let invariantViolations = 0;

  function checkInvariants(snap) {
    for (const t of snap.teams) {
      if (t.currentBudget < 0) { invariantViolations++; console.log(`  ! ${t.name} budget went negative: ${t.currentBudget}`); }
      if (t.rosterCount > t.rosterSize) { invariantViolations++; console.log(`  ! ${t.name} roster overflow: ${t.rosterCount}/${t.rosterSize}`); }
    }
  }

  let guard = 0;
  for (let pass = 1; pass <= 2; pass++) {
    while (guard++ < 120) {
      const draw = await emit(aucSock, 'selectPlayer', { pass });
      if (draw.error) break; // pool (or unsold pool) exhausted for this pass
      await emit(aucSock, 'startAuction', {});
      let snap = await state();
      if (snap.status !== 'live') break;

      // ---- scenario: disconnect + reconnect (once, early) ----
      if (!didDisconnect) {
        didDisconnect = true;
        const victim = captains.find((c) => view(snap, c.team).openSlots > 0) || captains[0];
        victim.sock.disconnect();
        await sleep(150);
        const before = victim.states;
        const reconnected = await connect(victim.token);
        reconnected.on('state', (s) => { victim.snap = s; victim.states += 1; });
        victim.sock = reconnected;
        await joinRoom(reconnected);
        await sleep(200);
        check('captain resyncs full state after reconnect', victim.states > before && Array.isArray(victim.snap?.teams), victim.slug);
      }

      // ---- scenario: reserve rule rejects an over-safe-max bid (once) ----
      if (!didReserve) {
        const cand = captains.find((c) => { const v = view(snap, c.team); return v.openSlots > 0 && v.safeMax >= snap.currentPrice + 1; });
        if (cand) {
          didReserve = true;
          const v = view(snap, cand.team);
          const bad = await emit(cand.sock, 'bid', { amount: v.safeMax + 10 });
          check('reserve rule rejects a bid above safe maximum', !!bad.error && /safe maximum/i.test(bad.error), bad.error || 'no error');
        }
      }

      // ---- scenario: simultaneous identical bids (once) ----
      if (!didSimultaneous) {
        const eligible = captains.filter((c) => { const v = view(snap, c.team); return String(snap.highestBidder) !== String(c.team) && v.openSlots > 0 && v.safeMax >= snap.currentPrice + 1; });
        if (eligible.length >= 3) {
          didSimultaneous = true;
          const amount = snap.currentPrice + 1;
          const acks = await Promise.all(eligible.slice(0, 3).map((c) => emit(c.sock, 'bid', { amount })));
          const oks = acks.filter((a) => a.ok).length;
          check('simultaneous identical bids: exactly one wins', oks === 1, `${oks} of 3 accepted`);
          snap = await state();
        }
      }

      // ---- competitive bidding rounds (bounded by safe max) ----
      let rounds = 0;
      while (rounds++ < 14) {
        snap = await state();
        if (snap.status !== 'live') break;
        const price = snap.currentPrice;
        const eligible = captains.filter((c) => { const v = view(snap, c.team); return String(snap.highestBidder) !== String(c.team) && v.openSlots > 0 && v.safeMax >= price + 1; });
        if (!eligible.length) break;
        const bidders = eligible.filter(() => Math.random() < 0.45);
        if (!bidders.length && Math.random() < 0.5) bidders.push(eligible[Math.floor(Math.random() * eligible.length)]);
        if (!bidders.length) break;
        await Promise.all(bidders.map((c) => {
          const v = view(snap, c.team);
          const amount = Math.min(price + 1 + Math.floor(Math.random() * 3), v.safeMax);
          return amount > price ? emit(c.sock, 'bid', { amount }) : Promise.resolve();
        }));
        await sleep(50);
      }

      // ---- hammer to finalize ----
      const pre = await state();
      const winnerId = pre.highestBidder;
      const price = pre.currentPrice;
      const winnerBefore = winnerId ? view(pre, winnerId) : null;
      await emit(aucSock, 'hammer', {});
      await sleep(120);
      let post = await state();
      checkInvariants(post);

      // ---- scenario: undo last sale (once, after a real sale) ----
      if (!didUndo && winnerId && post.status === 'idle' && winnerBefore) {
        didUndo = true;
        const u = await emit(aucSock, 'undoLastSale', {});
        await sleep(120);
        const afterUndo = await state();
        const wPost = view(afterUndo, winnerId);
        check('undo refunds the winning team', !u.error && wPost.currentBudget === winnerBefore.currentBudget, `${wPost.currentBudget} vs ${winnerBefore.currentBudget}`);
        check('undo frees the roster slot', wPost.rosterCount === winnerBefore.rosterCount, `${wPost.rosterCount} vs ${winnerBefore.rosterCount}`);
      }
    }
  }

  check('no budget/roster invariant was ever violated', invariantViolations === 0, `${invariantViolations} violations`);

  // ---- final budget reconciliation (authoritative, via REST) ----
  const finalData = await api(`/api/tournaments/${tournamentId}`, { headers: { Authorization: `Bearer ${auc.token}` } });
  let reconcileOk = true;
  let rosterOk = true;
  for (const team of finalData.teams) {
    const sold = finalData.players.filter((p) => String(p.currentTeam) === String(team._id) && p.status === 'sold');
    const spent = sold.reduce((s, p) => s + (p.soldPrice || 0), 0);
    const expected = team.startingBudget - team.coreDeduction - spent;
    if (team.currentBudget !== expected) { reconcileOk = false; console.log(`  ! ${team.name}: budget ${team.currentBudget} != expected ${expected}`); }
    if (team.roster.length > finalData.tournament.settings.rosterSize) { rosterOk = false; }
  }
  check('every team budget reconciles with its purchases', reconcileOk);
  check('no team exceeds its roster size', rosterOk);

  const sold = finalData.players.filter((p) => p.status === 'sold').length;
  const unsold = finalData.players.filter((p) => p.status === 'unsold').length;
  const poolLeft = finalData.players.filter((p) => !p.isCore && p.status === 'pool').length;
  check('pass 2 ran: no unsold players left stuck in the pool when teams had room', poolLeft === 0 || finalData.teams.every((t) => t.roster.length >= finalData.tournament.settings.rosterSize), `pool left ${poolLeft}`);
  console.log(`\nResult of run: ${sold} sold, ${unsold} unsold, ${poolLeft} still in pool.`);

  // ---- teardown sockets ----
  aucSock.close();
  captains.forEach((c) => c.sock.close());
  await sleep(100);

  const failures = results.filter((r) => !r.ok).length;
  return { failures, total: results.length, sold, unsold, results };
}
