import { credits } from '../lib/format.js';

/**
 * All teams, always visible — budget, slots filled, and who is the current
 * highest bidder. Optionally highlights the viewer's own team.
 */
export default function TeamsPanel({ teams = [], highestBidderId, myTeamId, dense = false }) {
  return (
    <div className={`grid gap-2 ${dense ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {teams.map((t) => {
        const isTop = String(t.id) === String(highestBidderId);
        const isMine = String(t.id) === String(myTeamId);
        const full = t.openSlots <= 0;
        return (
          <div
            key={t.id}
            className={`card px-3 py-2 flex items-center justify-between gap-2 transition
              ${isTop ? 'ring-2 ring-accent' : ''} ${isMine ? 'bg-ink-600/70' : ''}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold truncate">{t.name}</span>
                {isMine ? <span className="chip bg-accent/20 text-accent">You</span> : null}
                {isTop ? <span className="chip bg-accent text-white">Top bid</span> : null}
              </div>
              <div className="text-xs text-muted">
                {t.rosterCount}/{t.rosterSize} filled{full ? ' · complete' : ''}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold tabular-nums">{credits(t.currentBudget)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">credits</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
