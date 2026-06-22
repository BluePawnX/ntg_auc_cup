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

test('playerPerformance: rawAvg and trimmed are exposed for transparency', () => {
  const lines = [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 4 } }, // 7
    { player: 'p1', stats: { kills: 4, deaths: 4, assists: 4 } },  // 2
  ];
  const perf = playerPerformance(lines, 'avg_kda');
  assert.equal(perf.get('p1').games, 2);
  assert.equal(perf.get('p1').rawAvg, 4.5);
  assert.equal(perf.get('p1').trimmed, 4.5); // 2 games, drop 0
});

test('playerPerformance guards against divide-by-zero deaths', () => {
  const perf = playerPerformance([{ player: 'x', stats: { kills: 5, deaths: 0, assists: 1 } }], 'avg_kda');
  assert.equal(perf.get('x').rawAvg, 6);
});

test('playerPerformance: bad game in a 4-game body of work is dropped by the trim', () => {
  const lines = [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 0 } }, // 5
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 0 } }, // 5
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 0 } }, // 5
    { player: 'p1', stats: { kills: 1,  deaths: 10, assists: 0 } }, // 0.1
  ];
  const perf = playerPerformance(lines, 'avg_kda');
  // games=4 -> drop floor(4*0.25)=1 -> trimmed = mean(5,5,5) = 5
  assert.equal(perf.get('p1').trimmed, 5);
  assert.ok(perf.get('p1').rawAvg < perf.get('p1').trimmed);
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
  assert.ok(perf.get('p2').score > perf.get('p1').score);
});

test('playerPerformance: 1-game stellar does NOT beat 4-game above-avg body of work', () => {
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

test('valorant_mvp per-game formula: KDA + 0.5*FB + 0.3*plants', () => {
  const lines = [{ player: 'p1', stats: { kills: 6, deaths: 3, assists: 3, firstBloods: 2, plants: 1 } }];
  const perf = playerPerformance(lines, 'valorant_mvp');
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
    // Filler non-core sold players so percentile spread is meaningful.
    { _id: 'p5', name: 'Mid-Pricey', rank: 'Diamond', isCore: false, status: 'sold', soldPrice: 25, currentTeam: 'T1' },
    { _id: 'p6', name: 'Mid-Cheap', rank: 'Silver', isCore: false, status: 'sold', soldPrice: 12, currentTeam: 'T2' },
  ],
  statLines: [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 4 } },
    { player: 'p2', stats: { kills: 5, deaths: 5, assists: 5 } },
    { player: 'p3', stats: { kills: 3, deaths: 10, assists: 2 } },
    { player: 'p4', stats: { kills: 8, deaths: 4, assists: 0 } },
    { player: 'p5', stats: { kills: 6, deaths: 5, assists: 2 } }, // (6+2)/5 = 1.6
    { player: 'p6', stats: { kills: 7, deaths: 4, assists: 3 } }, // (7+3)/4 = 2.5
  ],
  matches: [{ teamA: 'T1', teamB: 'T2', status: 'complete', winner: 'T1', scoreA: 13, scoreB: 9 }],
  formulaKey: 'avg_kda',
};

test('computeAnalytics: MVP ordered by score, top is the star', () => {
  const a = computeAnalytics(fixture);
  assert.equal(a.mvp[0].playerId, 'p1');
  assert.equal(a.mvp[a.mvp.length - 1].playerId, 'p3'); // overpaid core still worst
  assert.equal(a.mvp.length, 6); // p1..p6 all played
});

test('computeAnalytics: cheap overperformers land on the Watchlist', () => {
  const a = computeAnalytics(fixture);
  const ids = a.watchlist.map((r) => r.playerId);
  assert.ok(ids.includes('p2'));
});

test('computeAnalytics: cores are EXCLUDED from Watchlist (predetermined price)', () => {
  // A core with a great score should not show up on the watchlist no matter
  // how cheap their rank-implied cost is.
  const f = {
    ...fixture,
    players: [
      { _id: 'cheapCore', name: 'Cheap Core', rank: 'Silver', isCore: true, currentTeam: 'T1' },
      { _id: 'p2', name: 'Bargain', rank: 'Silver', isCore: false, status: 'sold', soldPrice: 5, currentTeam: 'T2' },
      { _id: 'p3', name: 'Expensive', rank: 'Diamond', isCore: false, status: 'sold', soldPrice: 40, currentTeam: 'T2' },
    ],
    statLines: [
      { player: 'cheapCore', stats: { kills: 30, deaths: 1, assists: 10 } }, // godlike
      { player: 'p2', stats: { kills: 8, deaths: 4, assists: 2 } },
      { player: 'p3', stats: { kills: 5, deaths: 6, assists: 2 } },
    ],
  };
  const a = computeAnalytics(f);
  const watchIds = a.watchlist.map((r) => r.playerId);
  assert.ok(!watchIds.includes('cheapCore'), 'cores must not appear on the watchlist');
  // And the cheapCore is also excluded from the valueIndex computation.
  const valueIds = a.valueIndex.map((r) => r.playerId);
  assert.ok(!valueIds.includes('cheapCore'), 'cores must not be in valueIndex');
});

test('computeAnalytics: cores are EXCLUDED from Washed list too', () => {
  // An overpriced core with poor stats should not pollute the washed list.
  const f = {
    ...fixture,
    players: [
      { _id: 'overCore', name: 'Overpriced Core', rank: 'Immortal', isCore: true, currentTeam: 'T1' },
      { _id: 'p2', name: 'OK', rank: 'Silver', isCore: false, status: 'sold', soldPrice: 5, currentTeam: 'T2' },
      { _id: 'p3', name: 'Bad Buy', rank: 'Diamond', isCore: false, status: 'sold', soldPrice: 50, currentTeam: 'T2' },
    ],
    statLines: [
      { player: 'overCore', stats: { kills: 1, deaths: 20, assists: 0 } }, // awful
      { player: 'p2', stats: { kills: 8, deaths: 4, assists: 2 } },
      { player: 'p3', stats: { kills: 2, deaths: 10, assists: 1 } },
    ],
  };
  const a = computeAnalytics(f);
  const washedIds = a.washed.map((r) => r.playerId);
  assert.ok(!washedIds.includes('overCore'), 'cores must not appear on the washed list');
});

test('computeAnalytics: cores still appear in MVP race and stat boards', () => {
  // Filter only affects value lists, not other surfaces.
  const f = {
    ...fixture,
    players: [
      { _id: 'core1', name: 'Captain Star', rank: 'Immortal', isCore: true, currentTeam: 'T1' },
      { _id: 'p2', name: 'Pool', rank: 'Silver', isCore: false, status: 'sold', soldPrice: 5, currentTeam: 'T2' },
    ],
    statLines: [
      { player: 'core1', stats: { kills: 30, deaths: 2, assists: 5, firstBloods: 4, plants: 2 } },
      { player: 'p2', stats: { kills: 5, deaths: 8, assists: 1, firstBloods: 0, plants: 0 } },
    ],
  };
  const a = computeAnalytics(f);
  assert.ok(a.mvp.some((r) => r.playerId === 'core1'), 'cores belong in MVP race');
  assert.ok(a.topKills.some((r) => r.playerId === 'core1'), 'cores belong on stat boards');
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
