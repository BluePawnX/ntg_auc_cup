/** Small shared presentational bits used across the terminals. */

export function ConnectionDot({ connected }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span
        className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
      />
      {connected ? 'Live' : 'Reconnecting'}
    </span>
  );
}

const STATUS_STYLES = {
  idle: 'bg-ink-600 text-slate-300',
  showcase: 'bg-sky-500/20 text-sky-300',
  live: 'bg-accent/20 text-accent',
  paused: 'bg-amber-500/20 text-amber-300',
  sold: 'bg-emerald-500/20 text-emerald-300',
};

export function StatusBadge({ status }) {
  const label = { idle: 'Idle', showcase: 'Showcase', live: 'Live', paused: 'Paused', sold: 'Sold' }[status] || status;
  return <span className={`chip ${STATUS_STYLES[status] || 'bg-ink-600'}`}>{label}</span>;
}

export function Stat({ label, value, accent }) {
  return (
    <div className="flex flex-col">
      <span className="label">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${accent ? 'text-accent' : ''}`}>{value}</span>
    </div>
  );
}

export function RankPill({ rank }) {
  return <span className="chip bg-ink-600 text-slate-300">{rank}</span>;
}
