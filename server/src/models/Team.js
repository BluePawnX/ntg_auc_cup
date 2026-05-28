import mongoose from 'mongoose';

/**
 * A Team belongs to one tournament. It starts with two cores (captain +
 * co-captain), whose rank costs are deducted from the starting budget. The
 * remaining credits are spent in the auction to fill `rosterSize` slots.
 */
const coreSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    name: { type: String, required: true },
    inGameName: { type: String },
    rank: { type: String, required: true },
    rankCost: { type: Number, required: true }, // credits this core costs
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },

    name: { type: String, required: true },

    core1: { type: coreSchema, required: true }, // captain
    core2: { type: coreSchema, required: true }, // co-captain

    startingBudget: { type: Number, required: true }, // before core deduction
    coreDeduction: { type: Number, required: true },   // core1.rankCost + core2.rankCost

    // currentBudget = startingBudget - coreDeduction - sum(roster soldPrices).
    // Maintained by the auction engine as players are won / sales undone.
    currentBudget: { type: Number, required: true },

    // The auction picks. Length grows as players are won, up to rosterSize.
    roster: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  },
  { timestamps: true }
);

// Convenience: how many auction slots are still open.
teamSchema.methods.slotsOpen = function (rosterSize) {
  return rosterSize - this.roster.length;
};

export default mongoose.model('Team', teamSchema);
