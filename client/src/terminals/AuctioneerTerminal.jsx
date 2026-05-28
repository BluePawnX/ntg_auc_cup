import { useState } from 'react';
import { useTournamentId } from '../App.jsx';
import { useAuction } from '../lib/useAuction.js';
import { credits } from '../lib/format.js';
import Header from '../components/Header.jsx';
import Timer from '../components/Timer.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import TeamsPanel from '../components/TeamsPanel.jsx';
import EventFeed from '../components/EventFeed.jsx';
import { StatusBadge, Stat } from '../components/ui.jsx';

export default function AuctioneerTerminal() {
  const tournamentId = useTournamentId();
  const { state, connected, clockOffset, events, actions } = useAuction(tournamentId);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState(null);
  const [pass, setPass] = useState(1);

  const status = state?.status;
  const counts = state?.counts || { pool: 0, sold: 0, unsold: 0 };
  const hasBids = !!state?.highestBidder;
  const canUndo = status === 'idle' && (state?.saleLog?.length || 0) > 0;

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2500);
  }

  // Wrap every action: debounce against double-clicks, surface ack errors.
  async function run(fn) {
    if (pending) return;
    setPending(true);
    const ack = await fn();
    setPending(false);
    if (ack?.error) flash(ack.error);
  }

  const Btn = ({ onClick, disabled, kind = 'ghost', children }) => (
    <button
      className={kind === 'accent' ? 'btn-accent' : 'btn-ghost'}
      disabled={pending || disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-full">
      <Header title="Auctioneer" connected={connected} right={<StatusBadge status={status} />} />

      <main className="mx-auto max-w-6xl px-4 py-4 grid lg:grid-cols-3 gap-4">
        {/* Stage */}
        <section className="lg:col-span-2 space-y-4">
          <div className="panel p-4 flex items-center gap-4">
            <Timer timerEndsAt={state?.timerEndsAt} clockOffset={clockOffset} status={status} size="md" />
            <div className="flex-1">
              <Stat label="Current price" value={credits(state?.currentPrice ?? 0)} accent />
              <div className="text-sm text-muted mt-1">
                Top: <span className="text-slate-100">{state?.highestBidderName || '—'}</span>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted">Pool {counts.pool} · Sold {counts.sold} · Unsold {counts.unsold}</div>
              <div className="text-muted mt-1">Pass {state?.pass ?? 1}</div>
            </div>
          </div>

          <PlayerCard player={state?.currentPlayer} />

          {/* Controls */}
          <div className="panel p-4 space-y-3">
            {toast ? <div className="text-accent text-sm animate-pop">{toast}</div> : null}

            <div className="flex items-center gap-2">
              <span className="label">Draw from</span>
              <div className="flex rounded-xl overflow-hidden border border-ink-600">
                {[1, 2].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPass(p)}
                    className={`px-3 py-1 text-sm ${pass === p ? 'bg-accent text-white' : 'bg-ink-700 text-muted'}`}
                  >
                    Pass {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Btn kind="accent" disabled={status !== 'idle'} onClick={() => run(() => actions.selectPlayer(pass))}>
                Draw player
              </Btn>
              <Btn kind="accent" disabled={status !== 'showcase'} onClick={() => run(() => actions.startAuction())}>
                Start bidding
              </Btn>
              <Btn disabled={status !== 'live'} onClick={() => run(() => actions.hammer())}>
                {status === 'live' && !hasBids ? 'Mark unsold' : 'Hammer (sell)'}
              </Btn>
              <Btn disabled={status !== 'live'} onClick={() => run(() => actions.pause())}>
                Pause
              </Btn>
              <Btn disabled={status !== 'paused'} onClick={() => run(() => actions.resume())}>
                Resume
              </Btn>
              <Btn disabled={!canUndo} onClick={() => run(() => actions.undoLastSale())}>
                Undo last sale
              </Btn>
            </div>
          </div>
        </section>

        {/* Side: live feed + teams */}
        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="label mb-2">Live feed</div>
            <EventFeed events={events} className="max-h-64 overflow-auto" />
          </div>
          <div className="panel p-4">
            <div className="label mb-2">Teams</div>
            <TeamsPanel teams={state?.teams} highestBidderId={state?.highestBidder} />
          </div>
        </aside>
      </main>
    </div>
  );
}
