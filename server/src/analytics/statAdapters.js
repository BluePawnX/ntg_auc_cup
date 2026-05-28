/**
 * Stat-source adapters — the integration seam for AUTOMATED stat ingestion.
 *
 * Every adapter implements one method and returns the SAME shape the stats
 * endpoint already accepts ({ player, stats }), so a new source needs no other
 * code changes:
 *
 *   async fetchMatchStats({ match, players }) -> [{ player: <id>, stats: {...} }]
 *
 * Two paths feed this shape today already: manual entry, and the scoreboard
 * parser (statsParser.js, used by paste + in-browser OCR). To add a live
 * tracker API (e.g. tracker.gg / Henrik's Valorant API):
 *   1. Implement an adapter below that calls the service with your key
 *      (process.env.TRACKER_API_KEY) and maps its response to { player, stats }.
 *   2. Register it in `adapters`.
 *   3. Call it from a route (e.g. POST /matches/:id/stats/from/:adapter) and
 *      reuse the existing bulk-save — done.
 *
 * Shipped here: a `mock` adapter (zeros) so the seam is testable without keys.
 */

export const mockTrackerAdapter = {
  name: 'mock',
  async fetchMatchStats({ players = [] }) {
    return players.map((p) => ({
      player: String(p._id ?? p.id),
      stats: { kills: 0, deaths: 0, assists: 0, firstBloods: 0, plants: 0 },
    }));
  },
};

/*
// Example skeleton for a real tracker API (left commented — needs a key):
export const trackerGgAdapter = {
  name: 'tracker.gg',
  async fetchMatchStats({ match, players }) {
    const key = process.env.TRACKER_API_KEY;
    if (!key) throw new Error('TRACKER_API_KEY is not set');
    // const res = await fetch(`https://api.example/match/${match.externalId}`, { headers: { 'TRN-Api-Key': key } });
    // const data = await res.json();
    // return mapByInGameName(data, players); // → [{ player, stats }]
    throw new Error('trackerGgAdapter not implemented — fill in your provider');
  },
};
*/

export const adapters = {
  mock: mockTrackerAdapter,
};

export default adapters;
