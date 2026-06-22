/**
 * Seed configuration. Everything that defines THIS Cup lives here, so the seed
 * script itself stays generic. To run a different tournament, copy this file,
 * change the values, and point the seed at your own CSV — no code changes.
 */
export const seedConfig = {
  tournament: {
    name: 'AUC Cup 2 (NTG x Aorus Cafe League)',
    game: 'Valorant',
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

  gameTemplate: {
    game: 'Valorant',
    statFields: [
      { key: 'kills', label: 'Kills', higherIsBetter: true },
      { key: 'deaths', label: 'Deaths', higherIsBetter: false },
      { key: 'assists', label: 'Assists', higherIsBetter: true },
      { key: 'firstBloods', label: 'First Bloods', higherIsBetter: true },
      { key: 'plants', label: 'Spike Plants', higherIsBetter: true },
    ],
    performanceFormula: 'valorant_mvp',
  },

  // Final economy for the new roster + rank changes (post-second-round
  // registration).  Core cost ladder was COMPRESSED for this cup because more
  // captains/cores ended up Immortal than expected — keeping the original 42/27
  // values would have created an 80-118 wallet spread (52 cr), which is too
  // wide.  Compressed values 35/25/16 give an 80-118 spread of 38 cr, matching
  // last cup's balance feel.
  //
  // Resulting wallets across the 10 teams (sum 964):
  //   D+D: 118  | D+A: 109  | A+A: 100 | D+I: 99 | A+I: 90 | I+I: 80
  // Floor pool: 577 = 59.9% of total wallets (target 60%).
  rankTable: [
    { rank: 'Radiant', coreCost: 45, floorPrice: 50 },
    { rank: 'Immortal', coreCost: 35, floorPrice: 38 },
    { rank: 'Ascendant', coreCost: 25, floorPrice: 30 },
    { rank: 'Diamond', coreCost: 16, floorPrice: 23 },
    { rank: 'Platinum', coreCost: 11, floorPrice: 16 },
    { rank: 'Gold', coreCost: 7, floorPrice: 10 },
    { rank: 'Silver', coreCost: 4, floorPrice: 6 },
    { rank: 'Bronze', coreCost: 3, floorPrice: 5 },
    { rank: 'Iron', coreCost: 2, floorPrice: 5 },
  ],

  csvFile: 'players.csv',

  accounts: {
    admin: { username: 'admin', password: 'ntg-admin-2026' },
    auctioneer: { username: 'auctioneer', password: 'ntg-auctioneer-2026' },
    captainPassword: 'captain-2026',
  },
};

export default seedConfig;
