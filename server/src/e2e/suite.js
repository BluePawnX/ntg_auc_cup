import { io } from 'socket.io-client';

/**
 * Full end-to-end test suite. Drives the REAL running server (REST + Socket.io)
 * through every feature with PASS, FAIL and VALIDATION cases, asserting each.
 * Returns { results, failures }. Run via src/e2e/e2e.js (self-contained).
 */
const PW = { admin: 'ntg-admin-2026', auctioneer: 'ntg-auctioneer-2026', captain: 'captain-2026' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function runE2E(BASE) {
  const results = [];
  const check = (label, cond, extra = '') => {
    const ok = !!cond; results.push({ label, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
    return ok;
  };

  // REST helper returning { status, data }.
  async function req(path, { method = 'GET', body, token } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  const connect = (token) => new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s)); s.on('connect_error', reject);
  });
  const emit = (s, e, p = {}) => new Promise((r) => s.emit(e, p, (a) => r(a || {})));

  /* =============================== AUTH ================================= */
  const badLogin = await req('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } });
  check('auth: wrong password rejected (401)', badLogin.status === 401);
  const missing = await req('/api/auth/login', { method: 'POST', body: { username: 'admin' } });
  check('auth: missing password rejected (400)', missing.status === 400);
  const adminLogin = await req('/api/auth/login', { method: 'POST', body: { username: 'admin', password: PW.admin } });
  check('auth: valid admin login (200 + token)', adminLogin.status === 200 && !!adminLogin.data.token);
  const adminTok = adminLogin.data.token;
  const me = await req('/api/auth/me', { token: adminTok });
  check('auth: /me with valid token returns account', me.status === 200 && me.data.account?.role === 'admin');
  const meBad = await req('/api/auth/me', { token: 'garbage.token.value' });
  check('auth: /me with bad token rejected (401)', meBad.status === 401);

  const noTok = await req('/api/tournaments');
  check('auth: protected route without token rejected (401)', noTok.status === 401);

  const aucLogin = await req('/api/auth/login', { method: 'POST', body: { username: 'auctioneer', password: PW.auctioneer } });
  const aucTok = aucLogin.data.token;

  /* ============================ SEED / DATA ============================ */
  const tl = await req('/api/tournaments', { token: adminTok });
  check('data: tournaments list returns >=1', tl.status === 200 && tl.data.tournaments?.length >= 1);
  const tid = tl.data.tournaments[0]._id;
  const t = await req(`/api/tournaments/${tid}`, { token: adminTok });
  const teams = t.data.teams || [];
  const players = t.data.players || [];
  check('data: 10 teams seeded', teams.length === 10, `${teams.length}`);
  check('data: 50 players seeded (20 cores + 30 pool)', players.length === 50, `${players.length}`);
  const poolCount = players.filter((p) => !p.isCore && p.status === 'pool').length;
  check('data: 30 auctionable pool players', poolCount === 30, `${poolCount}`);
  const budgets = teams.map((x) => x.currentBudget);
  check('data: budget ladder spans 81..118 (real economy)', Math.min(...budgets) === 81 && Math.max(...budgets) === 118, `${Math.min(...budgets)}..${Math.max(...budgets)}`);

  // --- economy editor: edit the rank table → recompute floors (pre-auction) ---
  const origRankTable = t.data.tournament.rankTable;
  const goldPlayer = players.find((p) => !p.isCore && p.rank === 'Gold');
  const editedTable = origRankTable.map((r) => (r.rank === 'Gold' ? { ...r, floorPrice: 99 } : r));
  const econ = await req(`/api/tournaments/${tid}/economy`, { method: 'PATCH', token: adminTok, body: { rankTable: editedTable } });
  check('economy: edit applies + recomputes (pre-auction)', econ.status === 200 && econ.data.recomputed === true, econ.data.error || '');
  const tEcon = await req(`/api/tournaments/${tid}`, { token: adminTok });
  const goldAfter = tEcon.data.players.find((p) => String(p._id) === String(goldPlayer._id));
  check('economy: Gold floor recomputed to the new value', goldAfter.floorPrice === 99, `${goldAfter.floorPrice}`);
  await req(`/api/tournaments/${tid}/economy`, { method: 'PATCH', token: adminTok, body: { rankTable: origRankTable } }); // revert

  /* ============================== AUCTION ============================== */
  const slugs = teams.map((x) => slug(x.name));
  const capA = await req('/api/auth/login', { method: 'POST', body: { username: slugs[0], password: PW.captain } });
  const capB = await req('/api/auth/login', { method: 'POST', body: { username: slugs[1], password: PW.captain } });
  check('auction: captain login works (team slug)', capA.status === 200 && !!capA.data.account.team);
  const teamA = capA.data.account.team, teamB = capB.data.account.team;

  const aucSock = await connect(aucTok);
  const aSock = await connect(capA.data.token);
  const bSock = await connect(capB.data.token);
  const cSocks = []; // a few more captains for simultaneous test
  for (let i = 2; i < 5; i++) { const c = await req('/api/auth/login', { method: 'POST', body: { username: slugs[i], password: PW.captain } }); cSocks.push({ team: c.data.account.team, sock: await connect(c.data.token) }); }

  const joinRoom = (s) => new Promise((r) => { let d = false; const f = () => { if (!d) { d = true; r(); } }; s.once('state', f); s.emit('join', { tournamentId: tid }); setTimeout(f, 1200); });
  const snap0 = await new Promise((r) => { aucSock.once('state', r); aucSock.emit('join', { tournamentId: tid }); });
  await Promise.all([joinRoom(aSock), joinRoom(bSock), ...cSocks.map((c) => joinRoom(c.sock))]);
  check('auction: socket join returns a state snapshot', !!snap0 && Array.isArray(snap0.teams));
  const state = () => emit(aucSock, 'resync', {});

  // Guard: captain cannot run auctioneer actions.
  const capDraw = await emit(aSock, 'selectPlayer', { pass: 1 });
  check('auction: captain blocked from auctioneer action (guard)', !!capDraw.error);

  // Bid before live → rejected.
  await emit(aucSock, 'selectPlayer', { pass: 1 });
  let s = await state();
  check('auction: draw → showcase, pool decremented', s.status === 'showcase' && s.counts.pool === 29, `${s.status}/${s.counts.pool}`);
  const earlyBid = await emit(aSock, 'bid', { amount: s.currentPrice + 1 });
  check('auction: bid before bidding opens rejected', !!earlyBid.error, earlyBid.error || '');

  await emit(aucSock, 'startAuction', {});
  s = await state();
  const floor = s.currentPrice;
  const viewA = s.teams.find((x) => String(x.id) === String(teamA));
  // Validation fails:
  const tooLow = await emit(aSock, 'bid', { amount: floor }); // < floor+1
  check('auction: bid below min increment rejected', !!tooLow.error, tooLow.error || '');
  const overMax = await emit(aSock, 'bid', { amount: viewA.safeMax + 50 });
  check('auction: bid over safe-max rejected (reserve rule)', !!overMax.error && /safe maximum/i.test(overMax.error), overMax.error || '');
  const aucBid = await emit(aucSock, 'bid', { amount: floor + 1 });
  check('auction: non-captain bid rejected (guard)', !!aucBid.error);
  // Valid bid:
  const good = await emit(aSock, 'bid', { amount: floor + 1 });
  check('auction: valid bid accepted', good.ok === true, good.error || '');
  s = await state();
  check('auction: price + top bidder updated', s.currentPrice === floor + 1 && String(s.highestBidder) === String(teamA));
  const reBid = await emit(aSock, 'bid', { amount: floor + 2 });
  check('auction: already-top-bidder rejected', !!reBid.error, reBid.error || '');

  // Simultaneous identical bids from 3 other captains → exactly one wins.
  s = await state();
  const eligible = [{ team: teamB, sock: bSock }, ...cSocks].filter((c) => { const v = s.teams.find((x) => String(x.id) === String(c.team)); return v && v.safeMax >= s.currentPrice + 1; });
  const amt = s.currentPrice + 1;
  const acks = await Promise.all(eligible.slice(0, 3).map((c) => emit(c.sock, 'bid', { amount: amt })));
  check('auction: simultaneous identical bids → exactly one wins', acks.filter((x) => x.ok).length === 1, `${acks.filter((x) => x.ok).length} of 3`);

  // Hammer → sold. Capture winner + player for later poach/stats.
  const beforeSale = await state();
  const soldPlayerId = String(beforeSale.currentPlayer._id);
  const winnerId = String(beforeSale.highestBidder);
  const price = beforeSale.currentPrice;
  const winnerBudgetBefore = beforeSale.teams.find((x) => String(x.id) === winnerId).currentBudget;
  await emit(aucSock, 'hammer', {});
  await sleep(150);
  let after = await state();
  const winnerAfter = after.teams.find((x) => String(x.id) === winnerId);
  check('auction: hammer sells (budget down, roster up, idle)', after.status === 'idle' && winnerAfter.currentBudget === winnerBudgetBefore - price && winnerAfter.rosterCount === 1, `${winnerAfter.currentBudget} r${winnerAfter.rosterCount}`);

  // Undo on a SECOND sale.
  await emit(aucSock, 'selectPlayer', { pass: 1 });
  await emit(aucSock, 'startAuction', {});
  let s2 = await state();
  await emit(aSock, 'bid', { amount: s2.currentPrice + 1 });
  const preUndo = (await state()).teams.find((x) => String(x.id) === String(teamA));
  await emit(aucSock, 'hammer', {}); await sleep(120);
  await emit(aucSock, 'undoLastSale', {}); await sleep(120);
  const postUndo = (await state()).teams.find((x) => String(x.id) === String(teamA));
  check('auction: undo refunds + frees slot', postUndo.currentBudget === preUndo.currentBudget && postUndo.rosterCount === preUndo.rosterCount, `${postUndo.currentBudget}/${postUndo.rosterCount}`);

  // Mark unsold (hammer with no bids) + pass-2 availability.
  const unsoldBefore = (await state()).counts.unsold;
  await emit(aucSock, 'selectPlayer', { pass: 1 });
  await emit(aucSock, 'startAuction', {});
  await emit(aucSock, 'hammer', {}); await sleep(120);
  const afterUnsold = await state();
  check('auction: hammer with no bids → unsold', afterUnsold.counts.unsold === unsoldBefore + 1, `${afterUnsold.counts.unsold}`);
  const pass2 = await emit(aucSock, 'selectPlayer', { pass: 2 });
  check('auction: pass-2 can draw an unsold player', pass2.ok === true, pass2.error || '');
  await emit(aucSock, 'hammer', {}); await sleep(100); // clear it back to idle

  // Pause / resume.
  await emit(aucSock, 'selectPlayer', { pass: 1 });
  await emit(aucSock, 'startAuction', {});
  await emit(aucSock, 'pause', {});
  check('auction: pause → paused', (await state()).status === 'paused');
  await emit(aucSock, 'resume', {});
  check('auction: resume → live', (await state()).status === 'live');
  await emit(aucSock, 'hammer', {}); await sleep(100);

  [aucSock, aSock, bSock, ...cSocks.map((c) => c.sock)].forEach((x) => x.close());

  /* ============================= MATCH DAY ============================= */
  const mkBad1 = await req(`/api/tournaments/${tid}/matches`, { method: 'POST', token: adminTok, body: { round: 'R1', teamA, teamB: teamA } });
  check('matchday: team cannot play itself (400)', mkBad1.status === 400);
  const mkBad2 = await req(`/api/tournaments/${tid}/matches`, { method: 'POST', token: adminTok, body: { round: 'R1' } });
  check('matchday: missing teams rejected (400)', mkBad2.status === 400);
  const mkForbidden = await req(`/api/tournaments/${tid}/matches`, { method: 'POST', token: capA.data.token, body: { round: 'R1', teamA, teamB } });
  check('matchday: captain cannot create matches (403)', mkForbidden.status === 403);
  const mk = await req(`/api/tournaments/${tid}/matches`, { method: 'POST', token: adminTok, body: { round: 'Final', teamA, teamB } });
  check('matchday: admin creates a match (200)', mk.status === 200 && !!mk.data.match);
  const matchId = mk.data.match._id;
  const upd = await req(`/api/matches/${matchId}`, { method: 'PATCH', token: adminTok, body: { status: 'complete', scoreA: 13, scoreB: 8, winner: teamA } });
  check('matchday: result saved', upd.status === 200 && upd.data.match.winner);

  /* =============================== STATS =============================== */
  const statSave = await req(`/api/matches/${matchId}/stats`, { method: 'POST', token: adminTok, body: { lines: [{ player: soldPlayerId, team: teamA, stats: { kills: 20, deaths: 10, assists: 6, firstBloods: 3, plants: 1 } }] } });
  check('stats: bulk stat entry saved', statSave.status === 200 && statSave.data.saved === 1);
  const statGet = await req(`/api/matches/${matchId}/stats`, { token: adminTok });
  check('stats: stat line stamped with team-at-match', statGet.data.stats?.[0]?.team && String(statGet.data.stats[0].team) === String(teamA));

  /* =============================== POACH =============================== */
  const poach = await req(`/api/tournaments/${tid}/poach`, { method: 'POST', token: adminTok, body: { match: matchId, player: soldPlayerId, fromTeam: teamA, toTeam: teamB } });
  check('poach: recorded (200)', poach.status === 200);
  const t2 = await req(`/api/tournaments/${tid}`, { token: adminTok });
  const movedPlayer = t2.data.players.find((p) => String(p._id) === soldPlayerId);
  check('poach: player currentTeam updated to new team', String(movedPlayer.currentTeam) === String(teamB));
  const teamAafter = t2.data.teams.find((x) => String(x._id) === String(teamA));
  const teamBafter = t2.data.teams.find((x) => String(x._id) === String(teamB));
  check('poach: rosters updated (left old, joined new)', !teamAafter.roster.map(String).includes(soldPlayerId) && teamBafter.roster.map(String).includes(soldPlayerId));
  const statAfterPoach = await req(`/api/matches/${matchId}/stats`, { token: adminTok });
  check('poach: past stat line keeps ORIGINAL team (history intact)', String(statAfterPoach.data.stats[0].team) === String(teamA));

  /* ============================= ANALYTICS ============================= */
  const an = await req(`/api/tournaments/${tid}/analytics`, { token: adminTok });
  check('analytics: endpoint returns bundle', an.status === 200 && Array.isArray(an.data.mvp));
  check('analytics: leaderboard reflects the win', (an.data.leaderboard || []).find((r) => String(r.teamId) === String(teamA))?.wins === 1);
  check('analytics: MVP includes the player with stats', (an.data.mvp || []).some((r) => r.playerId === soldPlayerId && r.games >= 1));

  /* ============================ PUBLIC HUB ============================= */
  const hubNoAuth = await req(`/api/public/${tid}`); // deliberately NO token
  check('hub: public hub accessible WITHOUT auth (200)', hubNoAuth.status === 200);
  check('hub: returns tournament + analytics + matches', !!hubNoAuth.data.tournament && !!hubNoAuth.data.analytics && Array.isArray(hubNoAuth.data.matches));
  const hubBad = await req('/api/public/000000000000000000000000');
  check('hub: unknown tournament → 404', hubBad.status === 404);

  /* ======================= SELF-REGISTRATION ========================= */
  const regBody = { tournament: tid, username: 'e2e_player', password: 'secret1', name: 'E2E Player', inGameName: 'E2E#1', rank: 'Gold', role: 'Duelist' };
  const regClosed = await req('/api/auth/register', { method: 'POST', body: regBody });
  check('register: rejected while registration is closed (403)', regClosed.status === 403, `${regClosed.status}`);
  const opened = await req(`/api/tournaments/${tid}/registration`, { method: 'PATCH', token: adminTok, body: { registrationOpen: true } });
  check('register: admin opens registration', opened.status === 200 && opened.data.tournament.registrationOpen === true);
  const reg1 = await req('/api/auth/register', { method: 'POST', body: regBody });
  check('register: valid self-registration → pending player + token', reg1.status === 200 && !!reg1.data.token && reg1.data.player.status === 'pending');
  const newPlayerId = reg1.data.player?._id;
  const newPlayerTok = reg1.data.token;
  const dup = await req('/api/auth/register', { method: 'POST', body: regBody });
  check('register: duplicate username rejected (409)', dup.status === 409, `${dup.status}`);
  const pendingList = await req(`/api/tournaments/${tid}/registrations`, { token: adminTok });
  check('register: pending player appears in admin review list', (pendingList.data.players || []).some((p) => String(p._id) === String(newPlayerId)));
  const myEdit = await req('/api/players/me', { method: 'PATCH', token: newPlayerTok, body: { gameStyle: 'aggressive entry' } });
  check('register: player edits own profile', myEdit.status === 200 && myEdit.data.player.gameStyle === 'aggressive entry');
  const approve = await req(`/api/players/${newPlayerId}/approve`, { method: 'PATCH', token: adminTok, body: { rank: 'Gold' } });
  check('register: admin approval moves player into the pool', approve.status === 200 && approve.data.player.status === 'pool' && approve.data.player.rankApproved === true);
  await req(`/api/tournaments/${tid}/registration`, { method: 'PATCH', token: adminTok, body: { rosterLocked: true } });
  const lockedEdit = await req('/api/players/me', { method: 'PATCH', token: newPlayerTok, body: { phone: '123' } });
  check('register: profile edits blocked once roster locked (403)', lockedEdit.status === 403, `${lockedEdit.status}`);

  /* =================== ECONOMY LOCK + RATE LIMIT ===================== */
  const locked = await req(`/api/tournaments/${tid}/economy`, { method: 'PATCH', token: adminTok, body: { rankTable: t.data.tournament.rankTable } });
  check('economy: locked after the auction has started (409)', locked.status === 409, `${locked.status}`);

  const burst = await Promise.all(Array.from({ length: 55 }, () => req('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'nope' } })));
  check('security: login is rate-limited (429) under a burst', burst.some((r) => r.status === 429), `statuses incl ${[...new Set(burst.map((r) => r.status))].join(',')}`);

  await sleep(100);
  return { results, failures: results.filter((r) => !r.ok).length };
}
