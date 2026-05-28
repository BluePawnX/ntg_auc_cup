import express from 'express';
import Account from '../models/Account.js';
import Tournament from '../models/Tournament.js';
import Player from '../models/Player.js';
import { issueToken, requireAuth } from '../middleware/auth.js';
import { validateRegistration } from '../auth/registerValidation.js';

const router = express.Router();

/** POST /api/auth/login - username + password, sets the token cookie. */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const account = await Account.findOne({ username: String(username).toLowerCase().trim() });
  if (!account || !(await account.verifyPassword(password))) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  const token = issueToken(account);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 });
  res.json({ account, token });
});

/**
 * POST /api/auth/register - player self-registration. Creates a player account
 * and a PENDING profile (awaiting admin rank approval). Only works while the
 * tournament's registration is open.
 */
router.post('/register', async (req, res) => {
  const tid = req.body?.tournament;
  if (!tid) return res.status(400).json({ error: 'tournament is required' });
  const tournament = await Tournament.findById(tid);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  if (!tournament.registrationOpen) return res.status(403).json({ error: 'Registration is closed for this tournament' });

  let fields;
  try {
    fields = validateRegistration(req.body, tournament.rankTable);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (await Account.findOne({ username: fields.account.username })) {
    return res.status(409).json({ error: 'That username is already taken' });
  }

  const account = new Account({
    username: fields.account.username,
    displayName: fields.account.displayName,
    role: 'player',
    tournament: tournament._id,
  });
  await account.setPassword(fields.account.password);
  await account.save();

  const floorPrice = tournament.rankTable.find((r) => r.rank === fields.player.rank)?.floorPrice ?? 0;
  const player = await Player.create({
    tournament: tournament._id,
    ...fields.player,
    floorPrice,
    status: 'pending',
    rankApproved: false,
    account: account._id,
  });
  account.player = player._id;
  await account.save();

  const token = issueToken(account);
  res.json({ account, token, player });
});

/** POST /api/auth/logout - clears the cookie. */
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

/** GET /api/auth/me - the currently logged-in account. */
router.get('/me', requireAuth, (req, res) => {
  res.json({ account: req.account });
});

export default router;
