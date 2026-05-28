import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { ConnectionDot } from './ui.jsx';

/** Shared top bar. Admins/auctioneers get quick links to switch terminals. */
export default function Header({ title, connected, right }) {
  const { account, logout } = useAuth();
  const canManage = account && ['admin', 'auctioneer'].includes(account.role);
  const hubLink = account?.tournament ? `/hub/${account.tournament}` : '/hub';

  return (
    <header className="sticky top-0 z-10 bg-ink-900/80 backdrop-blur border-b border-ink-700">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-accent font-black">NTG</span>
          <span className="text-muted">/</span>
          <span className="font-semibold truncate">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {right}
          {typeof connected === 'boolean' ? <ConnectionDot connected={connected} /> : null}
          {canManage ? (
            <nav className="hidden sm:flex items-center gap-2 text-xs text-muted">
              <Link className="hover:text-slate-100" to="/auctioneer">Auction</Link>
              <Link className="hover:text-slate-100" to="/matchday">Match Day</Link>
              <Link className="hover:text-slate-100" to="/settings">Settings</Link>
              <Link className="hover:text-slate-100" to="/observer">Observer</Link>
              <Link className="hover:text-slate-100" to={hubLink}>Hub</Link>
            </nav>
          ) : null}
          <button className="text-xs text-muted hover:text-accent" onClick={logout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
