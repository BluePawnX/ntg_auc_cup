import { credits } from '../lib/format.js';

/** A live feed of bids and sales (the auctioneer's running log). */
export default function EventFeed({ events = [], className = '' }) {
  if (!events.length) {
    return <div className={`text-muted text-sm ${className}`}>No activity yet.</div>;
  }
  return (
    <ul className={`space-y-1 ${className}`}>
      {events.map((e) => (
        <li key={e.id} className="text-sm flex items-center gap-2 animate-pop">
          {e.type === 'bid' && (
            <>
              <span className="chip bg-accent/20 text-accent">BID</span>
              <span className="truncate">
                <b>{e.teamName}</b> → <span className="tabular-nums">{credits(e.amount)}</span>
              </span>
            </>
          )}
          {e.type === 'sold' && (
            <>
              <span className="chip bg-emerald-500/20 text-emerald-300">SOLD</span>
              <span className="truncate">
                <b>{e.playerName}</b> to {e.teamName} ·{' '}
                <span className="tabular-nums">{credits(e.price)}</span>
              </span>
            </>
          )}
          {e.type === 'unsold' && (
            <>
              <span className="chip bg-ink-600 text-slate-300">UNSOLD</span>
              <span className="truncate">{e.playerName} — back to pass 2</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
