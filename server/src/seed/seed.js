import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';

import { connectDB } from '../config/db.js';
import Tournament from '../models/Tournament.js';
import GameTemplate from '../models/GameTemplate.js';
import Player from '../models/Player.js';
import Team from '../models/Team.js';
import AuctionState from '../models/AuctionState.js';
import Account from '../models/Account.js';

import { parseCsv } from './parseCsv.js';
import { buildSeedData } from './buildSeedData.js';
import seedConfig from './config.js';

/**
 * Seeds (or re-seeds) one tournament from a CSV. Idempotent: re-running wipes
 * the tournament with the same name and rebuilds it cleanly, so it's safe to
 * run before every rehearsal. The GameTemplate is shared across cups and is
 * upserted, never deleted.
 *
 *   npm run seed                       # uses config.csvFile
 *   npm run seed -- path/to/real.csv   # override the CSV
 *   npm run seed -- --dry              # build + print, no database writes
 *
 * The data-shaping logic lives in buildSeedData.js (pure, unit-tested). This
 * file only does the database I/O.
 */

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const csvArg = args.find((a) => !a.startsWith('--'));

function loadRows() {
  const csvPath = csvArg
    ? (isAbsolute(csvArg) ? csvArg : join(process.cwd(), csvArg))
    : join(here, seedConfig.csvFile);
  console.log(`[seed] reading players from ${csvPath}`);
  return parseCsv(readFileSync(csvPath, 'utf8'));
}

function printSummary(data) {
  const s = data.summary;
  console.log('\n──────────── seed summary ────────────');
  console.log(`Tournament : ${data.tournament.name} (${data.tournament.game})`);
  console.log(`Teams      : ${s.teams}`);
  console.log(`Cores      : ${s.cores}`);
  console.log(`Pool       : ${s.poolPlayers}`);
  console.log(`Players    : ${s.totalPlayers}`);
  console.log(`Spendable  : ${s.spendable} credits  |  Floor sum: ${s.floorSum} (${(100 * s.floorSum / s.spendable).toFixed(1)}%)`);
  console.log('\nLogin accounts (username / password / role):');
  for (const a of data.accounts) {
    console.log(`  ${a.username.padEnd(14)} ${String(a.password).padEnd(16)} ${a.role}`);
  }
  console.log('───────────────────────────────────────\n');
}

async function writeToDatabase(data) {
  // 1. Reset any existing tournament with this name (cascade its data).
  const existing = await Tournament.findOne({ name: data.tournament.name });
  if (existing) {
    console.log(`[seed] resetting existing tournament "${data.tournament.name}"`);
    await Promise.all([
      Player.deleteMany({ tournament: existing._id }),
      Team.deleteMany({ tournament: existing._id }),
      AuctionState.deleteMany({ tournament: existing._id }),
      Account.deleteMany({ tournament: existing._id }),
    ]);
    await Tournament.deleteOne({ _id: existing._id });
  }

  // 2. Game template (shared across cups, keyed by game name).
  await GameTemplate.findOneAndUpdate(
    { game: data.gameTemplate.game },
    data.gameTemplate,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 3. Tournament.
  const tournament = await Tournament.create(data.tournament);

  // 4. Players — insert and map temp keys -> real ObjectIds.
  const playerDocs = data.players.map((p) => ({
    tournament: tournament._id,
    name: p.name,
    inGameName: p.inGameName,
    phone: p.phone || undefined,
    rank: p.rank,
    role: p.role || undefined,
    gameStyle: p.gameStyle || undefined,
    photoUrl: p.photoUrl || undefined,
    floorPrice: p.floorPrice,
    status: p.status,
    isCore: p.isCore,
  }));
  const inserted = await Player.insertMany(playerDocs);
  const idByKey = new Map();
  data.players.forEach((p, i) => idByKey.set(p.key, inserted[i]._id));

  // 5. Teams — wire core player ObjectIds, then stamp cores with their team.
  for (const t of data.teams) {
    const team = await Team.create({
      tournament: tournament._id,
      name: t.name,
      core1: { ...t.core1, player: idByKey.get(t.core1.playerKey) },
      core2: { ...t.core2, player: idByKey.get(t.core2.playerKey) },
      startingBudget: t.startingBudget,
      coreDeduction: t.coreDeduction,
      currentBudget: t.currentBudget,
      roster: [],
    });
    await Player.updateMany(
      { _id: { $in: [idByKey.get(t.core1.playerKey), idByKey.get(t.core2.playerKey)] } },
      { coreOf: team._id, currentTeam: team._id }
    );
    t._id = team._id; // for account wiring
  }
  const teamIdByKey = new Map(data.teams.map((t) => [t.key, t._id]));

  // 6. Fresh idle auction state.
  await AuctionState.create({ tournament: tournament._id, status: 'idle', pass: 1 });

  // 7. Accounts (passwords hashed via the model).
  for (const a of data.accounts) {
    const account = new Account({
      username: a.username,
      displayName: a.displayName,
      role: a.role,
      tournament: tournament._id,
      team: a.teamKey ? teamIdByKey.get(a.teamKey) : null,
      player: a.playerKey ? idByKey.get(a.playerKey) : null,
    });
    await account.setPassword(a.password);
    await account.save();
  }

  console.log(`[seed] wrote tournament ${tournament._id}`);
  return tournament;
}

async function main() {
  const rows = loadRows();
  const data = buildSeedData(seedConfig, rows);
  printSummary(data);

  if (dryRun) {
    console.log('[seed] --dry: no database writes performed.');
    return;
  }

  await connectDB();
  await writeToDatabase(data);
  await mongoose.connection.close();
  console.log('[seed] done. You can now start the server and log in.');
}

main().catch((err) => {
  console.error('[seed] failed:', err.message);
  process.exitCode = 1;
});
