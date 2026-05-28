import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { credits } from '../lib/format.js';
import { StatusBadge } from '../components/ui.jsx';

/**
 * The Public Tournament Hub — a shareable, read-only spectator page. No login.
 * Schedule, standings, MVP race, Watchlist & Washed list, price-vs-performance.
 */
export default function PublicHub() {
  const { tid } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.publicHub(tid).then(setData).catch((e) => setError(e.message)); }, [tid]);

  if (error) return <Center>Couldn’t load this tournament: {error}</Center>;
  if (!data) return <Center>Loading…</Center>;

  const { tournament, matches, analytics } = data;
  const a = analytics || {};

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" />
      <div className="blob bg-accent w-[30rem] h-[30rem] -top-40 right-0 animate-blob" />

      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-8 flex items-center justify-between reveal">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted mb-1">
              <span className="text-accent font-black text-base">NTG</span> · live hub
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight gradient-text">{tournament.name}</h1>
            <div className="text-muted text-sm mt-1">{tournament.game} · {tournament.status}</div>
          </div>
          <span className="chip glass text-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-accent mr-2 animate-glowPulse" />Live</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 grid lg:grid-cols-2 gap-6">
        <Section title="Leaderboard" i={0}>
          <Table head={['#', 'Team', 'W', 'L', '+/-']} rows={(a.leaderboard || []).map((t, i) => [i + 1, t.name, t.wins, t.losses, signed(t.diff)])} empty="No results yet." />
        </Section>
        <Section title="MVP race" i={1}>
          <Table head={['#', 'Player', 'Team', 'Score', 'GP']} rows={(a.mvp || []).slice(0, 10).map((p, i) => [i + 1, p.name, p.team || '—', p.score.toFixed(2), p.games])} empty="No stats entered yet." />
        </Section>
        <Section title="Watchlist — best value" i={2}>
          <Table head={['Player', 'Paid', 'Value']} rows={(a.watchlist || []).slice(0, 8).map((p) => [p.name, credits(p.price), '+' + p.valueIndex])} empty="—" accent />
        </Section>
        <Section title="Washed list — poor value" i={3}>
          <Table head={['Player', 'Paid', 'Value']} rows={(a.washed || []).slice(0, 8).map((p) => [p.name, credits(p.price), p.valueIndex])} empty="—" />
        </Section>
        <Section title="Schedule" i={4} wide>
          {!matches.length ? <Empty>No matches scheduled.</Empty> : (
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="card px-3 py-2 flex items-center gap-3 hover-lift">
                  <span className="text-xs text-muted w-28 truncate">{m.round}</span>
                  <span className="flex-1 text-sm">{m.teamAName} <span className="text-muted">vs</span> {m.teamBName}</span>
                  {m.status === 'complete'
                    ? <span className="tabular-nums font-semibold">{m.scoreA}–{m.scoreB}</span>
                    : <span className="text-muted text-xs">{m.scheduledTime ? new Date(m.scheduledTime).toLocaleString() : 'TBD'}</span>}
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="Price vs performance" i={5} wide>
          <Table head={['Player', 'Team', 'Rank', 'Paid', 'Score']} rows={(a.priceVsPerformance || []).slice().sort((x, y) => y.score - x.score).map((p) => [p.name, p.team || '—', p.rank, credits(p.price), p.score.toFixed(2)])} empty="No priced players with stats yet." />
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children, wide, i = 0 }) {
  return (
    <section className={`${wide ? 'lg:col-span-2' : ''} reveal`} style={{ animationDelay: `${i * 70}ms` }}>
      <h2 className="label mb-2">{title}</h2>
      <div className="panel p-4">{children}</div>
    </section>
  );
}
function Table({ head, rows, empty, accent }) {
  if (!rows || !rows.length) return <Empty>{empty}</Empty>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-muted text-xs">{head.map((h, i) => <th key={i} className="text-left font-medium pb-1">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-white/5 transition-colors hover:bg-white/5">
            {r.map((c, j) => <td key={j} className={`py-1.5 ${j === 0 ? 'text-muted' : ''} ${accent && j === r.length - 1 ? 'text-accent font-semibold' : ''} tabular-nums`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
const Empty = ({ children }) => <div className="text-muted text-sm py-2">{children}</div>;
const Center = ({ children }) => <div className="min-h-full grid place-items-center text-muted p-8 text-center">{children}</div>;
const signed = (n) => (n > 0 ? '+' + n : String(n));
