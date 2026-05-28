import express from 'express';
import Player from '../models/Player.js';
import Tournament from '../models/Tournament.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const admin = requireRole('admin', 'auctioneer');

const floorFor = (tournament, rank) => tournament?.rankTable.find((r) => r.rank === rank)?.floorPrice;

/** GET own player profile (for a logged-in player). */
router.get('/players/me', requireAuth, async (req, res) => {
  if (!req.account.player) return res.status(404).json({ error: 'No player profile linked to this account' });
  const player = await Player.findById(req.account.player).lean();
  if (!player) return res.status(404).json({ error: 'Profile not found' });
  const tournament = await Tournament.findById(player.tournament).lean();
  res.json({ player, rosterLocked: !!tournament?.rosterLocked, rankTable: tournament?.rankTable || [] });
});

/** PATCH own profile — allowed until the roster is locked. Changing rank
 *  resets approval (back to pending) so an admin re-checks it. */
router.patch('/players/me', requireAuth, async (req, res) => {
  if (!req.account.player) return res.status(404).json({ error: 'No player profile' });
  const player = await Player.findById(req.account.player);
  if (!player) return res.status(404).json({ error: 'Profile not found' });
  const tournament = await Tournament.findById(player.tournament);
  if (tournament?.rosterLocked) return res.status(403).json({ error: 'The roster is locked — profiles can no longer be edited' });

  const { name, inGameName, phone, role, gameStyle, photoUrl, rank } = req.body || {};
  if (name !== undefined) player.name = name;
  if (inGameName !== undefined) player.inGameName = inGameName;
  if (phone !== undefined) player.phone = phone;
  if (role !== undefined) player.role = role;
  if (gameStyle !== undefined) player.gameStyle = gameStyle;
  if (photoUrl !== undefined) player.photoUrl = photoUrl;
  if (rank !== undefined && rank !== player.rank) {
    const ranks = new Set((tournament?.rankTable || []).map((r) => r.rank));
    if (ranks.size && !ranks.has(rank)) return res.status(400).json({ error: 'Unknown rank' });
    player.rank = rank;
    player.rankApproved = false;
    player.status = 'pending';
    player.floorPrice = floorFor(tournament, rank) ?? player.floorPrice;
  }
  await player.save();
  res.json({ player });
});

/** GET pending self-registrations for review (admin). */
router.get('/tournaments/:tid/registrations', requireAuth, admin, async (req, res) => {
  const players = await Player.find({ tournament: req.params.tid, status: 'pending' }).sort({ createdAt: 1 }).lean();
  res.json({ players });
});

/** PATCH approve a pending player (admin), optionally overriding the rank.
 *  Sets the floor from the approved rank and moves them into the pool. */
router.patch('/players/:id/approve', requireAuth, admin, async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const tournament = await Tournament.findById(player.tournament);
  const { rank } = req.body || {};
  if (rank) {
    const ranks = new Set((tournament?.rankTable || []).map((r) => r.rank));
    if (ranks.size && !ranks.has(rank)) return res.status(400).json({ error: 'Unknown rank' });
    player.rank = rank;
  }
  player.floorPrice = floorFor(tournament, player.rank) ?? player.floorPrice;
  player.rankApproved = true;
  player.status = 'pool';
  await player.save();
  res.json({ player });
});

/** PATCH toggle registration open / roster lock (admin). */
router.patch('/tournaments/:tid/registration', requireAuth, admin, async (req, res) => {
  const t = await Tournament.findById(req.params.tid);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  const { registrationOpen, rosterLocked } = req.body || {};
  if (registrationOpen !== undefined) t.registrationOpen = !!registrationOpen;
  if (rosterLocked !== undefined) t.rosterLocked = !!rosterLocked;
  await t.save();
  res.json({ tournament: t });
});

export default router;
