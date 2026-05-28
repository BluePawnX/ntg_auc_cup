import mongoose from 'mongoose';

/**
 * A Tournament ("Cup") is the top-level container. Every player, team, match,
 * bid and stat line belongs to exactly one tournament. Creating a new Cup and
 * importing players lets the whole platform be reused for any future event.
 */
const rankValueSchema = new mongoose.Schema(
  {
    rank: { type: String, required: true },   // e.g. "Diamond"
    coreCost: { type: Number, required: true }, // credits deducted if a core is this rank
    floorPrice: { type: Number, required: true }, // auction starting price for this rank
  },
  { _id: false }
);

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    game: { type: String, required: true, default: 'Valorant' },

    status: {
      type: String,
      enum: ['setup', 'auction', 'matches', 'complete'],
      default: 'setup',
    },

    // Auction / roster settings - configurable per Cup so the economy can
    // differ between tournaments without touching code.
    settings: {
      startingBudget: { type: Number, default: 150 },
      rosterSize: { type: Number, default: 3 },   // auction picks per team (excl. cores)
      teamCount: { type: Number, default: 10 },
      timerSeconds: { type: Number, default: 15 }, // countdown per player
      minBidIncrement: { type: Number, default: 1 },
    },

    // Per-rank cost + floor table. Filled once registration closes and the
    // floor-price calculation has been run on the real player pool.
    rankTable: { type: [rankValueSchema], default: [] },

    // Dates shown in the public hub.
    startDate: { type: Date },
    finalsDate: { type: Date },

    // Self-registration controls (Module: registration). When open, players can
    // create their own accounts/profiles. Once the roster is locked, players can
    // no longer edit their profiles (the auction is imminent).
    registrationOpen: { type: Boolean, default: false },
    rosterLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Tournament', tournamentSchema);
