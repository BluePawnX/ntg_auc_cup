import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  playerPerformance,
  percentileRanks,
  playerPrices,
  leaderboard,
  computeAnalytics,
} from './analytics.js';

/* --------------------------- performance score -------------------------- */

test('playerPerformance averages KDA across a player\'s games', () => {
  const lines = [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 4 } }, // (10+4)/2 = 7
    { player: 'p1', stats: { kills: 4, deaths: 4, assists: 4 } },  // (4+4)/4 = 2
  ];
  const perf = playerPerformance(lines, 'avg_kda');
  assert.equal(perf.get('p1').games, 2);
  assert.equal(perf.get('p1').score, 4.5); // mean of 7 and 2
});

test('playerPerformance guards against divide-by-zero deaths', () => {
  const perf = playerPerformance([{ player: 'x', stats: { kills: 5, deaths: 0, assists: 1 } }], 'avg_kda');
  assert.equal(perf.get('x').score, 6); // (5+1)/max(0,1)
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
    { teamA: 'B', teamB: 'C', status: 'upcoming' }, // ignored (not complete)
  ];
  const lb = leaderboard(teams, matches);
  assert.equal(lb[0].teamId, 'A');
  assert.equal(lb[0].wins, 2);
  assert.equal(lb[0].diff, 8); // (13-7)+(13-11)
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
    { _id: 'p1', name: 'Star', rank: 'Diamond', isCore: false, status: 'sold', soldPrice: 40, currentTeam: 'T1' }, // pricey but great
    { _id: 'p2', name: 'Bargain', rank: 'Silver', isCore: false, status: 'sold', soldPrice: 5, currentTeam: 'T2' }, // cheap, decent
    { _id: 'p3', name: 'Overpaid', rank: 'Immortal', isCore: true, currentTeam: 'T1' }, // expensive core, poor
    { _id: 'p4', name: 'Unsold', rank: 'Diamond', isCore: false, status: 'unsold' }, // no price
  ],
  statLines: [
    { player: 'p1', stats: { kills: 10, deaths: 2, assists: 4 } }, // 7
    { player: 'p2', stats: { kills: 5, deaths: 5, assists: 5 } },  // 2
    { player: 'p3', stats: { kills: 3, deaths: 10, assists: 2 } }, // 0.5
    { player: 'p4', stats: { kills: 8, deaths: 4, assists: 0 } },  // 2
  ],
  matches: [{ teamA: 'T1', teamB: 'T2', status: 'complete', winner: 'T1', scoreA: 13, scoreB: 9 }],
  formulaKey: 'avg_kda',
};

test('computeAnalytics: MVP ordered by score, top is the star', () => {
  const a = computeAnalytics(fixture);
  assert.equal(a.mvp[0].playerId, 'p1');
  assert.equal(a.mvp[a.mvp.length - 1].playerId, 'p3'); // worst
  assert.equal(a.mvp.length, 4); // p1..p4 all played
});

test('computeAnalytics: cheap overperformers land on the Watchlist', () => {
  const a = computeAnalytics(fixture);
  const ids = a.watchlist.map((r) => r.playerId);
  assert.ok(ids.includes('p2'), 'cheap, decent player is great value');
});

test('computeAnalytics: expensive underperformer lands on the Washed list', () => {
  const a = computeAnalytics(fixture);
  const ids = a.washed.map((r) => r.playerId);
  assert.ok(ids.includes('p3'), 'expensive core, poor output');
});

test('computeAnalytics: unpriced players are excluded from value analysis', () => {
  const a = computeAnalytics(fixture);
  assert.ok(!a.valueIndex.some((r) => r.playerId === 'p4'));
  assert.ok(a.mvp.some((r) => r.playerId === 'p4')); // but still in the MVP race
});

test('computeAnalytics: leaderboard reflects the completed match', () => {
  const a = computeAnalytics(fixture);
  assert.equal(a.leaderboard[0].teamId, 'T1');
  assert.equal(a.leaderboard[0].wins, 1);
});
