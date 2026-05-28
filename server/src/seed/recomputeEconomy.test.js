import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recomputeEconomy, economyLocked } from './recomputeEconomy.js';

const rankTable = [
  { rank: 'Immortal', coreCost: 42, floorPrice: 38 },
  { rank: 'Diamond', coreCost: 16, floorPrice: 23 },
  { rank: 'Gold', coreCost: 7, floorPrice: 10 },
];

test('recompute derives team budgets from core ranks', () => {
  const teams = [{ _id: 'T', name: 'T', core1: { rank: 'Diamond' }, core2: { rank: 'Immortal' } }];
  const { teamUpdates } = recomputeEconomy({ startingBudget: 150, rankTable, teams, players: [] });
  assert.equal(teamUpdates[0].coreDeduction, 58); // 16 + 42
  assert.equal(teamUpdates[0].currentBudget, 92); // 150 - 58
  assert.equal(teamUpdates[0].core1RankCost, 16);
});

test('recompute sets pool floors and skips cores', () => {
  const players = [
    { _id: 'p1', name: 'Pool', rank: 'Gold', isCore: false },
    { _id: 'c1', name: 'Core', rank: 'Immortal', isCore: true },
  ];
  const { playerUpdates } = recomputeEconomy({ startingBudget: 150, rankTable, teams: [], players });
  assert.equal(playerUpdates.length, 1);
  assert.equal(playerUpdates[0].id, 'p1');
  assert.equal(playerUpdates[0].floorPrice, 10);
});

test('recompute throws on a rank missing from the table', () => {
  const teams = [{ _id: 'T', name: 'T', core1: { rank: 'Radiant' }, core2: { rank: 'Diamond' } }];
  assert.throws(() => recomputeEconomy({ startingBudget: 150, rankTable, teams, players: [] }), /missing from the rank table/i);
});

test('economyLocked detects sales and non-empty rosters', () => {
  assert.equal(economyLocked([{ status: 'pool' }], [{ roster: [] }]), false);
  assert.equal(economyLocked([{ status: 'sold' }], [{ roster: [] }]), true);
  assert.equal(economyLocked([{ status: 'pool' }], [{ roster: ['x'] }]), true);
});
