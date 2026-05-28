import express from 'express';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import { Match } from '../models/matchModels.js';
import { gatherAnalytics } from './matchday.js';

/**
 * The Public Tournament Hub — a single read-only, NO-AUTH endpoint that powers
 * the shareable spectator page: schedule, standings, every player's price and
 * stats, the MVP race, and the Watchlist / Washed list. Safe to expose since it
 * exposes no credentials and accepts no mutations.
 */
const router = express.Router();

/** GET the latest tournament (no auth) — powers the landing page's links. */
router.get('/', async (_req, res) => {
  const t = await Tournament.findOne().sort({ createdAt: -1 }).lean();
  if (!t) return res.json({ tournament: null });
  res.json({ tournament: { id: t._id, name: t.name, game: t.game, status: t.status, registrationOpen: !!t.registrationOpen } });
});

/** GET the tournament currently open for self-registration (no auth). Returns
 *  the info the public register form needs, or { tournament: null }. */
router.get('/registration/open', async (_req, res) => {
  const t = await Tournament.findOne({ registrationOpen: true }).sort({ createdAt: -1 }).lean();
  if (!t) return res.json({ tournament: null });
  res.json({ tournament: { id: t._id, name: t.name, game: t.game, rankTable: t.rankTable } });
});

router.get('/:tid', async (req, res) => {
  const tournament = await Tournament.findById(req.params.tid).lean();
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  const [teams, players, matches, analyticsData] = await Promise.all([
    Team.find({ tournament: tournament._id }).lean(),
    Player.find({ tournament: tournament._id }).lean(),
    Match.find({ tournament: tournament._id }).sort({ scheduledTime: 1, createdAt: 1 }).lean(),
    gatherAnalytics(req.params.tid),
  ]);

  const teamName = new Map(teams.map((t) => [String(t._id), t.name]));

  res.json({
    tournament: {
      id: tournament._id,
      name: tournament.name,
      game: tournament.game,
      status: tournament.status,
      startDate: tournament.startDate,
      finalsDate: tournament.finalsDate,
      settings: tournament.settings,
    },
    teams: teams.map((t) => ({
      id: t._id, name: t.name, currentBudget: t.currentBudget, startingBudget: t.startingBudget,
      core1: t.core1, core2: t.core2, roster: t.roster,
    })),
    players: players.map((p) => ({
      id: p._id, name: p.name, inGameName: p.inGameName, rank: p.rank, role: p.role,
      isCore: p.isCore, status: p.status, soldPrice: p.soldPrice,
      currentTeam: p.currentTeam, currentTeamName: teamName.get(String(p.currentTeam)) || null,
    })),
    matches: matches.map((m) => ({
      id: m._id, round: m.round, scheduledTime: m.scheduledTime, status: m.status,
      teamA: m.teamA, teamB: m.teamB, teamAName: teamName.get(String(m.teamA)), teamBName: teamName.get(String(m.teamB)),
      scoreA: m.scoreA, scoreB: m.scoreB, winner: m.winner,
    })),
    analytics: analyticsData?.analytics || null,
  });
});

export default router;
