/**
 * Scoreboard parser — the pluggable seam for stat ingestion. It turns a block
 * of pasted/CSV scoreboard text into stat lines matched to players, producing
 * the SAME { player, stats } shape the stats endpoint already accepts.
 *
 * This is deliberately the single integration point: a future OCR step (read a
 * Valorant end-screen screenshot → text) or a tracker-API pull just needs to
 * produce the same text/rows and feed them through here — no other code
 * changes. Pure and unit-tested.
 *
 * Accepted formats per line (one player per line):
 *   "Name, kills, deaths, assists, firstBloods, plants"   (CSV)
 *   "Name   kills deaths assists firstBloods plants"        (whitespace)
 * The name may contain spaces; the trailing run of integers is read as stats
 * in the order of `statKeys`.
 */
const DEFAULT_KEYS = ['kills', 'deaths', 'assists', 'firstBloods', 'plants'];

const norm = (s) => String(s || '').toLowerCase().split('#')[0].replace(/[^a-z0-9]/g, '');

export function parseScoreboard(text, players, statKeys = DEFAULT_KEYS) {
  const index = players.map((p) => ({
    p,
    keys: [norm(p.name), norm(p.inGameName)].filter(Boolean),
  }));

  const lines = [];
  const unmatched = [];

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.includes(',') ? line.split(',').map((x) => x.trim()) : line.split(/\s+/);
    // Trailing run of integers = the stat numbers; everything before = the name.
    const nums = [];
    let i = parts.length - 1;
    while (i >= 0 && /^-?\d+$/.test(parts[i])) { nums.unshift(Number(parts[i])); i -= 1; }
    const name = parts.slice(0, i + 1).join(' ').trim();
    if (!name || !nums.length) continue;

    const nkey = norm(name);
    let match = index.find((x) => x.keys.includes(nkey));
    if (!match) match = index.find((x) => x.keys.some((k) => k.length >= 3 && (k.includes(nkey) || nkey.includes(k))));
    if (!match) { unmatched.push(name); continue; }

    const stats = {};
    statKeys.forEach((k, idx) => { if (nums[idx] != null) stats[k] = nums[idx]; });
    lines.push({ player: String(match.p._id ?? match.p.id), stats });
  }

  return { lines, unmatched };
}

export default parseScoreboard;
