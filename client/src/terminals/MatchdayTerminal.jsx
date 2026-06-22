import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useTournamentId } from '../App.jsx';
import { api } from '../lib/api.js';
import Header from '../components/Header.jsx';
import { StatusBadge } from '../components/ui.jsx';

// Valorant stat fields (v1). These mirror the game template's keys; analytics
// reads them. For another game, swap this list and the template.
const STAT_FIELDS = [
  { key: 'kills', label: 'K' },
  { key: 'deaths', label: 'D' },
  { key: 'assists', label: 'A' },
  { key: 'firstBloods', label: 'FB' },
  { key: 'plants', label: 'Plant' },
];

export default function MatchdayTerminal() {
  const { token } = useAuth();
  const tournamentId = useTournamentId();
  const [tab, setTab] = useState('schedule');
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [toast, setToast] = useState(null);

  const playerById = useMemo(() => new Map(players.map((p) => [String(p._id), p])), [players]);
  const teamById = useMemo(() => new Map(teams.map((t) => [String(t._id), t])), [teams]);

  function flash(m) { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 2600); }

  async function loadAll() {
    if (!tournamentId || !token) return;
    const [t, m] = await Promise.all([api.tournament(tournamentId, token), api.matches(tournamentId, token)]);
    setTeams(t.teams); setPlayers(t.players); setMatches(m.matches);
  }
  useEffect(() => { loadAll().catch((e) => flash(e.message)); }, [tournamentId, token]);

  const squad = (team) => {
    if (!team) return [];
    const ids = [team.core1?.player, team.core2?.player, ...(team.roster || [])].filter(Boolean).map(String);
    return ids.map((id) => playerById.get(id)).filter(Boolean);
  };

  return (
    <div className="min-h-full">
      <Header title="Match Day" connected right={
        <div className="flex rounded-xl overflow-hidden border border-ink-600 text-sm">
          {['schedule', 'stats'].map((x) => (
            <button key={x} onClick={() => setTab(x)} className={`px-3 py-1 capitalize ${tab === x ? 'bg-accent text-white' : 'bg-ink-700 text-muted'}`}>{x}</button>
          ))}
        </div>
      } />
      <main className="mx-auto max-w-5xl px-4 py-4 space-y-4">
        {toast ? <div className="panel p-2 text-accent text-sm text-center animate-pop">{toast}</div> : null}
        {tab === 'schedule'
          ? <Schedule {...{ tournamentId, token, teams, matches, teamById, players, reload: loadAll, flash }} />
          : <Stats {...{ token, matches, teamById, squad, reload: loadAll, flash }} />}
      </main>
    </div>
  );
}

/* ------------------------------- Schedule ------------------------------- */
function Schedule({ tournamentId, token, teams, matches, teamById, players, reload, flash }) {
  const [form, setForm] = useState({ round: '', teamA: '', teamB: '', scheduledTime: '' });
  const [poachForm, setPoachForm] = useState({ player: '', fromTeam: '', toTeam: '' });

  async function create() {
    try { await api.createMatch(tournamentId, form, token); setForm({ round: '', teamA: '', teamB: '', scheduledTime: '' }); flash('Match added'); reload(); }
    catch (e) { flash(e.message); }
  }
  async function saveResult(m, patch) {
    try { await api.updateMatch(m.id || m._id, patch, token); flash('Saved'); reload(); } catch (e) { flash(e.message); }
  }
  async function remove(m) { try { await api.deleteMatch(m.id || m._id, token); reload(); } catch (e) { flash(e.message); } }
  async function doPoach() {
    try { await api.poach(tournamentId, poachForm, token); setPoachForm({ player: '', fromTeam: '', toTeam: '' }); flash('Poach recorded'); reload(); }
    catch (e) { flash(e.message); }
  }

  const teamOpt = (t) => <option key={t._id} value={t._id}>{t.name}</option>;
  const sel = 'rounded-lg bg-ink-700 border border-ink-600 px-2 py-1.5 text-sm';

  return (
    <>
      <div className="panel p-4">
        <div className="label mb-2">Add match</div>
        <div className="flex flex-wrap gap-2 items-center">
          <input className={sel} placeholder="Round (e.g. Semi-final)" value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} />
          <select className={sel} value={form.teamA} onChange={(e) => setForm({ ...form, teamA: e.target.value })}><option value="">Team A</option>{teams.map(teamOpt)}</select>
          <span className="text-muted">vs</span>
          <select className={sel} value={form.teamB} onChange={(e) => setForm({ ...form, teamB: e.target.value })}><option value="">Team B</option>{teams.map(teamOpt)}</select>
          <input type="datetime-local" className={sel} value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
          <button className="btn-accent" disabled={!form.round || !form.teamA || !form.teamB} onClick={create}>Add</button>
        </div>
      </div>

      <div className="panel p-4">
        <div className="label mb-2">Schedule & results</div>
        {!matches.length ? <div className="text-muted text-sm">No matches yet.</div> : (
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchRow key={m.id || m._id} m={m} teamById={teamById} onSave={saveResult} onDelete={remove} />
            ))}
          </div>
        )}
      </div>

      <div className="panel p-4">
        <div className="label mb-2">Record a poach (player moves teams — can be repeated across the tournament)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className={sel}
            value={poachForm.player}
            onChange={(e) => {
              const pid = e.target.value;
              const picked = players.find((p) => String(p._id) === String(pid));
              const cur = picked?.currentTeam ? String(picked.currentTeam) : '';
              setPoachForm({ player: pid, fromTeam: cur, toTeam: '' });
            }}
          >
            <option value="">Player</option>
            {players.map((p) => {
              const cur = p.currentTeam ? teamById.get(String(p.currentTeam))?.name : null;
              return (
                <option key={p._id} value={p._id}>
                  {p.name}{cur ? ` — ${cur}` : ''}
                </option>
              );
            })}
          </select>
          <span className="text-muted">from</span>
          <select className={sel} value={poachForm.fromTeam} onChange={(e) => setPoachForm({ ...poachForm, fromTeam: e.target.value })}><option value="">From</option>{teams.map(teamOpt)}</select>
          <span className="text-muted">to</span>
          <select className={sel} value={poachForm.toTeam} onChange={(e) => setPoachForm({ ...poachForm, toTeam: e.target.value })}><option value="">To</option>{teams.map(teamOpt)}</select>
          <button className="btn-ghost" disabled={!poachForm.player || !poachForm.fromTeam || !poachForm.toTeam || poachForm.fromTeam === poachForm.toTeam} onClick={doPoach}>Poach</button>
        </div>
        <div className="text-xs text-muted mt-2">
          Tip: picking a player auto-fills "From" with their current team. The same player can be poached again later if they get traded a second time.
        </div>
      </div>
    </>
  );
}

function MatchRow({ m, teamById, onSave, onDelete }) {
  const [scoreA, setScoreA] = useState(m.scoreA ?? '');
  const [scoreB, setScoreB] = useState(m.scoreB ?? '');
  const aName = teamById.get(String(m.teamA))?.name || 'A';
  const bName = teamById.get(String(m.teamB))?.name || 'B';

  function save(status) {
    const a = scoreA === '' ? null : Number(scoreA);
    const b = scoreB === '' ? null : Number(scoreB);
    let winner = null;
    if (status === 'complete' && a != null && b != null) winner = a >= b ? m.teamA : m.teamB;
    onSave(m, { status, scoreA: a, scoreB: b, winner });
  }
  return (
    <div className="card px-3 py-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted w-24 truncate">{m.round}</span>
      <span className="flex-1 min-w-[8rem] text-sm">{aName} <span className="text-muted">vs</span> {bName}</span>
      <input className="w-12 rounded bg-ink-700 border border-ink-600 px-1 py-1 text-center text-sm" value={scoreA} onChange={(e) => setScoreA(e.target.value.replace(/[^0-9]/g, ''))} />
      <span className="text-muted">:</span>
      <input className="w-12 rounded bg-ink-700 border border-ink-600 px-1 py-1 text-center text-sm" value={scoreB} onChange={(e) => setScoreB(e.target.value.replace(/[^0-9]/g, ''))} />
      <StatusBadge status={m.status} />
      <button className="btn-ghost text-xs" onClick={() => save('complete')}>Save result</button>
      <button className="btn-ghost text-xs" onClick={() => save('live')}>Mark live</button>
      <button className="text-xs text-muted hover:text-accent" onClick={() => onDelete(m)}>Delete</button>
    </div>
  );
}

/* -------------------------------- Stats --------------------------------- */
function Stats({ token, matches, teamById, squad, reload, flash }) {
  const [matchId, setMatchId] = useState('');
  const [rows, setRows] = useState({}); // playerId -> { team, stats:{} }
  const [paste, setPaste] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const match = matches.find((m) => String(m.id || m._id) === String(matchId));

  async function runOcr(file) {
    if (!file) return;
    setOcrBusy(true);
    try {
      const Tesseract = (await import('tesseract.js')).default; // lazy — only loaded on use
      const { data } = await Tesseract.recognize(file, 'eng');
      setPaste(data.text || '');
      flash('OCR done — review the text below, then Import');
    } catch (e) { flash('OCR failed: ' + e.message); } finally { setOcrBusy(false); }
  }

  async function doImport() {
    try {
      const { lines, unmatched } = await api.parseStats(matchId, paste, token);
      setRows((r) => {
        const next = { ...r };
        for (const l of lines) { const id = String(l.player); if (next[id]) next[id] = { ...next[id], stats: { ...next[id].stats, ...l.stats } }; }
        return next;
      });
      flash(`Imported ${lines.length} rows${unmatched.length ? ` · ${unmatched.length} unmatched (${unmatched.slice(0, 3).join(', ')})` : ''}`);
    } catch (e) { flash(e.message); }
  }

  useEffect(() => {
    if (!match) { setRows({}); return; }
    (async () => {
      const existing = await api.matchStats(matchId, token).catch(() => ({ stats: [] }));
      const byPlayer = new Map(existing.stats.map((s) => [String(s.player), s.stats || {}]));
      const next = {};
      for (const teamId of [match.teamA, match.teamB]) {
        for (const p of squad(teamById.get(String(teamId)))) {
          next[String(p._id)] = { team: String(teamId), stats: { ...byPlayer.get(String(p._id)) } };
        }
      }
      setRows(next);
    })().catch((e) => flash(e.message));
  }, [matchId]);

  function setStat(pid, key, val) {
    setRows((r) => ({ ...r, [pid]: { ...r[pid], stats: { ...r[pid].stats, [key]: val === '' ? undefined : Number(val) } } }));
  }
  async function saveAll() {
    const lines = Object.entries(rows).map(([player, v]) => ({ player, team: v.team, stats: v.stats }));
    try { await api.saveStats(matchId, lines, token); flash(`Saved ${lines.length} stat lines`); reload(); } catch (e) { flash(e.message); }
  }

  const teamGroup = (teamId) => {
    const team = teamById.get(String(teamId));
    return (
      <div key={teamId} className="mb-4">
        <div className="font-semibold mb-1">{team?.name}</div>
        <div className="space-y-1">
          {squad(team).map((p) => (
            <div key={p._id} className="card px-3 py-2 flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{p.name} <span className="text-muted text-xs">{p.rank}</span></span>
              {STAT_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-1">
                  <span className="text-[10px] uppercase text-muted">{f.label}</span>
                  <input className="w-12 rounded bg-ink-700 border border-ink-600 px-1 py-1 text-center text-sm"
                    value={rows[String(p._id)]?.stats?.[f.key] ?? ''}
                    onChange={(e) => setStat(String(p._id), f.key, e.target.value.replace(/[^0-9]/g, ''))} />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <select className="rounded-lg bg-ink-700 border border-ink-600 px-2 py-1.5 text-sm" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
          <option value="">Select a match…</option>
          {matches.map((m) => <option key={m.id || m._id} value={m.id || m._id}>{m.round}: {teamById.get(String(m.teamA))?.name} vs {teamById.get(String(m.teamB))?.name}</option>)}
        </select>
        {match ? <button className="btn-accent" onClick={saveAll}>Save stats</button> : null}
      </div>
      {!match ? <div className="text-muted text-sm">Pick a match to enter stats for both rosters.</div> : (
        <>
          <div className="card p-3 mb-4">
            <div className="label mb-1">Paste scoreboard — CSV or spaced (name k d a fb plants)</div>
            <textarea className="w-full h-20 rounded bg-ink-700 border border-ink-600 px-2 py-1 text-sm font-mono"
              value={paste} onChange={(e) => setPaste(e.target.value)}
              placeholder={'Nova, 20, 10, 5, 3, 1\nRiser  18 12 4 2 0'} />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button className="btn-ghost text-sm" disabled={!paste.trim()} onClick={doImport}>Import → prefill</button>
              <label className="btn-ghost text-sm cursor-pointer">
                {ocrBusy ? 'Reading screenshot…' : 'Upload screenshot (OCR)'}
                <input type="file" accept="image/*" className="hidden" disabled={ocrBusy} onChange={(e) => runOcr(e.target.files?.[0])} />
              </label>
              <span className="text-xs text-muted">OCR is best-effort — review before saving.</span>
            </div>
          </div>
          {teamGroup(match.teamA)}{teamGroup(match.teamB)}
        </>
      )}
    </div>
  );
}
