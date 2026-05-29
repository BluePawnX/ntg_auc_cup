import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api.js';
import InteractiveGrid from '../components/InteractiveGrid.jsx';

const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'];

/**
 * Public self-registration page (no login). Finds the tournament currently open
 * for registration, lets a player create an account + profile, then logs them
 * straight in to their profile. Rank is admin-approved before the auction.
 *
 * Polished with the InteractiveGrid backdrop and glassy form styling to match
 * Login. Two-column on desktop, single-column on mobile.
 */
export default function Register() {
  const [tournament, setTournament] = useState(undefined);
  const [form, setForm] = useState({ username: '', password: '', name: '', inGameName: '', phone: '', rank: '', role: '', gameStyle: '', photoUrl: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.openRegistration().then((d) => setTournament(d.tournament)).catch(() => setTournament(null)); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { token } = await api.register({ ...form, tournament: tournament.id });
      localStorage.setItem('ntg.auth', token);
      window.location.assign('/profile');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  if (tournament === undefined) return <Center>Loading...</Center>;
  if (!tournament) return <Center>Registration is not open right now. Check back when the organisers open it.</Center>;

  return (
    <div className="relative min-h-full flex flex-col md:flex-row overflow-hidden">
      <InteractiveGrid blobIntensity="normal" revealRadius={280} />

      {/* Left: form */}
      <section className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-md space-y-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="text-center sm:text-left">
            <Link to="/" className="inline-block text-accent font-black text-3xl tracking-tight drop-shadow-[0_0_18px_rgba(255,70,85,0.45)]">NTG</Link>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
              <span className="gradient-text">Sign up to play.</span>
            </h1>
            <p className="text-muted mt-1.5 text-sm">Register &middot; {tournament.name}</p>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" delay={0.08}>
              <Input value={form.username} onChange={set('username')} autoCapitalize="none" placeholder="yourtag" />
            </Field>
            <Field label="Password" delay={0.12}>
              <Input type="password" value={form.password} onChange={set('password')} placeholder="********" />
            </Field>
            <Field label="Full name" delay={0.16}>
              <Input value={form.name} onChange={set('name')} placeholder="Your name" />
            </Field>
            <Field label="Valorant ID" delay={0.20}>
              <Input value={form.inGameName} onChange={set('inGameName')} placeholder="Name#TAG" />
            </Field>
            <Field label="Phone" delay={0.24}>
              <Input value={form.phone} onChange={set('phone')} placeholder="WhatsApp number" />
            </Field>
            <Field label="Rank" delay={0.28}>
              <GlassWrap>
                <select className="w-full bg-transparent text-sm px-4 py-3 rounded-2xl focus:outline-none appearance-none cursor-pointer" value={form.rank} onChange={set('rank')}>
                  <option value="" className="bg-ink-700">Select...</option>
                  {(tournament.rankTable || []).map((r) => <option key={r.rank} value={r.rank} className="bg-ink-700">{r.rank}</option>)}
                </select>
              </GlassWrap>
            </Field>
            <Field label="Preferred role" delay={0.32}>
              <GlassWrap>
                <select className="w-full bg-transparent text-sm px-4 py-3 rounded-2xl focus:outline-none appearance-none cursor-pointer" value={form.role} onChange={set('role')}>
                  <option value="" className="bg-ink-700">Select...</option>
                  {ROLES.map((r) => <option key={r} value={r} className="bg-ink-700">{r}</option>)}
                </select>
              </GlassWrap>
            </Field>
            <Field label="Photo URL (optional)" delay={0.36}>
              <Input value={form.photoUrl} onChange={set('photoUrl')} placeholder="https://..." />
            </Field>
          </div>
          <Field label="Your game style (short)" delay={0.40}>
            <GlassWrap>
              <textarea className="w-full bg-transparent text-sm px-4 py-3 h-20 rounded-2xl focus:outline-none placeholder:text-muted/60 resize-none" value={form.gameStyle} onChange={set('gameStyle')} placeholder="Aggressive entry, plays Reyna..." />
            </GlassWrap>
          </Field>

          {error ? (
            <motion.div
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              className="text-accent text-sm bg-accent/10 border border-accent/30 rounded-lg px-3 py-2"
            >
              {error}
            </motion.div>
          ) : null}

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-xs text-muted">
            Your rank will be reviewed by the organisers before the auction.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
            className="btn-accent w-full h-12 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={busy || !form.username || !form.password || !form.name || !form.inGameName || !form.rank}
          >
            {busy ? 'Creating...' : 'Register'}
          </motion.button>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="text-center text-xs text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline transition-colors">Sign in</Link>
          </motion.p>
        </form>
      </section>

      {/* Right: hero panel */}
      <section className="hidden md:flex relative z-10 flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden shadow-card border border-white/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-ember/35 via-accent/25 to-ink-900" />
          <div className="absolute inset-0 mix-blend-overlay bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_55%)]" />
          <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-white/70">{tournament.name}</div>
              <div className="mt-2 text-3xl font-black leading-tight">
                Get in the pool.<br />Get drafted.<br />Lift the cup.
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/15 p-4 space-y-2"
            >
              <Stat label="Tournament" value={tournament.name} />
              <Stat label="Game" value={tournament.game} />
              <Stat label="Status" value={tournament.status} />
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function Field({ label, children, delay = 0 }) {
  return (
    <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }} className="block col-span-1">
      <span className="label">{label}</span>
      {children}
    </motion.label>
  );
}
function GlassWrap({ children }) {
  return (
    <div className="mt-1 rounded-2xl border border-ink-600 bg-ink-700/40 backdrop-blur-sm transition-colors focus-within:border-accent focus-within:bg-ink-700/70 focus-within:shadow-glowsoft">
      {children}
    </div>
  );
}
function Input(props) {
  return (
    <GlassWrap>
      <input className="w-full bg-transparent text-sm px-4 py-3 rounded-2xl focus:outline-none placeholder:text-muted/60" {...props} />
    </GlassWrap>
  );
}
function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
const Center = ({ children }) => <div className="min-h-full grid place-items-center text-muted p-8 text-center">{children}</div>;
