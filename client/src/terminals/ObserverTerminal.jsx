import { useTournamentId } from '../App.jsx';
import { useAuction } from '../lib/useAuction.js';
import { credits } from '../lib/format.js';
import Timer from '../components/Timer.jsx';
import { ConnectionDot } from '../components/ui.jsx';

export default function ObserverTerminal() {
  const tournamentId = useTournamentId();
  const { state, connected, clockOffset } = useAuction(tournamentId);

  const status = state?.status;
  const player = state?.currentPlayer;
  const teams = state?.teams || [];
  const sales = (state?.saleLog || []).slice().reverse();

  return (
    <div className="min-h-full flex flex-col">
      {/* Top brand bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-700">
        <div className="flex items-center gap-3">
          <span className="text-accent font-black text-2xl">NTG</span>
          <span className="text-muted">Auction Cup</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>Pass {state?.pass ?? 1}</span>
          <span>Pool {state?.counts?.pool ?? 0} · Sold {state?.counts?.sold ?? 0}</span>
          <ConnectionDot connected={connected} />
        </div>
      </div>

      {/* Stage */}
      <div className="flex-1 grid lg:grid-cols-3 gap-6 p-6">
        <div className="lg:col-span-2 grid place-items-center">
          {!player ? (
            <div className="text-center text-muted">
              <div className="text-5xl font-black text-slate-200 mb-3">Stand by</div>
              <div>Waiting for the next player…</div>
            </div>
          ) : (
            <div className="text-center w-full max-w-2xl">
              {/* Photo / initials */}
              <div className="mx-auto mb-6">
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt={player.name} className="mx-auto h-56 w-56 rounded-3xl object-cover" />
                ) : (
                  <div className="mx-auto h-56 w-56 rounded-3xl bg-gradient-to-br from-accent-dim to-ink-600 grid place-items-center text-7xl font-black text-white">
                    {(player.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <h1 className="text-6xl font-black tracking-tight">{player.name}</h1>
              <div className="mt-2 flex items-center justify-center gap-3 text-xl text-muted">
                <span>{player.rank}</span>
                {player.role ? <span>· {player.role}</span> : null}
                <span>· {player.inGameName}</span>
              </div>

              {status === 'showcase' && (
                <div className="mt-6">
                  {player.gameStyle ? <p className="text-slate-300 max-w-xl mx-auto">{player.gameStyle}</p> : null}
                  <div className="mt-6 text-2xl">
                    Floor price <span className="text-accent font-bold">{credits(state.currentPrice)}</span>
                  </div>
                </div>
              )}

              {(status === 'live' || status === 'paused') && (
                <div className="mt-8 flex items-center justify-center gap-10">
                  <div className="text-center">
                    <div className="label">Current bid</div>
                    <div className="text-7xl font-black text-accent tabular-nums">{credits(state.currentPrice)}</div>
                    <div className="text-xl mt-1">{state.highestBidderName || 'No bids yet'}</div>
                  </div>
                  <Timer timerEndsAt={state?.timerEndsAt} clockOffset={clockOffset} status={status} size="lg" />
                </div>
              )}
              {status === 'paused' && <div className="mt-4 text-amber-300 text-xl">Paused</div>}
            </div>
          )}
        </div>

        {/* Rosters */}
        <div className="space-y-2 overflow-auto">
          {teams.map((t) => {
            const isTop = String(t.id) === String(state?.highestBidder);
            return (
              <div key={t.id} className={`card px-4 py-3 ${isTop ? 'ring-2 ring-accent' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t.name}</span>
                  <span className="tabular-nums font-bold">{credits(t.currentBudget)}</span>
                </div>
                <div className="text-xs text-muted">{t.rosterCount}/{t.rosterSize} filled</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sold ticker */}
      <div className="border-t border-ink-700 px-6 py-3 overflow-hidden">
        <div className="flex items-center gap-6 text-sm whitespace-nowrap">
          <span className="text-accent font-bold shrink-0">SOLD</span>
          {sales.length ? (
            sales.map((s, i) => (
              <span key={i} className="text-slate-300">
                {s.playerName} → <b>{s.teamName}</b>{' '}
                <span className="text-muted tabular-nums">{credits(s.price)}</span>
              </span>
            ))
          ) : (
            <span className="text-muted">No sales yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
