import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/auth.jsx';
import InteractiveGrid from './InteractiveGrid.jsx';

/**
 * Operator sign-in (auctioneer/admin/captain). Two-column layout: animated form
 * on the left, hero panel with NTG-themed art + quote on the right. On mobile
 * the hero collapses and the form takes the full screen.
 */
export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(username.trim(), password); }
    catch (err) { setError(err.message || 'Login failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative min-h-full flex flex-col md:flex-row overflow-hidden">
      <InteractiveGrid blobIntensity="normal" revealRadius={280} />

      {/* Left: sign-in form */}
      <section className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <form onSubmit={onSubmit} className="space-y-5">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="text-center sm:text-left">
              <Link to="/" className="inline-block text-accent font-black text-3xl tracking-tight drop-shadow-[0_0_18px_rgba(255,70,85,0.45)]">NTG</Link>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
                <span className="gradient-text">Welcome back.</span>
              </h1>
              <p className="text-muted mt-1.5 text-sm">Auctioneer, admin & captain sign-in.</p>
            </motion.div>

            <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }} className="block">
              <span className="label">Username</span>
              <GlassInput>
                <input
                  className="w-full bg-transparent text-sm px-4 py-3 rounded-2xl focus:outline-none placeholder:text-muted/60"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="auctioneer"
                  autoCapitalize="none" autoCorrect="off" autoComplete="username"
                />
              </GlassInput>
            </motion.label>

            <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.4 }} className="block">
              <span className="label">Password</span>
              <GlassInput>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-transparent text-sm px-4 py-3 pr-11 rounded-2xl focus:outline-none placeholder:text-muted/60"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-3 my-auto h-7 w-7 grid place-items-center text-muted hover:text-accent transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </GlassInput>
            </motion.label>

            {error ? (
              <motion.div
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                className="text-accent text-sm bg-accent/10 border border-accent/30 rounded-lg px-3 py-2"
              >
                {error}
              </motion.div>
            ) : null}

            <motion.button
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.4 }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              className="btn-accent w-full h-12 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy || !username || !password}
            >
              {busy ? 'Signing in...' : 'Sign in'}
            </motion.button>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }} className="text-center text-xs text-muted">
              A player?{' '}
              <Link to="/register" className="text-accent hover:underline transition-colors">Register here</Link>
            </motion.p>
          </form>
        </div>
      </section>

      {/* Right: hero panel with quote */}
      <section className="hidden md:flex relative z-10 flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden shadow-card border border-white/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/40 via-ember/20 to-ink-900" />
          <div className="absolute inset-0 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-white/70">NTG &middot; Auction Cup 2</div>
              <div className="mt-2 text-3xl font-black leading-tight">
                Bid fast.<br />Build the squad.<br />Run the cup.
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/15 p-4"
            >
              <p className="text-sm leading-snug">
                Real-time bidding with a server-owned clock and instant sync to every phone in the room.
              </p>
              <div className="mt-2 text-xs text-white/70">Live auction module</div>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function GlassInput({ children }) {
  return (
    <div className="mt-1 rounded-2xl border border-ink-600 bg-ink-700/40 backdrop-blur-sm transition-colors focus-within:border-accent focus-within:bg-ink-700/70 focus-within:shadow-glowsoft">
      {children}
    </div>
  );
}

function Eye() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOff() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a17.4 17.4 0 0 1 3.86-5.12"/><path d="M1 1l22 22"/><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/><path d="M10.5 5.18A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a17.4 17.4 0 0 1-1.85 2.95"/></svg>;
}
