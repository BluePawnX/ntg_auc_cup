import mongoose from 'mongoose';

/**
 * Match-day models (Module B & C). Included now so the schema is complete and
 * stable from the start, even though these modules are built in Block 2.
 */

// ----- Match ---------------------------------------------------------------
const matchSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },

    round: { type: String, required: true },        // "Round 1", "Semi-final", ...
    teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },

    scheduledTime: { type: Date },                   // entered manually from Toornament

    status: {
      type: String,
      enum: ['upcoming', 'live', 'complete'],
      default: 'upcoming',
    },

    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    scoreA: { type: Number, default: null },
    scoreB: { type: Number, default: null },
  },
  { timestamps: true }
);

// ----- PlayerMatchStats ----------------------------------------------------
// One line per player per match. `team` records who they played for AT THIS
// MATCH - so poaching never corrupts a player's personal history.
const playerMatchStatsSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

    // Flexible stat bag keyed by the game template's stat field keys, e.g.
    // { kills: 18, deaths: 12, assists: 5, firstBloods: 3, plants: 2 }.
    stats: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

playerMatchStatsSchema.index({ match: 1, player: 1 }, { unique: true });

// ----- PoachEvent ----------------------------------------------------------
// Records a player moving from the losing team to the winning team after a
// match. The roster history is reconstructable from these events.
const poachEventSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    // match is OPTIONAL — late-tournament poaches (esp. between SF/Final) can
    // be recorded without an explicit linked match. The same player can be
    // poached multiple times across the tournament; no unique constraint here.
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    fromTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    toTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Match = mongoose.model('Match', matchSchema);
export const PlayerMatchStats = mongoose.model('PlayerMatchStats', playerMatchStatsSchema);
export const PoachEvent = mongoose.model('PoachEvent', poachEventSchema);
