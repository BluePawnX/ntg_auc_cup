/**
 * Pure economy recompute. When an admin edits the rank table or starting budget
 * (before the auction starts), this re-derives every team's core deduction and
 * budget and every pool player's floor price from the new table — so the whole
 * economy can be tuned with no code changes. Pure → unit-testable.
 */

/** Re-derive team budgets + player floors from a rank table. */
export function recomputeEconomy({ startingBudget, rankTable, teams, players }) {
  const coreCost = new Map(rankTable.map((r) => [r.rank, r.coreCost]));
  const floor = new Map(rankTable.map((r) => [r.rank, r.floorPrice]));

  const teamUpdates = teams.map((t) => {
    const c1 = coreCost.get(t.core1.rank);
    const c2 = coreCost.get(t.core2.rank);
    if (c1 == null || c2 == null) throw new Error(`Team "${t.name}": a core rank is missing from the rank table`);
    const coreDeduction = c1 + c2;
    return {
      id: String(t._id ?? t.id),
      coreDeduction,
      currentBudget: startingBudget - coreDeduction,
      core1RankCost: c1,
      core2RankCost: c2,
    };
  });

  const playerUpdates = players
    .filter((p) => !p.isCore)
    .map((p) => {
      const f = floor.get(p.rank);
      if (f == null) throw new Error(`Player "${p.name}": rank ${p.rank} is missing from the rank table`);
      return { id: String(p._id ?? p.id), floorPrice: f };
    });

  return { teamUpdates, playerUpdates };
}

/**
 * The economy is "locked" once the auction has begun — any sold player or any
 * non-empty roster means budgets are mid-flight and must not be recomputed.
 */
export function economyLocked(players, teams) {
  return players.some((p) => p.status === 'sold') || teams.some((t) => (t.roster || []).length > 0);
}
