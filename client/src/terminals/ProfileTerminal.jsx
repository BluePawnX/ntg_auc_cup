import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import Header from '../components/Header.jsx';

const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];

/** A self-registered player's own profile — view + edit until the roster locks. */
export default function ProfileTerminal() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [rankTable, setRankTable] = useState([]);
  const [locked, setLocked] = useState(false);
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  function flash(m) { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3000); }

  async function load() {
    const d = await api.myProfile(token);
    setProfile(d.player); setLocked(d.rosterLocked); setRankTable(d.rankTable || []);
    const p = d.player;
    setForm({ name: p.name || '', inGameName: p.inGameName || '', phone: p.phone || '', rank: p.rank || '', role: p.role || '', gameStyle: p.gameStyle || '', photoUrl: p.photoUrl || '' });
  }
  useEffect(() => { load().catch((e) => flash(e.message)); }, [token]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const field = 'w-full rounded-xl bg-ink-700 border border-ink-600 px-3 py-2 outline-none focus:border-accent disabled:opacity-50';

  async function save() {
    setBusy(true);
    try { await api.updateProfile(form, token); flash('Profile saved'); load(); }
    catch (e) { flash(e.message); } finally { setBusy(false); }
  }

  if (!profile || !form) return <div className="min-h-full"><Header title="My Profile" /><div className="p-8 text-muted">Loading…</div></div>;

  const approved = profile.rankApproved && profile.status !== 'pending';

  return (
    <div className="min-h-full">
      <Header title="My Profile" />
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {toast ? <div className="panel p-2 text-center text-accent text-sm animate-pop">{toast}</div> : null}

        <div className="panel p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">{profile.name}</div>
            <div className="text-muted text-sm">{profile.inGameName}</div>
          </div>
          <span className={`chip ${approved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
            {approved ? 'Approved' : 'Awaiting approval'}
          </span>
        </div>

        {locked ? <div className="panel p-3 text-amber-300 text-sm">The roster is locked — profiles can no longer be edited.</div> : null}

        <div className="panel p-4 space-y-3">
          <L label="Full name"><input disabled={locked} className={field} value={form.name} onChange={set('name')} /></L>
          <L label="Valorant ID"><input disabled={locked} className={field} value={form.inGameName} onChange={set('inGameName')} /></L>
          <L label="Phone"><input disabled={locked} className={field} value={form.phone} onChange={set('phone')} /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Rank (re-approved if changed)">
              <select disabled={locked} className={field} value={form.rank} onChange={set('rank')}>
                {rankTable.map((r) => <option key={r.rank} value={r.rank}>{r.rank}</option>)}
              </select>
            </L>
            <L label="Role">
              <select disabled={locked} className={field} value={form.role} onChange={set('role')}>
                <option value="">—</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </L>
          </div>
          <L label="Photo URL"><input disabled={locked} className={field} value={form.photoUrl} onChange={set('photoUrl')} /></L>
          <L label="Game style"><textarea disabled={locked} className={`${field} h-16`} value={form.gameStyle} onChange={set('gameStyle')} /></L>
          <button className="btn-accent w-full" disabled={locked || busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </main>
    </div>
  );
}

function L({ label, children }) {
  return <label className="block"><span className="label">{label}</span><div className="mt-1">{children}</div></label>;
}
