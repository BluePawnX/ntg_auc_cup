import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="relative min-h-full grid place-items-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" />
      <div className="blob bg-accent w-[24rem] h-[24rem] -top-24 -right-24 animate-blob" />
      <div className="blob bg-ember w-[20rem] h-[20rem] -bottom-24 -left-24 animate-blob" style={{ animationDelay: '5s' }} />

      <form onSubmit={onSubmit} className="panel w-full max-w-sm p-7 space-y-4 reveal relative z-10">
        <div className="text-center">
          <Link to="/" className="inline-block text-accent font-black text-3xl tracking-tight drop-shadow-[0_0_18px_rgba(255,70,85,0.45)]">NTG</Link>
          <h1 className="text-lg font-bold mt-1">Operator sign-in</h1>
          <p className="text-muted text-sm">Auctioneer, admin & captains</p>
        </div>

        <label className="block">
          <span className="label">Username</span>
          <input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>

        {error ? <div className="text-accent text-sm">{error}</div> : null}

        <button className="btn-accent w-full h-11" disabled={busy || !username || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-xs text-muted">A player? <Link to="/register" className="text-accent hover:underline">Register here</Link></p>
      </form>
    </div>
  );
}
