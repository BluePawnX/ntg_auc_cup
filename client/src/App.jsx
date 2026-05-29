import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './lib/auth.jsx';
import { api } from './lib/api.js';
import Login from './components/Login.jsx';
import PageTransition from './components/PageTransition.jsx';
import CaptainTerminal from './terminals/CaptainTerminal.jsx';
import AuctioneerTerminal from './terminals/AuctioneerTerminal.jsx';
import ObserverTerminal from './terminals/ObserverTerminal.jsx';
import MatchdayTerminal from './terminals/MatchdayTerminal.jsx';
import SettingsTerminal from './terminals/SettingsTerminal.jsx';
import ProfileTerminal from './terminals/ProfileTerminal.jsx';
import PublicHub from './pages/PublicHub.jsx';
import Register from './pages/Register.jsx';
import Landing from './pages/Landing.jsx';

function homeFor(role) {
  if (role === 'captain') return '/captain';
  if (role === 'auctioneer' || role === 'admin') return '/auctioneer';
  if (role === 'player') return '/profile';
  return '/observer';
}

export function useTournamentId() {
  const { account, token } = useAuth();
  const [id, setId] = useState(account?.tournament || null);
  useEffect(() => {
    if (account?.tournament) { setId(account.tournament); return; }
    if (token) api.tournaments(token).then((d) => setId(d.tournaments?.[0]?._id || null)).catch(() => {});
  }, [account, token]);
  return id;
}

function Protected({ children, allow }) {
  const { account, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageMessage>Loading…</FullPageMessage>;
  if (!account) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allow && !allow.includes(account.role)) return <Navigate to={homeFor(account.role)} replace />;
  return children;
}

function FullPageMessage({ children }) {
  return <div className="min-h-full grid place-items-center text-muted"><div className="animate-pop">{children}</div></div>;
}

// Wrap a page node in a PageTransition. Tiny helper so the Routes block stays
// readable. We pass a stable `tk` so AnimatePresence can swap correctly.
const T = (node, tk) => <PageTransition key={tk}>{node}</PageTransition>;

export default function App() {
  const { account, loading } = useAuth();
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Public, no login */}
        <Route path="/" element={T(<Landing />, 'landing')} />
        <Route path="/hub/:tid" element={T(<PublicHub />, 'hub')} />
        <Route path="/register" element={T(<Register />, 'register')} />

        <Route path="/login" element={account ? <Navigate to={homeFor(account.role)} replace /> : T(<Login />, 'login')} />
        <Route path="/captain" element={<Protected allow={['captain', 'admin']}>{T(<CaptainTerminal />, 'captain')}</Protected>} />
        <Route path="/auctioneer" element={<Protected allow={['auctioneer', 'admin']}>{T(<AuctioneerTerminal />, 'auctioneer')}</Protected>} />
        <Route path="/matchday" element={<Protected allow={['admin', 'auctioneer']}>{T(<MatchdayTerminal />, 'matchday')}</Protected>} />
        <Route path="/settings" element={<Protected allow={['admin', 'auctioneer']}>{T(<SettingsTerminal />, 'settings')}</Protected>} />
        <Route path="/profile" element={<Protected allow={['player', 'captain', 'admin']}>{T(<ProfileTerminal />, 'profile')}</Protected>} />
        <Route path="/observer" element={<Protected>{T(<ObserverTerminal />, 'observer')}</Protected>} />
        <Route path="*" element={loading ? <FullPageMessage>Loading…</FullPageMessage> : <Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
