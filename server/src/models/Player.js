import mongoose from 'mongoose';

/**
 * A Player belongs to one tournament. Players in the auction pool are bought
 * by teams; cores are attached directly to a team and not auctioned.
 *
 * Note: a player's match stats are NOT stored here - they live in
 * PlayerMatchStats, each line stamped with the team played for at the time.
 * That keeps personal stat history intact even when a player is poached.
 */
const playerSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },

    name: { type: String, required: true },
    inGameName: { type: String, required: true }, // Valorant username#tag
    phone: { type: String },
    rank: { type: String, required: true },
    role: { type: String },                       // Duelist / Initiator / ... / Flex
    gameStyle: { type: String },                   // their own writeup
    photoUrl: { type: String },                    // profile card image

    floorPrice: { type: Number, required: true },  // auction starting price

    // Auction lifecycle. 'pending' = self-registered, awaiting admin approval —
    // not auctionable until approved (moved to 'pool').
    status: {
      type: String,
      enum: ['pending', 'pool', 'on_auction', 'sold', 'unsold'],
      default: 'pool',
      index: true,
    },

    // Self-registration: the account that owns this profile, and whether an
    // admin has approved the (self-entered) rank. Admin/CSV imports are approved.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    rankApproved: { type: Boolean, default: true },
    soldPrice: { type: Number, default: null },
    currentTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

    // Cores are pre-assigned, never auctioned. isCore marks them; coreOf links
    // them to their team. Regular auction players leave both unset.
    isCore: { type: Boolean, default: false },
    coreOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Player', playerSchema);
