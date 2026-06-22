/**
 * Analytics engine (Module D). Pure functions, no DB.
 */

/** Named per-game impact formulas. A game template picks one by key. */
export const performanceFormulas = {
  avg_kda: (s) => (num(s.kills) + num(s.assists)) / Math.max(num(s.deaths), 1),
  valorant_mvp: (s) =>
    (num(s.kills) + num(s.assists)) / Math.max(num(s.deaths), 1)
    + 0.5 * num(s.firstBloods)
    + 0.3 * num(s.plants),
  avg_acs: (s) => num(s.acs),
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// MVP aggregation tunables.
export const MVP_TRIM_RATIO       = 0.25;
export const MVP_PRIOR_WEIGHT     = 3;
export const MVP_TYPICAL_GAMES    = 3;
export const MVP_INVOLVEMENT_CAP  = 1.4;

/**
 * Per-player MVP score:
 *   1. Per-game impact from active formula.
 *   2. Drop worst floor(games * 0.25) games -> trimmedAvg.
 *   3. Shrinkage toward globalMean: (games*trimmedAvg + 3*globalMean) / (games + 3).
 *   4. Involvement multiplier: min(1.4, sqrt(games/3)).
 *   5. score = shrunk * involvement.
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

  const stage1 = new Map();
  for (const [id, impacts] of byPlayer) {
    const games = impacts.length;
    if (!games) { stage1.set(id, { games: 0, trimmedAvg: 0, rawAvg: 0 }); continue; }
    const sorted = [...impacts].sort((a, b) => b - a);
    const dropCount = Math.floor(games * MVP_TRIM_RATIO);
    const kept = sorted.slice(0, games - dropCount);
    const trimmedAvg = kept.reduce((a, b) => a + b, 0) / kept.length;
    const rawAvg = impacts.reduce((a, b) => a + b, 0) / games;
    stage1.set(id, { games, trimmedAvg, rawAvg });
  }

  const trimmedAvgs = [...stage1.values()].filter((v) => v.games > 0).map((v) => v.trimmedAvg);
  const globalMean = trimmedAvgs.length
    ? trimmedAvgs.reduce((a, b) => a + b, 0) / trimmedAvgs.length
    : 0;

  const out = new Map();
  for (const [id, { games, trimmedAvg, rawAvg }] of stage1) {
    if (!games) { out.set(id, { score: 0, games: 0, rawAvg: 0, trimmed: 0, shrunk: 0, involvement: 0 }); continue; }
    const shrunk = (games * trimmedAvg + MVP_PRIOR_WEIGHT * globalMean) / (games + MVP_PRIOR_WEIGHT);
    const involvement = Math.min(MVP_INVOLVEMENT_CAP, Math.sqrt(games / MVP_TYPICAL_GAMES));
    const score = shrunk * involvement;
    out.set(id, { score, games, rawAvg, trimmed: trimmedAvg, shrunk, involvement });
  }
  return out;
}

/** Per-player TOTAL of a single stat key across every game they played. */
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

/** Percentile rank with (#below + 0.5*#equal) / n convention. */
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

/** Each player's auction price for value analysis. */
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

/** Team standings from completed matches. */
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

/** The full analytics bundle. */
export function computeAnalytics({ players = [], statLines = [], matches = [], teams = [], rankTable = [], formulaKey = 'avg_kda' }) {
  const perf = playerPerformance(statLines, formulaKey);
  const prices = playerPrices(players, rankTable);
  const teamName = new Map(teams.map((t) => [String(t._id ?? t.id), t.name]));

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

  const played = rows.filter((r) => r.games > 0);
  const mvp = [...played].sort((a, b) => b.score - a.score);

  // Value Index, Watchlist and Washed list intentionally EXCLUDE cores
  // (captains + co-captains). Their "price" is the rank-based coreCost — it
  // wasn't set by the auction, so judging them as bargains/overpays is
  // misleading. Cores still appear in the MVP race and per-stat boards.
  const valuedNonCore = played.filter((r) => r.price != null && !r.isCore);
  const perfPct = percentileRanks(valuedNonCore, (r) => r.playerId, (r) => r.score);
  const pricePct = percentileRanks(valuedNonCore, (r) => r.playerId, (r) => r.price);
  const valueRows = valuedNonCore
    .map((r) => ({
      ...r,
      perfPct: round(perfPct.get(r.playerId)),
      pricePct: round(pricePct.get(r.playerId)),
      valueIndex: round((perfPct.get(r.playerId) || 0) - (pricePct.get(r.playerId) || 0)),
    }))
    .sort((a, b) => b.valueIndex - a.valueIndex);

  const watchlist = valueRows.filter((r) => r.valueIndex >= 20);
  const washed = [...valueRows].filter((r) => r.valueIndex <= -20).sort((a, b) => a.valueIndex - b.valueIndex);

  const playerLookup = new Map(players.map((p) => [String(p._id ?? p.id), p]));
  function buildStatBoard(key) {
    return statTotals(statLines, key)
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || a.games - b.games)
      .map((r) => {
        const p = playerLookup.get(r.playerId);
        return {
          playerId: r.playerId,
          name: p?.name || '-',
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
    // priceVsPerformance still includes everyone with a price (scatter plot
    // can use the full picture); the auction-value lists above use the
    // filtered view.
    priceVsPerformance: rows.filter((r) => r.price != null),
    formula: formulaKey,
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
