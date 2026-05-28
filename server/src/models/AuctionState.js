import mongoose from 'mongoose';

/**
 * One AuctionState document per tournament - the single live source of truth
 * for the auction. Persisting it means that if the host laptop restarts
 * mid-auction, the engine can resume from exactly where it left off.
 */
const bidSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    teamName: { type: String },
    amount: { type: Number },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    playerName: { type: String },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    teamName: { type: String },
    price: { type: Number },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const auctionStateSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, unique: true },

    status: {
      type: String,
      enum: ['idle', 'showcase', 'live', 'paused', 'sold'],
      default: 'idle',
    },

    pass: { type: Number, default: 1 }, // 1 = main pass, 2 = unsold re-auction

    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    currentPrice: { type: Number, default: 0 },
    highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    highestBidderName: { type: String, default: null },

    // Absolute timestamp the countdown ends. All clients render from this one
    // value so every screen shows the same number. The server, not any
    // client, decides when it has elapsed.
    timerEndsAt: { type: Date, default: null },

    // When paused, how many ms were left - so resume restores the countdown.
    pausedRemainingMs: { type: Number, default: null },

    bidHistory: { type: [bidSchema], default: [] }, // bids on the current player
    saleLog: { type: [saleSchema], default: [] },    // every completed sale, in order
  },
  { timestamps: true }
);

export default mongoose.model('AuctionState', auctionStateSchema);
