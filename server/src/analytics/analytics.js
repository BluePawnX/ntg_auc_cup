/**
 * Analytics engine (Module D). Pure functions — no DB — so the maths can be
 * reasoned about and unit-tested on its own. Everything is derived from the
 * raw stat lines, player prices and match results; nothing is stored.
 *
 * Concepts (from the plan §9):
 *  - Performance Score: per player, averaged across every game they played,
 *    regardless of team/poaching. Default Valorant formula = average KDA.
 *  - MVP race: players ranked by Performance Score.
 *  - Value Index = performance percentile − price percentile. Strongly
 *    positive → Watchlist (great value); strongly negative → Washed list.
 *    Cores are priced by their rank's core-deduction cost so they're included.
 *  - Leaderboard: team standings from completed match results.
 */

/** Named per-game impact formulas. A game template picks one by key. */
export const performanceFormulas = {
  // Simple KDA: (kills + assists) / max(deaths, 1)
  avg_kda: (s) => (num(s.kills) + num(s.assists)) / Math.max(num(s.deaths), 1),
  // Composite Valorant impact per game. KDA is the core; first bloods reward
  // entry kills (high-leverage round opens); plants reward objective play.
  // Weights are tuned so KDA still dominates a typical game (KDA of 3 +
  // 4 FB·0.5 = 5, +3 plants·0.3 = 5.9 — plants nudge but don't decide).
  valorant_mvp: (s) =>
    (num(s.kills) + num(s.assists)) / Math.max(num(s.deaths), 1)
    + 0.5 * num(s.firstBloods)
    + 0.3 * num(s.plants),
  // Average combat score, if a template tracks acs
  avg_acs: (s) => num(s.acs),
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Per-player Performance Score.
 *
 * The aggregation is explicitly designed so that playing MORE games can never
 * hurt a player's MVP chances:
 *
 *  1. Per-game impact is computed by the active formula.
 *  2. The worst floor(games * 0.25) games are DROPPED before averaging — so
 *     a couple of bad games don't drag down a strong overall body of work.
 *  3. The trimmed average is multiplied by a small volume boost,
 *     1 + 0.05 * log2(1 + games), which rewards showing up game after game
 *     with diminishing returns.
 *
 * Net effect: a player with consistent 5-game performance beats a 1-game
 * flash; a player who plays one bad map in the finals isn't punished for it.
 *
 * @param {Array} statLines  [{ player, stats:{...} }]
 * @param {string} formulaKey
 * @returns Map<playerId, { score, games, rawAvg, trimmed }>
 */
export function playerPerformance(statLines, formulaKey = 'avg_kda') {
  const formula = performanceFormulas[formulaKey] || performanceFormulas.avg_kda;
  const byPlayer = new Map();
  for (const line of statLines) {
    const id = String(line.player);
    const v = formula(line.stats || {});
    const arr = byPlayer.get(id) || [];
    arr.push(v);
    byPlayer.set(id, arr);
  }
  const out = new Map();
  for (const [id, impacts] of byPlayer) {
    const games = impacts.length;
    if (!games) { out.set(id, { score: 0, games: 0, rawAvg: 0, trimmed: 0 }); continue; }
    const sorted = [...impacts].sort((a, b) => b - a);            // best → worst
    const dropCount = Math.floor(games * 0.25);
    const kept = sorted.slice(0, games - dropCount);
    const trimmedAvg = kept.reduce((a, b) => a + b, 0) / kept.length;
    const volumeBoost = 1 + 0.05 * Math.log2(1 + games);
    const score = trimmedAvg * volumeBoost;
    const rawAvg = impacts.reduce((a, b) => a + b, 0) / games;
    out.set(id, { score, games, rawAvg, trimmed: trimmedAvg });
  }
  return out;
}

/**
 * Per-player TOTAL of a single stat key across every game they played.
 * Used to build the max-kills / max-deaths / max-first-bloods / max-plants
 * leaderboards. Returns [{ playerId, total, games }] sorted desc by total.
 */
export function statTotals(statLines, key) {
  const byPlayer = new Map();
  for (const line of statLines) {
    const id = String(line.player);
    const cur = byPlayer.get(id) || { total: 0, games: 0 };
    cur.total += num((line.stats || {})[key]);
    cur.games += 1;
    byPlayer.set(id, cur);
  }
  return [...byPlayer.entries()].map(([playerId, v]) => ({ playerId, total: v.total, games: v.games }));
}

/**
 * Percentile rank of each item's value in [0,100], using the standard
 * (#below + 0.5·#equal) / n convention so ties are handled fairly.
 * @returns Map<id, percentile>
 */
export function percentileRanks(items, getId, getValue) {
  const vals = items.map(getValue);
  const n = vals.length;
  const out = new Map();
  if (!n) return out;
  for (const it of items) {
    const v = getValue(it);
    let below = 0;
    let equal = 0;
    for (const x of vals) {
      if (x < v) below += 1;
      else if (x === v) equal += 1;
    }
    out.set(String(getId(it)), n === 1 ? 50 : ((below + 0.5 * equal) / n) * 100);
  }
  return out;
}

/**
 * Each player's auction price for value analysis. Sold pool players use their
 * soldPrice; cores use their rank's coreCost (implied price) so they're judged
 * fairly. Players who never had a price (unsold, never auctioned) → null.
 */
export function playerPrices(players, rankTable) {
  const coreCostByRank = new Map((rankTable || []).map((r) => [r.rank, r.coreCost]));
  const prices = new Map();
  for (const p of players) {
    const id = String(p._id ?? p.id);
    if (p.isCore) prices.set(id, coreCostByRank.get(p.rank) ?? null);
    else if (p.status === 'sold' && p.soldPrice != null) prices.set(id, p.soldPrice);
    else prices.set(id, null);
  }
  return prices;
}

/** Team standings from completed matches (wins, then point differential). */
export function leaderboard(teams, matches) {
  const row = new Map(
    teams.map((t) => [String(t._id ?? t.id), { teamId: String(t._id ?? t.id), name: t.name, wins: 0, losses: 0, played: 0, diff: 0 }])
  );
  for (const m of matches) {
    if (m.status !== 'complete' || !m.winner) continue;
    const a = row.get(String(m.teamA));
    const b = row.get(String(m.teamB));
    const sA = num(m.scoreA);
    const sB = num(m.scoreB);
    if (a) { a.played += 1; a.diff += sA - sB; a.wins += String(m.winner) === String(m.teamA) ? 1 : 0; a.losses += String(m.winner) === String(m.teamA) ? 0 : 1; }
    if (b) { b.played += 1; b.diff += sB - sA; b.wins += String(m.winner) === String(m.teamB) ? 1 : 0; b.losses += String(m.winner) === String(m.teamB) ? 0 : 1; }
  }
  return [...row.values()].sort((x, y) => y.wins - x.wins || y.diff - x.diff || x.name.localeCompare(y.name));
}

/**
 * The full analytics bundle. Pure: pass in plain data, get plain data back.
 * @param {object} args { players, statLines, matches, teams, rankTable, formulaKey }
 */
export function computeAnalytics({ players = [], statLines = [], matches = [], teams = [], rankTable = [], formulaKey = 'avg_kda' }) {
  const perf = playerPerformance(statLines, formulaKey);
  const prices = playerPrices(players, rankTable);
  const teamName = new Map(teams.map((t) => [String(t._id ?? t.id), t.name]));

  // Build a per-player row with score, price and team.
  const rows = players.map((p) => {
    const id = String(p._id ?? p.id);
    const perfRow = perf.get(id) || { score: 0, games: 0 };
    return {
      playerId: id,
      name: p.name,
      rank: p.rank,
      isCore: !!p.isCore,
      team: teamName.get(String(p.currentTeam)) || null,
      price: prices.get(id) ?? null,
      score: perfRow.score,
      games: perfRow.games,
    };
  });

  // MVP race: anyone who played, ranked by score.
  const played = rows.filter((r) => r.games > 0);
  const mvp = [...played].sort((a, b) => b.score - a.score);

  // Value Index over players who both played and have a price.
  const valued = played.filter((r) => r.price != null);
  const perfPct = percentileRanks(valued, (r) => r.playerId, (r) => r.score);
  const pricePct = percentileRanks(valued, (r) => r.playerId, (r) => r.price);
  const valueRows = valued
    .map((r) => ({
      ...r,
      perfPct: round(perfPct.get(r.playerId)),
      pricePct: round(pricePct.get(r.playerId)),
      valueIndex: round((perfPct.get(r.playerId) || 0) - (pricePct.get(r.playerId) || 0)),
    }))
    .sort((a, b) => b.valueIndex - a.valueIndex);

  const watchlist = valueRows.filter((r) => r.valueIndex >= 20); // strong value
  const washed = [...valueRows].filter((r) => r.valueIndex <= -20).sort((a, b) => a.valueIndex - b.valueIndex);

  // Per-stat tournament leaderboards (max kills / deaths / first bloods /
  // plants). These are TOTALS across every game the player played, so a
  // player who shows up for more games naturally climbs higher — which is
  // exactly the “rewards volume” behavior the MVP race also uses.
  const playerLookup = new Map(players.map((p) => [String(p._id ?? p.id), p]));
  function buildStatBoard(key) {
    return statTotals(statLines, key)
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || a.games - b.games)
      .map((r) => {
        const p = playerLookup.get(r.playerId);
        return {
          playerId: r.playerId,
          name: p?.name || '—',
          team: p?.currentTeam ? teamName.get(String(p.currentTeam)) || null : null,
          total: r.total,
          games: r.games,
          avg: r.games ? Math.round((r.total / r.games) * 10) / 10 : 0,
        };
      });
  }

  return {
    leaderboard: leaderboard(teams, matches),
    mvp,
    valueIndex: valueRows,
    watchlist,
    washed,
    priceVsPerformance: rows.filter((r) => r.price != null),
    formula: formulaKey,
    // Stat leaderboards
    topKills:       buildStatBoard('kills'),
    topDeaths:      buildStatBoard('deaths'),
    topFirstBloods: buildStatBoard('firstBloods'),
    topPlants:      buildStatBoard('plants'),
  };
}

function round(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

export default computeAnalytics;
