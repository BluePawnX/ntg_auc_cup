/**
 * Pure validation + normalization for player self-registration. Kept separate
 * from the route so it can be unit-tested. Throws Error(message) on bad input;
 * returns the normalized { account, player } field sets on success.
 */
export function validateRegistration(body = {}, rankTable = []) {
  const required = ['username', 'password', 'name', 'inGameName', 'rank'];
  for (const f of required) {
    if (!String(body[f] ?? '').trim()) throw new Error(`${f} is required`);
  }
  if (String(body.password).length < 6) throw new Error('Password must be at least 6 characters');

  const username = String(body.username).toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new Error('Username must be 3-30 chars: letters, numbers, dot, dash or underscore');
  }

  const ranks = new Set(rankTable.map((r) => r.rank));
  const rank = String(body.rank).trim();
  if (ranks.size && !ranks.has(rank)) {
    throw new Error(`Unknown rank "${rank}". Pick one of: ${[...ranks].join(', ')}`);
  }

  return {
    account: {
      username,
      password: String(body.password),
      displayName: String(body.name).trim(),
      role: 'player',
    },
    player: {
      name: String(body.name).trim(),
      inGameName: String(body.inGameName).trim(),
      phone: String(body.phone ?? '').trim(),
      rank,
      role: String(body.role ?? '').trim(),
      gameStyle: String(body.gameStyle ?? '').trim(),
      photoUrl: String(body.photoUrl ?? '').trim(),
    },
  };
}

export default validateRegistration;
