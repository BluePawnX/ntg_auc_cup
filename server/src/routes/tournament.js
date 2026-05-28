import express from 'express';
import Tournament from '../models/Tournament.js';
import Player from '../models/Player.js';
import Team from '../models/Team.js';
import AuctionState from '../models/AuctionState.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recomputeEconomy, economyLocked } from '../seed/recomputeEconomy.js';

const router = express.Router();

/** GET /api/tournaments - list all cups (platform dashboard). */
router.get('/', requireAuth, async (_req, res) => {
  const tournaments = await Tournament.find().sort({ createdAt: -1 }).lean();
  res.json({ tournaments });
});

/** GET /api/tournaments/:id - one cup with its teams and players. */
router.get('/:id', requireAuth, async (req, res) => {
  const tournament = await Tournament.findById(req.params.id).lean();
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  const [teams, players] = await Promise.all([
    Team.find({ tournament: tournament._id }).lean(),
    Player.find({ tournament: tournament._id }).lean(),
  ]);
  res.json({ tournament, teams, players });
});

/**
 * PATCH /api/tournaments/:id/economy (admin/auctioneer) — edit the rank table
 * and/or settings WITHOUT touching code. If the change affects the economy
 * (rank table or starting budget), team budgets and player floors are
 * recomputed from the new values — but only BEFORE the auction starts (any
 * sale locks the economy, returning 409). Timer / min-increment can change
 * anytime since they don't affect budgets.
 */
router.patch('/:id/economy', requireAuth, requireRole('admin', 'auctioneer'), async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });

  const { settings, rankTable } = req.body || {};
  const economyChange = !!rankTable || (settings && settings.startingBudget !== undefined);

  if (rankTable && (!Array.isArray(rankTable) || rankTable.some((r) => !r.rank || r.coreCost == null || r.floorPrice == null))) {
    return res.status(400).json({ error: 'rankTable must be an array of { rank, coreCost, floorPrice }' });
  }

  const [teams, players, state] = await Promise.all([
    Team.find({ tournament: t._id }),
    Player.find({ tournament: t._id }),
    AuctionState.findOne({ tournament: t._id }),
  ]);
  const locked = economyLocked(players, teams) || (state && state.status !== 'idle');

  if (economyChange && locked) {
    return res.status(409).json({ error: 'The auction has started — the economy can no longer be changed.' });
  }

  if (settings) for (const [k, v] of Object.entries(settings)) t.settings[k] = v;
  if (rankTable) t.rankTable = rankTable;

  let recomputed = false;
  if (economyChange) {
    let updates;
    try {
      updates = recomputeEconomy({ startingBudget: t.settings.startingBudget, rankTable: t.rankTable, teams, players });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    await Promise.all([
      ...updates.teamUpdates.map((u) =>
        Team.updateOne({ _id: u.id }, { coreDeduction: u.coreDeduction, currentBudget: u.currentBudget, 'core1.rankCost': u.core1RankCost, 'core2.rankCost': u.core2RankCost })
      ),
      ...updates.playerUpdates.map((u) => Player.updateOne({ _id: u.id }, { floorPrice: u.floorPrice })),
    ]);
    recomputed = true;
  }

  await t.save();
  res.json({ tournament: t, recomputed });
});

export default router;
