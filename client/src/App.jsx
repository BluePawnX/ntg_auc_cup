import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { api } from './lib/api.js';
import Login from './components/Login.jsx';
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

export default function App() {
  const { account, loading } = useAuth();
  return (
    <Routes>
      {/* Public, no login */}
      <Route path="/" element={<Landing />} />
      <Route path="/hub/:tid" element={<PublicHub />} />
      <Route path="/register" element={<Register />} />

      <Route path="/login" element={account ? <Navigate to={homeFor(account.role)} replace /> : <Login />} />
      <Route path="/captain" element={<Protected allow={['captain', 'admin']}><CaptainTerminal /></Protected>} />
      <Route path="/auctioneer" element={<Protected allow={['auctioneer', 'admin']}><AuctioneerTerminal /></Protected>} />
      <Route path="/matchday" element={<Protected allow={['admin', 'auctioneer']}><MatchdayTerminal /></Protected>} />
      <Route path="/settings" element={<Protected allow={['admin', 'auctioneer']}><SettingsTerminal /></Protected>} />
      <Route path="/profile" element={<Protected allow={['player', 'captain', 'admin']}><ProfileTerminal /></Protected>} />
      <Route path="/observer" element={<Protected><ObserverTerminal /></Protected>} />
      <Route path="*" element={loading ? <FullPageMessage>Loading…</FullPageMessage> : <Navigate to="/" replace />} />
    </Routes>
  );
}
