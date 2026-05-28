/**
 * Pure seed-data builder. Takes the seed config and parsed CSV rows and returns
 * plain JS objects ready to be written to the database. No mongoose, no DB —
 * which means all of the tricky logic (budget maths, core grouping, floor
 * assignment, account generation, validation) is unit-testable on its own.
 *
 * The DB runner (seed.js) calls this, inserts the documents, then wires up the
 * ObjectId cross-references using the `key` fields produced here.
 */

/** Turns a team name into a stable lowercase username slug. */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Coerces common truthy CSV strings to a boolean. */
function toBool(v) {
  return ['true', '1', 'yes', 'y', 't'].includes(String(v).trim().toLowerCase());
}

/**
 * @param {object} config  the seed config (see config.js)
 * @param {object[]} rows  parsed CSV rows (objects keyed by header)
 * @returns {{tournament, gameTemplate, teams, players, accounts, summary}}
 * @throws  Error with a clear message if the data is inconsistent.
 */
export function buildSeedData(config, rows) {
  if (!config || !config.tournament) throw new Error('config.tournament is required');
  if (!Array.isArray(config.rankTable) || !config.rankTable.length) {
    throw new Error('config.rankTable must be a non-empty array');
  }
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No player rows found in the CSV');
  }

  const settings = config.tournament.settings;
  const rankMap = new Map(config.rankTable.map((r) => [r.rank, r]));
  const minFloor = Math.min(...config.rankTable.map((r) => r.floorPrice));

  // ---- Players -----------------------------------------------------------
  const players = rows.map((row, idx) => {
    const name = (row.name || '').trim();
    const rank = (row.rank || '').trim();
    if (!name) throw new Error(`Row ${idx + 1}: missing player name`);
    if (!rankMap.has(rank)) {
      throw new Error(`Row ${idx + 1} (${name}): unknown rank "${rank}". Add it to config.rankTable.`);
    }
    const isCore = toBool(row.isCore);
    return {
      key: `p${idx}`, // temp id; the runner maps this to a real ObjectId
      name,
      inGameName: (row.inGameName || name).trim(),
      phone: (row.phone || '').trim(),
      rank,
      role: (row.role || '').trim(),
      gameStyle: (row.gameStyle || '').trim(),
      photoUrl: (row.photoUrl || '').trim(),
      floorPrice: rankMap.get(rank).floorPrice,
      isCore,
      // Cores carry their team name + whether they captain it; pool players don't.
      teamName: isCore ? (row.team || '').trim() : '',
      isCaptain: isCore ? toBool(row.isCaptain) : false,
      status: 'pool', // pool players are auctionable; cores are excluded by isCore
    };
  });

  // ---- Teams (derived from the core players) -----------------------------
  const coresByTeam = new Map();
  for (const p of players.filter((x) => x.isCore)) {
    if (!p.teamName) throw new Error(`Core player "${p.name}" has no team set`);
    if (!coresByTeam.has(p.teamName)) coresByTeam.set(p.teamName, []);
    coresByTeam.get(p.teamName).push(p);
  }

  const teams = [];
  for (const [teamName, cores] of coresByTeam) {
    if (cores.length !== 2) {
      throw new Error(`Team "${teamName}" must have exactly 2 cores, found ${cores.length}`);
    }
    const captains = cores.filter((c) => c.isCaptain);
    if (captains.length !== 1) {
      throw new Error(`Team "${teamName}" must have exactly 1 captain core, found ${captains.length}`);
    }
    const captain = captains[0];
    const coCaptain = cores.find((c) => c !== captain);

    const core = (p) => ({
      playerKey: p.key,
      name: p.name,
      inGameName: p.inGameName,
      rank: p.rank,
      rankCost: rankMap.get(p.rank).coreCost,
    });

    const coreDeduction = rankMap.get(captain.rank).coreCost + rankMap.get(coCaptain.rank).coreCost;
    const currentBudget = settings.startingBudget - coreDeduction;

    // Guard rail: a team must be able to afford its remaining roster at floor.
    const minNeeded = settings.rosterSize * minFloor;
    if (currentBudget < minNeeded) {
      throw new Error(
        `Team "${teamName}" can't afford its roster: budget ${currentBudget} < ${settings.rosterSize} slots x ${minFloor} floor (${minNeeded}). Core costs are too high for the starting budget.`
      );
    }

    teams.push({
      key: slugify(teamName),
      name: teamName,
      core1: core(captain), // captain
      core2: core(coCaptain), // co-captain
      startingBudget: settings.startingBudget,
      coreDeduction,
      currentBudget,
      roster: [],
    });
  }

  if (settings.teamCount && teams.length !== settings.teamCount) {
    throw new Error(
      `Expected ${settings.teamCount} teams (config.teamCount) but the CSV defines ${teams.length}. Adjust the CSV or teamCount.`
    );
  }

  // ---- Accounts ----------------------------------------------------------
  const accounts = [
    { username: config.accounts.admin.username, password: config.accounts.admin.password, role: 'admin', displayName: 'Tournament Admin' },
    { username: config.accounts.auctioneer.username, password: config.accounts.auctioneer.password, role: 'auctioneer', displayName: 'Auctioneer' },
  ];
  for (const team of teams) {
    accounts.push({
      username: team.key, // e.g. "nightfall"
      password: config.accounts.captainPassword,
      role: 'captain',
      displayName: `${team.name} Captain`,
      teamKey: team.key,
      playerKey: team.core1.playerKey, // the captain core
    });
  }

  // ---- Tournament + GameTemplate ----------------------------------------
  const tournament = {
    name: config.tournament.name,
    game: config.tournament.game,
    status: 'auction',
    settings: { ...settings },
    rankTable: config.rankTable.map((r) => ({ ...r })),
    startDate: config.tournament.startDate ? new Date(config.tournament.startDate) : undefined,
    finalsDate: config.tournament.finalsDate ? new Date(config.tournament.finalsDate) : undefined,
  };

  const poolCount = players.filter((p) => !p.isCore).length;
  const summary = {
    teams: teams.length,
    cores: players.filter((p) => p.isCore).length,
    poolPlayers: poolCount,
    totalPlayers: players.length,
    accounts: accounts.length,
    floorSum: players.filter((p) => !p.isCore).reduce((s, p) => s + p.floorPrice, 0),
    spendable: settings.startingBudget * teams.length - teams.reduce((s, t) => s + t.coreDeduction, 0),
  };

  return { tournament, gameTemplate: config.gameTemplate, teams, players, accounts, summary };
}

export default buildSeedData;
