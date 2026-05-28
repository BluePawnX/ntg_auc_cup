/**
 * Seed configuration. Everything that defines THIS Cup lives here, so the seed
 * script itself stays generic. To run a different tournament, copy this file,
 * change the values, and point the seed at your own CSV — no code changes.
 *
 * Nothing in the platform is hardcoded to NTG Auction Cup 2; this config is the
 * single place tournament-specific choices are made.
 */
export const seedConfig = {
  tournament: {
    name: 'NTG Auction Cup 2',
    game: 'Valorant',
    // Per-Cup economy. 10 teams, 150 credits, 3 auction picks each (+2 cores =
    // 5-man rosters), 15s countdown.
    settings: {
      startingBudget: 150,
      rosterSize: 3,
      teamCount: 10,
      timerSeconds: 15,
      minBidIncrement: 1,
    },
    startDate: '2026-06-06',
    finalsDate: '2026-06-07',
  },

  // The game template makes the platform game-agnostic: it defines which stat
  // fields this game tracks. Swap these for an Apex/CS2 set with zero code
  // changes (Module C reads them from here).
  gameTemplate: {
    game: 'Valorant',
    statFields: [
      { key: 'kills', label: 'Kills', higherIsBetter: true },
      { key: 'deaths', label: 'Deaths', higherIsBetter: false },
      { key: 'assists', label: 'Assists', higherIsBetter: true },
      { key: 'firstBloods', label: 'First Bloods', higherIsBetter: true },
      { key: 'plants', label: 'Spike Plants', higherIsBetter: true },
    ],
    performanceFormula: 'avg_kda', // (kills + assists) / max(deaths, 1)
  },

  // Two independent levers per rank:
  //   coreCost  — credits DEDUCTED from a team's 150 for a core of this rank.
  //               Steep at the top so stronger cores cost a real premium, which
  //               leaves weaker-core teams more to spend (the balance lever).
  //               Resulting team budgets span 81 (Asc+Imm) to 118 (Dia+Dia).
  //   floorPrice — a pool player's opening/base price by rank. Tuned so the 30
  //               floors total ~60% of all spendable credits (the rest is
  //               bidding-war fuel).
  rankTable: [
    { rank: 'Radiant', coreCost: 55, floorPrice: 50 },
    { rank: 'Immortal', coreCost: 42, floorPrice: 38 },
    { rank: 'Ascendant', coreCost: 27, floorPrice: 30 },
    { rank: 'Diamond', coreCost: 16, floorPrice: 23 },
    { rank: 'Platinum', coreCost: 11, floorPrice: 16 },
    { rank: 'Gold', coreCost: 7, floorPrice: 10 },
    { rank: 'Silver', coreCost: 4, floorPrice: 6 },
    { rank: 'Bronze', coreCost: 3, floorPrice: 5 },
    { rank: 'Iron', coreCost: 2, floorPrice: 5 },
  ],

  // CSV of players, relative to this seed directory. players.csv holds the real
  // 50 registrants (10 teams × 2 cores + 30 pool). players.sample.csv is kept
  // as dummy reference data.
  csvFile: 'players.csv',

  // Dev/event login accounts. Captains get one account per team, username =
  // slug of the team name. Passwords here are for the rehearsal; the admin can
  // change them later. NEVER commit real passwords for a public deployment.
  accounts: {
    admin: { username: 'admin', password: 'ntg-admin-2026' },
    auctioneer: { username: 'auctioneer', password: 'ntg-auctioneer-2026' },
    captainPassword: 'captain-2026', // shared dev password for all captains
  },
};

export default seedConfig;
