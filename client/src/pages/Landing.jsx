import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const homeFor = (role) => (role === 'captain' ? '/captain' : role === 'player' ? '/profile' : role === 'auctioneer' || role === 'admin' ? '/auctioneer' : '/observer');

const FEATURES = [
  { icon: GavelIcon, title: 'Live auction', text: 'Real-time bidding with a server-owned clock, a dynamic budget reserve, and instant sync to every phone in the room.' },
  { icon: CastIcon, title: 'Spectator hub', text: 'A shareable, no-login page with the schedule, standings, MVP race and value lists — updating as the games play out.' },
  { icon: ChartIcon, title: 'Analytics & MVP', text: 'Per-player performance across every game, price-vs-performance value index, and automatic Watchlist & Washed lists.' },
];

export default function Landing() {
  const { account } = useAuth();
  const [tournament, setTournament] = useState(null);

  useEffect(() => { api.latest().then((d) => setTournament(d.tournament)).catch(() => {}); }, []);

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* animated backdrop */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
      <div className="blob bg-accent w-[34rem] h-[34rem] -top-40 -right-40 animate-blob" />
      <div className="blob bg-ember w-[26rem] h-[26rem] top-1/2 -left-40 animate-blob" style={{ animationDelay: '4s' }} />

      {/* nav */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-accent font-black text-xl tracking-tight">NTG</span>
          <span className="text-muted text-sm hidden sm:inline">Tournament Platform</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          {tournament ? <Link to={`/hub/${tournament.id}`} className="btn-ghost">Watch live</Link> : null}
          {account ? <Link to={homeFor(account.role)} className="btn-accent">Open terminal</Link>
            : <Link to="/login" className="btn-ghost">Operator login</Link>}
        </nav>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <span className="chip glass text-slate-200 reveal" style={{ animationDelay: '0ms' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-accent mr-2 animate-glowPulse" />
          {tournament ? tournament.name : 'NTG Esports'}
        </span>
        <h1 className="mt-6 text-5xl sm:text-7xl font-black leading-[1.05] tracking-tight reveal" style={{ animationDelay: '80ms' }}>
          Run the entire <span className="gradient-text">tournament</span>,<br className="hidden sm:block" /> from auction to MVP.
        </h1>
        <p className="mt-6 text-lg text-muted max-w-2xl mx-auto reveal" style={{ animationDelay: '160ms' }}>
          A live drafting auction, match-day scheduling and stats, and a spectator hub with automatic analytics —
          one platform, built for esports, reusable for any cup.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 reveal" style={{ animationDelay: '240ms' }}>
          <Link to="/register" className="btn-accent text-base px-6 py-3">Register to play</Link>
          {tournament ? <Link to={`/hub/${tournament.id}`} className="btn-ghost text-base px-6 py-3">Watch the hub →</Link> : null}
        </div>
      </section>

      {/* features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 grid md:grid-cols-3 gap-5">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="panel p-6 hover-lift reveal" style={{ animationDelay: `${320 + i * 90}ms` }}>
            <div className="h-11 w-11 rounded-xl bg-accent-grad grid place-items-center text-white shadow-glow">
              <f.icon />
            </div>
            <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted leading-relaxed">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-muted">
        NTG Tournament Platform · built for {tournament ? tournament.game : 'Valorant'} and beyond
      </footer>
    </div>
  );
}

function GavelIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 13-7.5 7.5" /><path d="m16 10 4 4" /><path d="m9 7 4 4" /><path d="M12 5l7 7" /><path d="M4 20h7" /></svg>;
}
function CastIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8a10 10 0 0 1 10 10" /><path d="M2 13a5 5 0 0 1 5 5" /><circle cx="3" cy="19" r="1" /><rect x="2" y="4" width="20" height="14" rx="2" opacity="0.4" /></svg>;
}
function ChartIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></svg>;
}
