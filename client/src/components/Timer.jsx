import { useTick, secondsLeft } from '../lib/format.js';

/**
 * Renders the server-owned countdown. Every screen renders from the same
 * `timerEndsAt` timestamp (corrected by our clock offset), so all devices show
 * the same number regardless of local clock drift.
 */
export default function Timer({ timerEndsAt, clockOffset, status, size = 'md' }) {
  useTick(100);
  const left = secondsLeft(timerEndsAt, clockOffset);

  const sizes = {
    sm: 'text-3xl w-16 h-16',
    md: 'text-5xl w-28 h-28',
    lg: 'text-8xl w-56 h-56',
  };

  if (status !== 'live' || left === null) {
    return (
      <div className={`grid place-items-center rounded-full border-2 border-ink-600 text-muted ${sizes[size]}`}>
        <span className="font-bold tabular-nums">—</span>
      </div>
    );
  }

  const urgent = left <= 5;
  const display = left < 10 ? left.toFixed(1) : Math.ceil(left);

  return (
    <div
      className={`grid place-items-center rounded-full border-4 tabular-nums font-bold transition-colors
        ${sizes[size]} ${urgent ? 'border-accent text-accent animate-pulseRed' : 'border-ink-500 text-slate-100'}`}
    >
      {display}
    </div>
  );
}
