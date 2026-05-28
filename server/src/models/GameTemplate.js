import mongoose from 'mongoose';

/**
 * A GameTemplate makes the platform game-agnostic. It defines which stat
 * fields a game tracks and how performance is scored. A Valorant template
 * tracks kills/deaths/assists/first bloods/plants; an Apex template would
 * track placement and damage instead - with zero code changes.
 */
const statFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },        // e.g. "kills" - used in code/data
    label: { type: String, required: true },      // e.g. "Kills" - shown in UI
    higherIsBetter: { type: Boolean, default: true },
  },
  { _id: false }
);

const gameTemplateSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, unique: true }, // "Valorant", "CS2", ...
    statFields: { type: [statFieldSchema], default: [] },

    // Performance score formula expressed as a simple named strategy the
    // analytics module knows how to evaluate. "avg_kda" => (K + A) / max(D,1).
    performanceFormula: { type: String, default: 'avg_kda' },
  },
  { timestamps: true }
);

export default mongoose.model('GameTemplate', gameTemplateSchema);
