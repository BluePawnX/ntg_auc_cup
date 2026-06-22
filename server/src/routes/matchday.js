import express from 'express';
import mongoose from 'mongoose';
import { Match, PlayerMatchStats, PoachEvent } from '../models/matchModels.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import GameTemplate from '../models/GameTemplate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { computeAnalytics } from '../analytics/analytics.js';
import { parseScoreboard } from '../analytics/statsParser.js';

const router = express.Router();
const admin = requireRole('admin', 'auctioneer'); // match-day editors

/** Map a stat line's stats (Mongoose Map or plain) to a plain object. */
const plainStats = (s) => (s instanceof Map ? Object.fromEntries(s) : s || {});

/* ----------------------------- Matches (B) ------------------------------ */

/** GET matches for a tournament. */
router.get('/tournaments/:tid/matches', requireAuth, async (req, res) => {
  const matches = await Match.find({ tournament: req.params.tid }).sort({ scheduledTime: 1, createdAt: 1 }).lean();
  res.json({ matches });
});

/** POST create a match (admin). Entered manually from the bracket. */
router.post('/tournaments/:tid/matches', requireAuth, admin, async (req, res) => {
  const { round, teamA, teamB, scheduledTime } = req.body || {};
  if (!round || !teamA || !teamB) return res.status(400).json({ error: 'round, teamA and teamB are required' });
  if (String(teamA) === String(teamB)) return res.status(400).json({ error: 'A team cannot play itself' });
  const match = await Match.create({
    tournament: req.params.tid, round, teamA, teamB,
    scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
  });
  res.json({ match });
});

/** PATCH a match: schedule, status, or result (admin). */
router.patch('/matches/:mid', requireAuth, admin, async (req, res) => {
  const { round, scheduledTime, status, winner, scoreA, scoreB } = req.body || {};
  const update = {};
  if (round !== undefined) update.round = round;
  if (scheduledTime !== undefined) update.scheduledTime = scheduledTime ? new Date(scheduledTime) : null;
  if (status !== undefined) update.status = status;
  if (winner !== undefined) update.winner = winner || null;
  if (scoreA !== undefined) update.scoreA = scoreA;
  if (scoreB !== undefined) update.scoreB = scoreB;
  const match = await Match.findByIdAndUpdate(req.params.mid, update, { new: true });
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json({ match });
});

/** DELETE a match and its stat lines (admin). */
router.delete('/matches/:mid', requireAuth, admin, async (req, res) => {
  await PlayerMatchStats.deleteMany({ match: req.params.mid });
  await Match.findByIdAndDelete(req.params.mid);
  res.json({ ok: true });
});

/* ------------------------------ Stats (C) ------------------------------- */

/** GET stat lines for a match. */
router.get('/matches/:mid/stats', requireAuth, async (req, res) => {
  const stats = await PlayerMatchStats.find({ match: req.params.mid }).lean();
  res.json({ stats: stats.map((s) => ({ ...s, stats: plainStats(s.stats) })) });
});

/**
 * POST/upsert stat lines for a match (admin). Body: { lines: [{ player, team, stats }] }.
 * Each line is stamped with the team the player was on for THIS match, so
 * poaching never corrupts personal history. Re-posting edits existing lines.
 */
router.post('/matches/:mid/stats', requireAuth, admin, async (req, res) => {
  const match = await Match.findById(req.params.mid);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
  const saved = [];
  for (const line of lines) {
    if (!line.player || !line.team) continue;
    const doc = await PlayerMatchStats.findOneAndUpdate(
      { match: match._id, player: line.player },
      { tournament: match.tournament, match: match._id, player: line.player, team: line.team, stats: line.stats || {} },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    saved.push(doc);
  }
  res.json({ saved: saved.length });
});

/** PATCH a single stat line (admin) — stats are editable after entry. */
router.patch('/stats/:sid', requireAuth, admin, async (req, res) => {
  const update = {};
  if (req.body?.stats) update.stats = req.body.stats;
  if (req.body?.team) update.team = req.body.team;
  const line = await PlayerMatchStats.findByIdAndUpdate(req.params.sid, update, { new: true });
  if (!line) return res.status(404).json({ error: 'Stat line not found' });
  res.json({ line });
});

/**
 * POST parse a pasted/CSV scoreboard into stat lines matched to this match's
 * squads (admin). The pluggable seam: future OCR / tracker-API ingestion feeds
 * the same parser. Returns { lines, unmatched } — the UI prefills the form.
 */
router.post('/matches/:mid/stats/parse', requireAuth, admin, async (req, res) => {
  const match = await Match.findById(req.params.mid).lean();
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const teams = await Team.find({ _id: { $in: [match.teamA, match.teamB] } }).lean();
  const ids = [];
  for (const t of teams) {
    if (t.core1?.player) ids.push(t.core1.player);
    if (t.core2?.player) ids.push(t.core2.player);
    for (const r of t.roster || []) ids.push(r);
  }
  const squad = await Player.find({ _id: { $in: ids } }).lean();
  const { lines, unmatched } = parseScoreboard(req.body?.text || '', squad);
  res.json({ lines, unmatched });
});

/* ----------------------------- Poaching (B) ----------------------------- */

/**
 * POST a poach (admin): a player moves from one team to another after a match.
 * Records a PoachEvent and updates the live rosters + the player's currentTeam.
 * Past stat lines keep their original team stamp, so history stays intact.
 *
 * Repeat poaches are supported — a player can be moved A→B→A→C across the
 * tournament. The roster cleanup scans EVERY team in the tournament and pulls
 * the player out of any stale roster, so a re-poach can't leave them on two
 * teams at once. The match link is optional (e.g. finals-level poach with no
 * specific match attached).
 */
router.post('/tournaments/:tid/poach', requireAuth, admin, async (req, res) => {
  const { match, player, fromTeam, toTeam } = req.body || {};
  if (!player || !fromTeam || !toTeam) return res.status(400).json({ error: 'player, fromTeam and toTeam are required' });
  if (String(fromTeam) === String(toTeam)) return res.status(400).json({ error: 'fromTeam and toTeam must differ' });

  const [from, to, p] = await Promise.all([Team.findById(fromTeam), Team.findById(toTeam), Player.findById(player)]);
  if (!from || !to || !p) return res.status(404).json({ error: 'Team or player not found' });

  // Defensive cleanup: pull the player off EVERY roster in this tournament so a
  // re-poach can't leave stale entries behind. Required because the user may
  // record fromTeam = the player's original team even after a prior poach.
  const allTeams = await Team.find({ tournament: req.params.tid });
  const updates = [];
  for (const t of allTeams) {
    const before = t.roster.length;
    t.roster = t.roster.filter((id) => String(id) !== String(player));
    if (t.roster.length !== before) updates.push(t.save());
  }
  if (!to.roster.some((id) => String(id) === String(player))) to.roster.push(p._id);
  updates.push(to.save());
  p.currentTeam = to._id;
  updates.push(p.save());
  await Promise.all(updates);

  await PoachEvent.create({
    tournament: req.params.tid,
    match: match || undefined,
    player,
    fromTeam,
    toTeam,
  });
  res.json({ ok: true });
});

/* ---------------------------- Analytics (D) ----------------------------- */

async function gatherAnalytics(tid) {
  const [tournament, teams, players, statLines, matches] = await Promise.all([
    Tournament.findById(tid).lean(),
    Team.find({ tournament: tid }).lean(),
    Player.find({ tournament: tid }).lean(),
    PlayerMatchStats.find({ tournament: tid }).lean(),
    Match.find({ tournament: tid }).lean(),
  ]);
  if (!tournament) return null;
  const template = await GameTemplate.findOne({ game: tournament.game }).lean();
  const normalized = statLines.map((l) => ({ player: l.player, team: l.team, stats: plainStats(l.stats) }));
  const analytics = computeAnalytics({
    players, statLines: normalized, matches, teams,
    rankTable: tournament.rankTable, formulaKey: template?.performanceFormula || 'avg_kda',
  });
  return { tournament, analytics };
}

/** GET computed analytics for a tournament (auth). */
router.get('/tournaments/:tid/analytics', requireAuth, async (req, res) => {
  const data = await gatherAnalytics(req.params.tid);
  if (!data) return res.status(404).json({ error: 'Tournament not found' });
  res.json(data.analytics);
});

export { router as matchdayRouter, gatherAnalytics };
export default router;
