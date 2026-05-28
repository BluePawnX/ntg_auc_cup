import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseCsv } from './parseCsv.js';
import { buildSeedData, slugify } from './buildSeedData.js';
import seedConfig from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
const sampleRows = parseCsv(readFileSync(join(here, 'players.sample.csv'), 'utf8'));

/* ------------------------------ parseCsv -------------------------------- */

test('parseCsv keeps commas inside quoted fields', () => {
  const rows = parseCsv('name,gameStyle\nNova,"Aggressive, fast, deadly"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].gameStyle, 'Aggressive, fast, deadly');
});

test('parseCsv handles escaped quotes and trailing no-newline', () => {
  const rows = parseCsv('a,b\n"say ""hi""",x');
  assert.equal(rows[0].a, 'say "hi"');
  assert.equal(rows[0].b, 'x');
});

test('the sample CSV has 50 player rows', () => {
  assert.equal(sampleRows.length, 50);
});

/* ---------------------------- buildSeedData ----------------------------- */

test('builds the expected shape from the sample CSV', () => {
  const data = buildSeedData(seedConfig, sampleRows);
  assert.equal(data.teams.length, 10, '10 teams');
  assert.equal(data.summary.cores, 20, '20 cores');
  assert.equal(data.summary.poolPlayers, 30, '30 pool players');
  assert.equal(data.summary.totalPlayers, 50);
  // admin + auctioneer + 1 captain per team
  assert.equal(data.accounts.length, 12);
});

test('every team budget = startingBudget - coreDeduction and is affordable', () => {
  const data = buildSeedData(seedConfig, sampleRows);
  const rankMap = new Map(seedConfig.rankTable.map((r) => [r.rank, r]));
  const minFloor = Math.min(...seedConfig.rankTable.map((r) => r.floorPrice));
  for (const t of data.teams) {
    const expected = seedConfig.tournament.settings.startingBudget - t.coreDeduction;
    assert.equal(t.currentBudget, expected, `${t.name} budget`);
    assert.equal(
      t.coreDeduction,
      rankMap.get(t.core1.rank).coreCost + rankMap.get(t.core2.rank).coreCost,
      `${t.name} core deduction`
    );
    assert.ok(
      t.currentBudget >= seedConfig.tournament.settings.rosterSize * minFloor,
      `${t.name} can afford its roster`
    );
    assert.equal(t.roster.length, 0, 'rosters start empty');
  }
});

test('every pool player gets the floor price for their rank; cores are excluded from the pool', () => {
  const data = buildSeedData(seedConfig, sampleRows);
  const rankMap = new Map(seedConfig.rankTable.map((r) => [r.rank, r]));
  for (const p of data.players) {
    assert.equal(p.floorPrice, rankMap.get(p.rank).floorPrice, `${p.name} floor`);
    if (p.isCore) assert.ok(p.teamName, `${p.name} core has a team`);
  }
});

test('each captain account is linked to its team and captain core', () => {
  const data = buildSeedData(seedConfig, sampleRows);
  const captains = data.accounts.filter((a) => a.role === 'captain');
  assert.equal(captains.length, 10);
  for (const acc of captains) {
    const team = data.teams.find((t) => t.key === acc.teamKey);
    assert.ok(team, `team exists for ${acc.username}`);
    assert.equal(acc.username, slugify(team.name));
    assert.equal(acc.playerKey, team.core1.playerKey, 'captain account points at captain core');
  }
});

/* ----------------------------- validation ------------------------------- */

function rowsClone() {
  return sampleRows.map((r) => ({ ...r }));
}

test('rejects an unknown rank', () => {
  const rows = rowsClone();
  rows[20].rank = 'Mythic';
  assert.throws(() => buildSeedData(seedConfig, rows), /unknown rank/i);
});

test('rejects a team without exactly 2 cores', () => {
  const rows = rowsClone();
  rows[1].isCore = 'false'; // drop Nightfall's co-captain core
  rows[1].team = '';
  assert.throws(() => buildSeedData(seedConfig, rows), /exactly 2 cores/i);
});

test('rejects a team with no captain', () => {
  const rows = rowsClone();
  rows[0].isCaptain = 'false'; // Nightfall now has 0 captains
  assert.throws(() => buildSeedData(seedConfig, rows), /exactly 1 captain/i);
});

test('rejects a team count mismatch against config.teamCount', () => {
  // Remove one whole team (Mirage: its two core rows are indices 18 and 19).
  const rows = rowsClone().filter((r) => r.team !== 'Mirage' && r.inGameName.indexOf('MR') === -1);
  assert.throws(() => buildSeedData(seedConfig, rows), /Expected 10 teams/i);
});
