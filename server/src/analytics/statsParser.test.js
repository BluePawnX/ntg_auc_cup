import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScoreboard } from './statsParser.js';

const players = [
  { _id: 'p1', name: 'Nova', inGameName: 'nakulfn' },
  { _id: 'p2', name: 'Riser', inGameName: 'Riser#3201' },
  { _id: 'p3', name: 'Specter', inGameName: 'Blackdeath #1210' },
];

test('parses CSV lines and matches by name', () => {
  const { lines, unmatched } = parseScoreboard('Nova, 20, 10, 5, 3, 1', players);
  assert.equal(unmatched.length, 0);
  assert.deepEqual(lines[0], { player: 'p1', stats: { kills: 20, deaths: 10, assists: 5, firstBloods: 3, plants: 1 } });
});

test('parses whitespace lines with multi-word names', () => {
  const { lines } = parseScoreboard('Riser   18 12 4 2 0', players);
  assert.equal(lines[0].player, 'p2');
  assert.equal(lines[0].stats.kills, 18);
  assert.equal(lines[0].stats.plants, 0);
});

test('matches by in-game name, ignoring the #tag', () => {
  const { lines } = parseScoreboard('Riser#3201 5 5 5', players); // matched via name "Riser"
  assert.equal(lines[0].player, 'p2');
  assert.equal(lines[0].stats.assists, 5);
});

test('collects unmatched names instead of guessing', () => {
  const { lines, unmatched } = parseScoreboard('SomeRando 9 9 9', players);
  assert.equal(lines.length, 0);
  assert.deepEqual(unmatched, ['SomeRando']);
});

test('partial stat rows fill only what is present', () => {
  const { lines } = parseScoreboard('Nova, 12, 4', players);
  assert.deepEqual(lines[0].stats, { kills: 12, deaths: 4 });
});

test('ignores blank lines', () => {
  const { lines } = parseScoreboard('\n\nNova 1 2 3\n\n', players);
  assert.equal(lines.length, 1);
});
