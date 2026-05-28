import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useTournamentId } from '../App.jsx';
import { useAuction } from '../lib/useAuction.js';
import { credits } from '../lib/format.js';
import Header from '../components/Header.jsx';
import Timer from '../components/Timer.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import TeamsPanel from '../components/TeamsPanel.jsx';
import { StatusBadge, Stat } from '../components/ui.jsx';

export default function CaptainTerminal() {
  const { account } = useAuth();
  const tournamentId = useTournamentId();
  const { state, connected, clockOffset, actions } = useAuction(tournamentId);
  const [toast, setToast] = useState(null);
  const [custom, setCustom] = useState('');
  const [pending, setPending] = useState(false);

  const myTeamId = account?.team;
  const myTeam = useMemo(
    () => state?.teams?.find((t) => String(t.id) === String(myTeamId)) || null,
    [state, myTeamId]
  );

  const minInc = state?.settings?.minBidIncrement ?? 1;
  const status = state?.status;
  const isLive = status === 'live';
  const isTop = String(state?.highestBidder) === String(myTeamId);
  const price = state?.currentPrice ?? 0;
  const minNext = price + minInc;
  const safeMax = myTeam?.safeMax ?? 0;
  const openSlots = myTeam?.openSlots ?? 0;
  const rosterFull = openSlots <= 0;

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2500);
  }

  async function placeBid(amount) {
    if (pending) return;
    setPending(true);
    const ack = await actions.bid(amount);
    setPending(false);
    if (ack?.error) flash(ack.error);
    else setCustom('');
  }

  // Why the BID button is locked, if it is.
  const lockReason = !isLive
    ? status === 'showcase'
      ? 'Bidding opens when the auctioneer starts'
      : status === 'paused'
      ? 'Auction paused'
      : 'Waiting for the next player'
    : rosterFull
    ? 'Your roster is full'
    : isTop
    ? "You're the top bidder"
    : safeMax < minNext
    ? 'Not enough safe credits for this player'
    : null;
  const canBid = isLive && !lockReason;

  const quickBids = [minNext, price + 5, price + 10, price + 25].filter(
    (v, i, arr) => v >= minNext && v <= safeMax && arr.indexOf(v) === i
  );

  const customNum = Number(custom);
  const customValid = Number.isFinite(customNum) && customNum >= minNext && customNum <= safeMax;

  return (
    <div className="min-h-full pb-44">
      <Header title="Captain" connected={connected} right={<StatusBadge status={status} />} />

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* My team summary */}
        <div className="panel p-4 flex items-center justify-between">
          <div>
            <div className="label">{myTeam?.name || 'Your team'}</div>
            <div className="flex items-end gap-4 mt-1">
              <Stat label="Budget" value={credits(myTeam?.currentBudget ?? 0)} accent />
              <Stat label="Slots" value={`${myTeam?.rosterCount ?? 0}/${myTeam?.rosterSize ?? 0}`} />
            </div>
          </div>
          <Timer timerEndsAt={state?.timerEndsAt} clockOffset={clockOffset} status={status} size="md" />
        </div>

        {/* Current player */}
        <PlayerCard player={state?.currentPlayer} />

        {/* Price + top bidder */}
        <div className="panel p-4 flex items-center justify-between">
          <Stat label="Current price" value={credits(price)} accent />
          <div className="text-right">
            <div className="label">Top bidder</div>
            <div className={`font-semibold ${isTop ? 'text-accent' : ''}`}>
              {state?.highestBidderName || '—'}
            </div>
          </div>
        </div>

        {/* Safe max */}
        <div className="text-center text-sm text-muted">
          Your safe maximum for this player:{' '}
          <span className="text-slate-100 font-semibold tabular-nums">{credits(safeMax)}</span>
          <div className="text-xs mt-0.5">credits are auto-reserved to fill your remaining slots</div>
        </div>

        {/* All teams */}
        <div>
          <div className="label mb-2">All teams</div>
          <TeamsPanel
            teams={state?.teams}
            highestBidderId={state?.highestBidder}
            myTeamId={myTeamId}
            dense
          />
        </div>
      </main>

      {/* Sticky bid bar */}
      <div className="fixed bottom-0 inset-x-0 bg-ink-800/95 backdrop-blur border-t border-ink-700">
        <div className="mx-auto max-w-md px-4 py-3 space-y-2">
          {toast ? <div className="text-center text-accent text-sm animate-pop">{toast}</div> : null}

          <div className="flex gap-2">
            {quickBids.slice(1).map((v) => (
              <button key={v} className="btn-ghost flex-1 text-sm" disabled={!canBid || pending} onClick={() => placeBid(v)}>
                {credits(v)}
              </button>
            ))}
            <input
              inputMode="numeric"
              placeholder="Custom"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-24 rounded-xl bg-ink-700 border border-ink-600 px-3 py-2 text-center outline-none focus:border-accent"
            />
            <button
              className="btn-ghost text-sm"
              disabled={!canBid || pending || !customValid}
              onClick={() => placeBid(customNum)}
            >
              Bid
            </button>
          </div>

          <button
            className="btn-accent w-full h-14 text-lg"
            disabled={!canBid || pending}
            onClick={() => placeBid(minNext)}
          >
            {canBid ? `BID ${credits(minNext)}` : lockReason || 'Bidding closed'}
          </button>
        </div>
      </div>
    </div>
  );
}
