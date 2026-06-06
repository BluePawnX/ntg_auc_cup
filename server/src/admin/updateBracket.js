/**
 * One-off cloud-DB update for AUC Cup 2:
 *   1. Renames the tournament to "AUC Cup 2 (NTG x Aorus Cafe League)".
 *   2. Wipes existing matches for that tournament.
 *   3. Inserts the 9 bracket matches (2 play-in, 4 QF, 2 SF, 1 Final).
 *
 * Idempotent: re-running produces the same 9 matches and the same name.
 *
 * Usage:
 *   MONGO_URI=... node src/admin/updateBracket.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import { Match } from '../models/matchModels.js';

const NEW_NAME = 'AUC Cup 2 (NTG x Aorus Cafe League)';
const OLD_NAME = 'NTG Auction Cup 2';

// Seeds → team names exactly as stored in the DB.
const SEED_TO_NAME = {
  1: 'Zenith',
  2: 'Bajil Squad',
  3: 'BOMMBACLAT',
  4: 'Sher-E-Urdu',
  5: 'Chutki',
  6: 'Team Lodus',
  7: 'kulshekar Kings',
  8: '0 ping',
  9: 'KADRI KNIGHTS',
  10: 'INDIAN OIL ESPORTS',
};

// Bracket: { round, A: seed or null, B: seed or null }
// null = "winner of a prior match", filled in as the bracket progresses.
const BRACKET = [
  { round: 'Round 1',   A: 8,    B: 9 },     // M1: 0 ping vs KADRI KNIGHTS
  { round: 'Round 1',   A: 7,    B: 10 },    // M2: kulshekar Kings vs INDIAN OIL ESPORTS
  { round: 'Round 2',   A: 4,    B: 5 },     // M3: Sher-E-Urdu vs Chutki
  { round: 'Round 2',   A: 3,    B: 6 },     // M4: BOMMBACLAT vs Team Lodus
  { round: 'Round 2',   A: 1,    B: null },  // M5: Zenith vs winner(M1)
  { round: 'Round 2',   A: 2,    B: null },  // M6: Bajil Squad vs winner(M2)
  { round: 'Semi-final', A: null, B: null }, // M7: winner(M5) vs winner(M3)
  { round: 'Semi-final', A: null, B: null }, // M8: winner(M6) vs winner(M4)
  { round: 'Final',     A: null, B: null },  // M9: winner(M7) vs winner(M8)
];

async function main() {
  await connectDB();
  console.log('[bracket] connected to MongoDB');

  // 1. Find the tournament — try new name first, fall back to old name.
  let tournament =
    (await Tournament.findOne({ name: NEW_NAME })) ||
    (await Tournament.findOne({ name: OLD_NAME }));

  if (!tournament) {
    throw new Error(
      `Could not find tournament by either "${NEW_NAME}" or "${OLD_NAME}". ` +
      `Has the cloud DB been seeded? Run npm run seed first.`
    );
  }
  console.log(`[bracket] found tournament ${tournament._id} ("${tournament.name}")`);

  // 2. Rename if needed + set status to 'matches'.
  let needsSave = false;
  if (tournament.name !== NEW_NAME) {
    console.log(`[bracket] renaming "${tournament.name}" → "${NEW_NAME}"`);
    tournament.name = NEW_NAME;
    needsSave = true;
  }
  if (tournament.status !== 'matches' && tournament.status !== 'complete') {
    console.log(`[bracket] status "${tournament.status}" → "matches"`);
    tournament.status = 'matches';
    needsSave = true;
  }
  if (needsSave) await tournament.save();

  // 3. Resolve all 10 team IDs by name.
  const teams = await Team.find({ tournament: tournament._id }).lean();
  const byName = new Map(teams.map((t) => [t.name, t._id]));
  console.log(`[bracket] resolved ${teams.length} teams`);

  const missing = Object.values(SEED_TO_NAME).filter((n) => !byName.has(n));
  if (missing.length) {
    throw new Error(`Teams missing from DB: ${missing.join(', ')}`);
  }

  // 4. Wipe existing matches for this tournament.
  const wiped = await Match.deleteMany({ tournament: tournament._id });
  console.log(`[bracket] wiped ${wiped.deletedCount} existing matches`);

  // 5. Insert the 9 bracket matches.
  // scheduledTime is a sort key here, NOT a real wall-clock — staggered 1h
  // apart starting today 18:00 IST so the public hub orders them by bracket
  // sequence. Update later via the admin UI once real slot times are set.
  const baseStart = new Date(); // today at run time
  baseStart.setUTCHours(12, 30, 0, 0); // 18:00 IST = 12:30 UTC
  const docs = BRACKET.map((m, idx) => ({
    tournament: tournament._id,
    round: m.round,
    teamA: m.A ? byName.get(SEED_TO_NAME[m.A]) : null,
    teamB: m.B ? byName.get(SEED_TO_NAME[m.B]) : null,
    status: 'upcoming',
    scheduledTime: new Date(baseStart.getTime() + idx * 60 * 60 * 1000),
  }));

  await Match.insertMany(docs);
  console.log(`[bracket] inserted ${docs.length} matches:`);
  BRACKET.forEach((m, i) => {
    const a = m.A ? SEED_TO_NAME[m.A] : 'TBD';
    const b = m.B ? SEED_TO_NAME[m.B] : 'TBD';
    console.log(`  M${i + 1}  ${m.round.padEnd(11)}  ${a}  vs  ${b}`);
  });

  await mongoose.disconnect();
  console.log('\n[bracket] done. Cloud DB now reflects the new name and bracket.');
}

main().catch((err) => {
  console.error('[bracket] FATAL:', err);
  process.exit(1);
});
