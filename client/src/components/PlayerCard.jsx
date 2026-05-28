import { RankPill } from './ui.jsx';

/** The player profile card shown in showcase + during live bidding. */
export default function PlayerCard({ player, compact = false }) {
  if (!player) {
    return (
      <div className="card p-8 grid place-items-center text-muted min-h-[14rem]">
        Waiting for the auctioneer to draw a player…
      </div>
    );
  }

  const initials = (player.name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="shrink-0">
          {player.photoUrl ? (
            <img
              src={player.photoUrl}
              alt={player.name}
              className={`rounded-xl object-cover ${compact ? 'h-20 w-20' : 'h-28 w-28'}`}
            />
          ) : (
            <div
              className={`rounded-xl bg-gradient-to-br from-accent-dim to-ink-600 grid place-items-center
                font-black text-white ${compact ? 'h-20 w-20 text-2xl' : 'h-28 w-28 text-4xl'}`}
            >
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={`font-extrabold truncate ${compact ? 'text-xl' : 'text-3xl'}`}>{player.name}</h2>
            <RankPill rank={player.rank} />
            {player.role ? <span className="chip bg-ink-600 text-slate-300">{player.role}</span> : null}
          </div>
          <div className="text-muted text-sm mt-0.5">{player.inGameName}</div>
          {!compact && player.gameStyle ? (
            <p className="text-slate-300 text-sm mt-2 leading-snug">{player.gameStyle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
