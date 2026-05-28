import jwt from 'jsonwebtoken';
import Account from '../models/Account.js';

/**
 * Issues a signed JWT for an account. Stored client-side in an httpOnly
 * cookie so it cannot be read by page scripts.
 */
export function issueToken(account) {
  return jwt.sign(
    { id: account._id, role: account.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' } // long enough to cover a full event day
  );
}

/**
 * Express middleware: verifies the token, loads the account, attaches it to
 * req.account. Rejects the request if the token is missing or invalid.
 */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const account = await Account.findById(payload.id);
    if (!account) return res.status(401).json({ error: 'Account no longer exists' });
    req.account = account;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired - please log in again' });
  }
}

/**
 * Express middleware factory: allows only the listed roles through.
 * Usage: router.post('/x', requireAuth, requireRole('admin'), handler)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.account || !roles.includes(req.account.role)) {
      return res.status(403).json({ error: 'You do not have permission for this action' });
    }
    next();
  };
}

/**
 * Verifies a token string directly (used by the Socket.io handshake, which
 * does not pass through Express middleware). Returns the account or null.
 */
export async function accountFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return await Account.findById(payload.id);
  } catch {
    return null;
  }
}
