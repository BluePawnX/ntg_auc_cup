import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useTournamentId } from '../App.jsx';
import { api } from '../lib/api.js';
import Header from '../components/Header.jsx';

/**
 * Admin control panel: the no-code economy editor + self-registration controls
 * (open/close registration, lock the roster, and approve pending players).
 */
export default function SettingsTerminal() {
  const { token } = useAuth();
  const tournamentId = useTournamentId();
  const [settings, setSettings] = useState(null);
  const [rankTable, setRankTable] = useState([]);
  const [reg, setReg] = useState({ registrationOpen: false, rosterLocked: false });
  const [pending, setPending] = useState([]);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  function flash(m) { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3500); }

  async function load() {
    if (!tournamentId || !token) return;
    const d = await api.tournament(tournamentId, token);
    setSettings({ ...d.tournament.settings });
    setRankTable((d.tournament.rankTable || []).map((r) => ({ ...r })));
    setReg({ registrationOpen: !!d.tournament.registrationOpen, rosterLocked: !!d.tournament.rosterLocked });
    const r = await api.registrations(tournamentId, token).catch(() => ({ players: [] }));
    setPending(r.players || []);
  }
  useEffect(() => { load().catch((e) => flash(e.message)); }, [tournamentId, token]);

  function setRank(i, key, val) { setRankTable((rt) => rt.map((r, idx) => (idx === i ? { ...r, [key]: val === '' ? '' : Number(val) } : r))); }

  async function applyEconomy() {
    setBusy(true);
    try {
      const res = await api.updateEconomy(tournamentId, {
        settings: { startingBudget: Number(settings.startingBudget), timerSeconds: Number(settings.timerSeconds), minBidIncrement: Number(settings.minBidIncrement) },
        rankTable: rankTable.map((r) => ({ rank: r.rank, coreCost: Number(r.coreCost), floorPrice: Number(r.floorPrice) })),
      }, token);
      flash(res.recomputed ? 'Saved — budgets & floors recomputed.' : 'Saved.');
      load();
    } catch (e) { flash(e.message); } finally { setBusy(false); }
  }
  async function toggleReg(patch) {
    try { await api.setRegistration(tournamentId, patch, token); flash('Updated'); load(); } catch (e) { flash(e.message); }
  }
  async function approve(p) {
    try { await api.approvePlayer(p._id, { rank: p._approveRank || p.rank }, token); flash(`Approved ${p.name}`); load(); } catch (e) { flash(e.message); }
  }

  const numInput = 'w-20 rounded bg-ink-700 border border-ink-600 px-2 py-1 text-center text-sm';
  if (!settings) return <div className="min-h-full"><Header title="Settings" /><div className="p-8 text-muted">Loading…</div></div>;
  const regUrl = `${window.location.origin}/register`;

  return (
    <div className="min-h-full">
      <Header title="Settings" />
      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        {toast ? <div className="panel p-2 text-center text-accent text-sm animate-pop">{toast}</div> : null}

        {/* Registration controls */}
        <div className="panel p-4">
          <div className="label mb-2">Self-registration</div>
          <div className="flex flex-wrap items-center gap-3">
            <button className={reg.registrationOpen ? 'btn-accent' : 'btn-ghost'} onClick={() => toggleReg({ registrationOpen: !reg.registrationOpen })}>
              {reg.registrationOpen ? 'Registration OPEN' : 'Registration closed'}
            </button>
            <button className={reg.rosterLocked ? 'btn-accent' : 'btn-ghost'} onClick={() => toggleReg({ rosterLocked: !reg.rosterLocked })}>
              {reg.rosterLocked ? 'Roster LOCKED' : 'Roster unlocked'}
            </button>
            <span className="text-xs text-muted">Share: <span className="text-slate-200">{regUrl}</span></span>
          </div>
          <div className="mt-3">
            <div className="label mb-1">Pending approvals ({pending.length})</div>
            {!pending.length ? <div className="text-muted text-sm">No one awaiting approval.</div> : (
              <div className="space-y-1">
                {pending.map((p) => (
                  <div key={p._id} className="card px-3 py-2 flex items-center gap-2">
                    <span className="flex-1 text-sm truncate">{p.name} <span className="text-muted text-xs">{p.inGameName} · self-rank {p.rank}</span></span>
                    <select className="rounded bg-ink-700 border border-ink-600 px-2 py-1 text-sm" defaultValue={p.rank} onChange={(e) => { p._approveRank = e.target.value; }}>
                      {rankTable.map((r) => <option key={r.rank} value={r.rank}>{r.rank}</option>)}
                    </select>
                    <button className="btn-ghost text-xs" onClick={() => approve(p)}>Approve</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cup settings */}
        <div className="panel p-4">
          <div className="label mb-2">Cup settings</div>
          <div className="flex flex-wrap gap-4">
            <label className="text-sm">Starting budget<input className={numInput + ' ml-2'} value={settings.startingBudget} onChange={(e) => setSettings({ ...settings, startingBudget: e.target.value.replace(/[^0-9]/g, '') })} /></label>
            <label className="text-sm">Timer (s)<input className={numInput + ' ml-2'} value={settings.timerSeconds} onChange={(e) => setSettings({ ...settings, timerSeconds: e.target.value.replace(/[^0-9]/g, '') })} /></label>
            <label className="text-sm">Min bid increment<input className={numInput + ' ml-2'} value={settings.minBidIncrement} onChange={(e) => setSettings({ ...settings, minBidIncrement: e.target.value.replace(/[^0-9]/g, '') })} /></label>
          </div>
        </div>

        {/* Rank table */}
        <div className="panel p-4">
          <div className="label mb-2">Rank table — core cost (deducted) &amp; floor price (opening bid)</div>
          <table className="w-full text-sm">
            <thead><tr className="text-muted text-xs"><th className="text-left pb-1">Rank</th><th className="text-left pb-1">Core cost</th><th className="text-left pb-1">Floor price</th></tr></thead>
            <tbody>
              {rankTable.map((r, i) => (
                <tr key={r.rank} className="border-t border-ink-600/40">
                  <td className="py-1 font-medium">{r.rank}</td>
                  <td className="py-1"><input className={numInput} value={r.coreCost} onChange={(e) => setRank(i, 'coreCost', e.target.value.replace(/[^0-9]/g, ''))} /></td>
                  <td className="py-1"><input className={numInput} value={r.floorPrice} onChange={(e) => setRank(i, 'floorPrice', e.target.value.replace(/[^0-9]/g, ''))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-accent" disabled={busy} onClick={applyEconomy}>{busy ? 'Saving…' : 'Apply & recompute'}</button>
          <span className="text-xs text-muted">Recompute is allowed only before the auction starts — after the first sale the economy locks.</span>
        </div>
      </main>
    </div>
  );
}
