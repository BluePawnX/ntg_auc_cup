import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];

/**
 * Public self-registration page (no login). Finds the tournament currently open
 * for registration, lets a player create an account + profile, then logs them
 * straight in to their profile. Rank is admin-approved before the auction.
 */
export default function Register() {
  const [tournament, setTournament] = useState(undefined); // undefined = loading, null = none open
  const [form, setForm] = useState({ username: '', password: '', name: '', inGameName: '', phone: '', rank: '', role: '', gameStyle: '', photoUrl: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.openRegistration().then((d) => setTournament(d.tournament)).catch(() => setTournament(null)); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const field = 'w-full rounded-xl bg-ink-700 border border-ink-600 px-3 py-2 outline-none focus:border-accent';

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { token } = await api.register({ ...form, tournament: tournament.id });
      localStorage.setItem('ntg.auth', token);
      window.location.assign('/profile');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  if (tournament === undefined) return <Center>Loading…</Center>;
  if (!tournament) return <Center>Registration isn’t open right now. Check back when the organisers open it.</Center>;

  return (
    <div className="relative min-h-full grid place-items-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" />
      <div className="blob bg-accent w-[24rem] h-[24rem] -top-24 -left-24 animate-blob" />
      <div className="blob bg-ember w-[20rem] h-[20rem] -bottom-24 -right-24 animate-blob" style={{ animationDelay: '5s' }} />
      <form onSubmit={submit} className="panel w-full max-w-md p-6 space-y-3 reveal relative z-10">
        <div className="text-center mb-1">
          <div className="text-accent font-black text-2xl">NTG</div>
          <h1 className="text-lg font-bold">Register · {tournament.name}</h1>
          <p className="text-muted text-sm">Create your player account</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <L label="Username"><input className={field} value={form.username} onChange={set('username')} autoCapitalize="none" /></L>
          <L label="Password"><input type="password" className={field} value={form.password} onChange={set('password')} /></L>
          <L label="Full name"><input className={field} value={form.name} onChange={set('name')} /></L>
          <L label="Valorant ID"><input className={field} value={form.inGameName} onChange={set('inGameName')} placeholder="Name#TAG" /></L>
          <L label="Phone"><input className={field} value={form.phone} onChange={set('phone')} /></L>
          <L label="Rank">
            <select className={field} value={form.rank} onChange={set('rank')}>
              <option value="">Select…</option>
              {(tournament.rankTable || []).map((r) => <option key={r.rank} value={r.rank}>{r.rank}</option>)}
            </select>
          </L>
          <L label="Preferred role">
            <select className={field} value={form.role} onChange={set('role')}>
              <option value="">Select…</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </L>
          <L label="Photo URL (optional)"><input className={field} value={form.photoUrl} onChange={set('photoUrl')} /></L>
        </div>
        <L label="Your game style (short)"><textarea className={`${field} h-16`} value={form.gameStyle} onChange={set('gameStyle')} /></L>

        {error ? <div className="text-accent text-sm">{error}</div> : null}
        <p className="text-xs text-muted">Your rank will be reviewed by the organisers before the auction.</p>
        <button className="btn-accent w-full" disabled={busy || !form.username || !form.password || !form.name || !form.inGameName || !form.rank}>
          {busy ? 'Creating…' : 'Register'}
        </button>
      </form>
    </div>
  );
}

function L({ label, children }) {
  return <label className="block"><span className="label">{label}</span><div className="mt-1">{children}</div></label>;
}
const Center = ({ children }) => <div className="min-h-full grid place-items-center text-muted p-8 text-center">{children}</div>;
