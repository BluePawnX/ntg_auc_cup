/**
 * One-off cloud-DB update: switch the active Valorant GameTemplate's
 * performance formula from 'avg_kda' to 'valorant_mvp' so the cloud
 * analytics use the new composite MVP scoring (KDA + 0.5·firstBloods +
 * 0.3·plants, trimmed-best aggregation, volume boost).
 *
 * Safe to re-run — idempotent.
 *
 *   MONGO_URI=... node src/admin/updateMvpFormula.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import GameTemplate from '../models/GameTemplate.js';

const TARGET_FORMULA = 'valorant_mvp';

async function main() {
  await connectDB();
  console.log('[mvp] connected to MongoDB');

  const tmpl = await GameTemplate.findOne({ game: 'Valorant' });
  if (!tmpl) throw new Error('Valorant GameTemplate not found in DB');

  console.log(`[mvp] current performanceFormula = "${tmpl.performanceFormula}"`);
  if (tmpl.performanceFormula === TARGET_FORMULA) {
    console.log('[mvp] already on target formula — nothing to do.');
  } else {
    tmpl.performanceFormula = TARGET_FORMULA;
    await tmpl.save();
    console.log(`[mvp] performanceFormula → "${TARGET_FORMULA}" ✓`);
  }

  await mongoose.disconnect();
  console.log('[mvp] done.');
}

main().catch((err) => {
  console.error('[mvp] FATAL:', err);
  process.exit(1);
});
