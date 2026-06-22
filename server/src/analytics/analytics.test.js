import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  playerPerformance,
  percentileRanks,
  playerPrices,
  leaderboard,
  computeAnalytics,
  statTotals,
} from './analytics.js';

/* --------------------------- performance score -------------------------- */

test('playerPerformance: rawAvg exposed for transparency', () => {
  const lines = [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 4 } }, // 7
    { player: 'p1', stats: { kills: 4, deaths: 4, assists: 4 } },  // 2
  ];
  const perf = playerPerformance(lines, 'avg_kda');
  assert.equal(perf.get('p1').games, 2);
  assert.equal(perf.get('p1').rawAvg, 4.5);
});

test('playerPerformance guards against divide-by-zero deaths', () => {
  const perf = playerPerformance([{ player: 'x', stats: { kills: 5, deaths: 0, assists: 1 } }], 'avg_kda');
  assert.equal(perf.get('x').rawAvg, 6);
});

test('playerPerformance: every game is included (no trim)', () => {
  // 4 games at 5.0 + 1 game at 0.1 -> rawAvg includes the bad game
  const lines = [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 0 } }, // 5
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 0 } }, // 5
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 0 } }, // 5
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 0 } }, // 5
    { player: 'p1', stats: { kills: 1,  deaths: 10, assists: 0 } }, // 0.1
  ];
  const perf = playerPerformance(lines, 'avg_kda');
  assert.equal(perf.get('p1').games, 5);
  // rawAvg = (5+5+5+5+0.1) / 5 = 4.02
  assert.ok(Math.abs(perf.get('p1').rawAvg - 4.02) < 0.001);
});

test('playerPerformance: more games -> strictly higher score for same quality', () => {
  const goodGame = { kills: 10, deaths: 2, assists: 4 };
  const lines = [
    { player: 'p1', stats: goodGame },
    { player: 'p2', stats: goodGame },
    { player: 'p2', stats: goodGame },
    { player: 'p2', stats: goodGame },
    { player: 'p2', stats: goodGame },
  ];
  const perf = playerPerformance(lines, 'avg_kda');
  assert.ok(perf.get('p2').score > perf.get('p1').score, 'volume helps for same quality');
});

test('playerPerformance: 1-game stellar does NOT beat 4-game above-average body of work', () => {
  const stellar = { kills: 20, deaths: 2, assists: 4, firstBloods: 3, plants: 2 };
  const aboveAvg = { kills: 12, deaths: 4, assists: 4, firstBloods: 1, plants: 1 };
  const lines = [
    { player: 'rajiv', stats: stellar },
    ...[1, 2, 3, 4].map(() => ({ player: 'finalist', stats: aboveAvg })),
    ...['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'].flatMap((id) =>
      [1, 2].map(() => ({ player: id, stats: { kills: 8, deaths: 6, assists: 3, firstBloods: 1, plants: 1 } }))
    ),
  ];
  const perf = playerPerformance(lines, 'valorant_mvp');
  assert.ok(
    perf.get('finalist').score > perf.get('rajiv').score,
    `finalist must beat 1-game stellar: finalist=${perf.get('finalist').score.toFixed(2)}, rajiv=${perf.get('rajiv').score.toFixed(2)}`
  );
});

test('playerPerformance: 5-game run with one bad game still beats a 4-game perfect run', () => {
  // Pin the "don't punish for a few bad games" invariant: even though the
  // bad game IS counted in the average, volume + shrinkage keep the 5-game
  // player ahead.
  const good = { kills: 12, deaths: 3, assists: 3, firstBloods: 1, plants: 1 };
  // "Bad" here means a realistic below-average game (impact ≈ 2), not a
  // total throw. The invariant is that a normal off-day shouldn't sink you.
  const bad  = { kills: 6, deaths: 8, assists: 2, firstBloods: 0, plants: 0 };
  const lines = [
    // p1: 5 games, 4 good + 1 bad
    ...[1, 2, 3, 4].map(() => ({ player: 'p1', stats: good })),
    { player: 'p1', stats: bad },
    // p2: 4 games, all good
    ...[1, 2, 3, 4].map(() => ({ player: 'p2', stats: good })),
    // Filler for a realistic global mean
    ...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].flatMap((id) =>
      [1, 2].map(() => ({ player: id, stats: { kills: 8, deaths: 6, assists: 3, firstBloods: 1, plants: 1 } }))
    ),
  ];
  const perf = playerPerformance(lines, 'valorant_mvp');
  assert.ok(
    perf.get('p1').score > perf.get('p2').score,
    `p1 (5 games, 1 bad) should beat p2 (4 perfect): p1=${perf.get('p1').score.toFixed(2)}, p2=${perf.get('p2').score.toFixed(2)}`
  );
});

test('valorant_mvp per-game formula: KDA + 0.5*FB + 0.3*plants', () => {
  const lines = [{ player: 'p1', stats: { kills: 6, deaths: 3, assists: 3, firstBloods: 2, plants: 1 } }];
  const perf = playerPerformance(lines, 'valorant_mvp');
  // (6+3)/3 + 0.5*2 + 0.3*1 = 3 + 1 + 0.3 = 4.3
  assert.equal(perf.get('p1').rawAvg, 4.3);
});

/* ------------------------------ stat totals ----------------------------- */

test('statTotals sums a single stat across games', () => {
  const lines = [
    { player: 'p1', stats: { kills: 10, deaths: 2 } },
    { player: 'p1', stats: { kills: 6, deaths: 4 } },
    { player: 'p2', stats: { kills: 8, deaths: 3 } },
  ];
  const kills = statTotals(lines, 'kills');
  assert.equal(kills.find((r) => r.playerId === 'p1').total, 16);
  assert.equal(kills.find((r) => r.playerId === 'p2').total, 8);
});

/* ----------------------------- percentiles ------------------------------ */

test('percentileRanks handles a single item and ties', () => {
  const one = percentileRanks([{ id: 'a', v: 9 }], (x) => x.id, (x) => x.v);
  assert.equal(one.get('a'), 50);
  const tie = percentileRanks([{ id: 'a', v: 2 }, { id: 'b', v: 2 }], (x) => x.id, (x) => x.v);
  assert.equal(tie.get('a'), 50);
  assert.equal(tie.get('b'), 50);
});

/* ------------------------------- prices --------------------------------- */

test('playerPrices: sold->soldPrice, core->coreCost, unsold->null', () => {
  const rankTable = [{ rank: 'Immortal', coreCost: 42 }, { rank: 'Diamond', coreCost: 16 }];
  const prices = playerPrices(
    [
      { _id: 'sold', isCore: false, status: 'sold', soldPrice: 40, rank: 'Diamond' },
      { _id: 'core', isCore: true, rank: 'Immortal' },
      { _id: 'unsold', isCore: false, status: 'unsold', rank: 'Diamond' },
    ],
    rankTable
  );
  assert.equal(prices.get('sold'), 40);
  assert.equal(prices.get('core'), 42);
  assert.equal(prices.get('unsold'), null);
});

/* ----------------------------- leaderboard ------------------------------ */

test('leaderboard ranks by wins then point differential', () => {
  const teams = [{ _id: 'A', name: 'Alpha' }, { _id: 'B', name: 'Bravo' }, { _id: 'C', name: 'Cee' }];
  const matches = [
    { teamA: 'A', teamB: 'B', status: 'complete', winner: 'A', scoreA: 13, scoreB: 7 },
    { teamA: 'A', teamB: 'C', status: 'complete', winner: 'A', scoreA: 13, scoreB: 11 },
    { teamA: 'B', teamB: 'C', status: 'upcoming' },
  ];
  const lb = leaderboard(teams, matches);
  assert.equal(lb[0].teamId, 'A');
  assert.equal(lb[0].wins, 2);
  assert.equal(lb[0].diff, 8);
});

/* --------------------------- full analytics ----------------------------- */

const fixture = {
  rankTable: [
    { rank: 'Immortal', coreCost: 42, floorPrice: 38 },
    { rank: 'Diamond', coreCost: 16, floorPrice: 23 },
    { rank: 'Silver', coreCost: 4, floorPrice: 6 },
  ],
  teams: [{ _id: 'T1', name: 'Team One' }, { _id: 'T2', name: 'Team Two' }],
  players: [
    { _id: 'p1', name: 'Star', rank: 'Diamond', isCore: false, status: 'sold', soldPrice: 40, currentTeam: 'T1' },
    { _id: 'p2', name: 'Bargain', rank: 'Silver', isCore: false, status: 'sold', soldPrice: 5, currentTeam: 'T2' },
    { _id: 'p3', name: 'Overpaid', rank: 'Immortal', isCore: true, currentTeam: 'T1' },
    { _id: 'p4', name: 'Unsold', rank: 'Diamond', isCore: false, status: 'unsold' },
  ],
  statLines: [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 4 } },
    { player: 'p2', stats: { kills: 5, deaths: 5, assists: 5 } },
    { player: 'p3', stats: { kills: 3, deaths: 10, assists: 2 } },
    { player: 'p4', stats: { kills: 8, deaths: 4, assists: 0 } },
  ],
  matches: [{ teamA: 'T1', teamB: 'T2', status: 'complete', winner: 'T1', scoreA: 13, scoreB: 9 }],
  formulaKey: 'avg_kda',
};

test('computeAnalytics: MVP ordered by score, top is the star', () => {
  const a = computeAnalytics(fixture);
  assert.equal(a.mvp[0].playerId, 'p1');
  assert.equal(a.mvp[a.mvp.length - 1].playerId, 'p3');
  assert.equal(a.mvp.length, 4);
});

test('computeAnalytics: cheap overperformers land on the Watchlist', () => {
  const a = computeAnalytics(fixture);
  const ids = a.watchlist.map((r) => r.playerId);
  assert.ok(ids.includes('p2'));
});

test('computeAnalytics: expensive underperformer lands on the Washed list', () => {
  const a = computeAnalytics(fixture);
  const ids = a.washed.map((r) => r.playerId);
  assert.ok(ids.includes('p3'));
});

test('computeAnalytics: unpriced players are excluded from value analysis', () => {
  const a = computeAnalytics(fixture);
  assert.ok(!a.valueIndex.some((r) => r.playerId === 'p4'));
  assert.ok(a.mvp.some((r) => r.playerId === 'p4'));
});

test('computeAnalytics: leaderboard reflects the completed match', () => {
  const a = computeAnalytics(fixture);
  assert.equal(a.leaderboard[0].teamId, 'T1');
  assert.equal(a.leaderboard[0].wins, 1);
});

test('computeAnalytics: stat-leaderboard tables present and sorted desc', () => {
  const f = {
    ...fixture,
    statLines: [
      { player: 'p1', stats: { kills: 20, deaths: 5, assists: 5, firstBloods: 4, plants: 2 } },
      { player: 'p2', stats: { kills: 8, deaths: 12, assists: 3, firstBloods: 0, plants: 5 } },
      { player: 'p3', stats: { kills: 3, deaths: 14, assists: 1, firstBloods: 1, plants: 0 } },
    ],
  };
  const a = computeAnalytics(f);
  assert.equal(a.topKills[0].playerId, 'p1');
  assert.equal(a.topKills[0].total, 20);
  assert.equal(a.topDeaths[0].playerId, 'p3');
  assert.equal(a.topFirstBloods[0].playerId, 'p1');
  assert.equal(a.topPlants[0].playerId, 'p2');
});
