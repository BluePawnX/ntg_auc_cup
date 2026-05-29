import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api.js';
import { credits } from '../lib/format.js';
import { StatusBadge } from '../components/ui.jsx';
import InteractiveGrid from '../components/InteractiveGrid.jsx';
import SpotlightTable from '../components/SpotlightTable.jsx';

/**
 * The Public Tournament Hub - a shareable, read-only spectator page. No login.
 * Schedule, standings, MVP race, Watchlist & Washed list, price-vs-performance.
 *
 * Backgrounds + tables use InteractiveGrid + SpotlightTable for the polish round.
 */
export default function PublicHub() {
  const { tid } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.publicHub(tid).then(setData).catch((e) => setError(e.message)); }, [tid]);

  if (error) return <Center>Could not load this tournament: {error}</Center>;
  if (!data) return <Center>Loading...</Center>;

  const { tournament, matches, analytics } = data;
  const a = analytics || {};

  const leaderboardRows = (a.leaderboard || []).map((t, i) => ({ id: t.id || t.name, rank: i + 1, name: t.name, wins: t.wins, losses: t.losses, diff: signed(t.diff) }));
  const mvpRows = (a.mvp || []).slice(0, 10).map((p, i) => ({ id: p.id || p.name, rank: i + 1, name: p.name, team: p.team || '-', score: p.score.toFixed(2), games: p.games }));
  const watchRows = (a.watchlist || []).slice(0, 8).map((p) => ({ id: p.id || p.name, name: p.name, paid: credits(p.price), value: '+' + p.valueIndex }));
  const washRows = (a.washed || []).slice(0, 8).map((p) => ({ id: p.id || p.name, name: p.name, paid: credits(p.price), value: p.valueIndex }));
  const pvpRows = (a.priceVsPerformance || []).slice().sort((x, y) => y.score - x.score).map((p) => ({ id: p.id || p.name, name: p.name, team: p.team || '-', rank: p.rank, paid: credits(p.price), score: p.score.toFixed(2) }));

  return (
    <div className="relative min-h-full overflow-hidden">
      <InteractiveGrid blobIntensity="subtle" revealRadius={260} />

      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-8 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-2 text-xs text-muted mb-1">
              <span className="text-accent font-black text-base">NTG</span> &middot; live hub
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight gradient-text">{tournament.name}</h1>
            <div className="text-muted text-sm mt-1">{tournament.game} &middot; {tournament.status}</div>
          </motion.div>
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="chip glass text-slate-200"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent mr-2 animate-glowPulse" />Live
          </motion.span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 grid lg:grid-cols-2 gap-6">
        <Section title="Leaderboard" i={0}>
          <SpotlightTable
            rows={leaderboardRows}
            placeholder="Search team..."
            columns={[
              { key: 'rank', label: '#', className: 'text-muted w-8', mono: true },
              { key: 'name', label: 'Team' },
              { key: 'wins', label: 'W', mono: true },
              { key: 'losses', label: 'L', mono: true },
              { key: 'diff', label: '+/-', mono: true },
            ]}
            emptyState="No results yet."
          />
        </Section>

        <Section title="MVP race" i={1}>
          <SpotlightTable
            rows={mvpRows}
            placeholder="Search player or team..."
            searchKeys={['name', 'team']}
            columns={[
              { key: 'rank', label: '#', className: 'text-muted w-8', mono: true },
              { key: 'name', label: 'Player' },
              { key: 'team', label: 'Team' },
              { key: 'score', label: 'Score', mono: true },
              { key: 'games', label: 'GP', mono: true },
            ]}
            emptyState="No stats entered yet."
          />
        </Section>

        <Section title="Watchlist - best value" i={2}>
          <SpotlightTable
            rows={watchRows}
            placeholder="Search player..."
            searchKeys={['name']}
            columns={[
              { key: 'name', label: 'Player' },
              { key: 'paid', label: 'Paid', mono: true },
              { key: 'value', label: 'Value', className: 'text-accent font-semibold', mono: true },
            ]}
            emptyState="-"
            compact
          />
        </Section>

        <Section title="Washed list - poor value" i={3}>
          <SpotlightTable
            rows={washRows}
            placeholder="Search player..."
            searchKeys={['name']}
            columns={[
              { key: 'name', label: 'Player' },
              { key: 'paid', label: 'Paid', mono: true },
              { key: 'value', label: 'Value', mono: true },
            ]}
            emptyState="-"
            compact
          />
        </Section>

        <Section title="Schedule" i={4} wide>
          {!matches.length ? <Empty>No matches scheduled.</Empty> : (
            <div className="space-y-2">
              {matches.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3 }}
                  whileHover={{ x: 2, transition: { duration: 0.15 } }}
                  className="card px-3 py-2 flex items-center gap-3"
                >
                  <span className="text-xs text-muted w-28 truncate">{m.round}</span>
                  <span className="flex-1 text-sm">{m.teamAName} <span className="text-muted">vs</span> {m.teamBName}</span>
                  {m.status === 'complete'
                    ? <span className="tabular-nums font-semibold">{m.scoreA}-{m.scoreB}</span>
                    : <span className="text-muted text-xs">{m.scheduledTime ? new Date(m.scheduledTime).toLocaleString() : 'TBD'}</span>}
                  <StatusBadge status={m.status} />
                </motion.div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Price vs performance" i={5} wide>
          <SpotlightTable
            rows={pvpRows}
            placeholder="Search player, team or rank..."
            searchKeys={['name', 'team', 'rank']}
            columns={[
              { key: 'name', label: 'Player' },
              { key: 'team', label: 'Team' },
              { key: 'rank', label: 'Rank' },
              { key: 'paid', label: 'Paid', mono: true },
              { key: 'score', label: 'Score', mono: true },
            ]}
            emptyState="No priced players with stats yet."
          />
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children, wide, i = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={wide ? 'lg:col-span-2' : ''}
    >
      <h2 className="label mb-2">{title}</h2>
      <div className="panel p-4">{children}</div>
    </motion.section>
  );
}

const Empty = ({ children }) => <div className="text-muted text-sm py-2">{children}</div>;
const Center = ({ children }) => <div className="min-h-full grid place-items-center text-muted p-8 text-center">{children}</div>;
const signed = (n) => (n > 0 ? '+' + n : String(n));
