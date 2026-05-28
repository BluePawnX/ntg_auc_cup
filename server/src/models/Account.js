import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * An Account is a login. Roles set the privilege level:
 *  - admin      : full control - create cups, import players, enter stats
 *  - auctioneer : runs the live auction
 *  - captain    : bids in the auction for one team; can edit own player profile
 *  - player     : can edit own profile only (used by self-registration)
 */
const accountSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    displayName: { type: String },

    role: {
      type: String,
      enum: ['admin', 'auctioneer', 'captain', 'player'],
      required: true,
    },

    // Scope: which tournament / team this account is tied to (captains).
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  },
  { timestamps: true }
);

// Set or change the password - hashes before storing. Never store plaintext.
accountSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

accountSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never leak the hash when an account is serialised to JSON.
accountSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.model('Account', accountSchema);
