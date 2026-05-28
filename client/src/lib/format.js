import { useEffect, useState } from 'react';

/** Re-renders the calling component every `ms` so countdowns tick. */
export function useTick(ms = 200) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/**
 * Seconds left on the server-owned countdown, computed from the single
 * timerEndsAt timestamp corrected by our measured clock offset. Returns a
 * float so callers can show one decimal in the final seconds.
 */
export function secondsLeft(timerEndsAt, clockOffset = 0) {
  if (!timerEndsAt) return null;
  const serverNow = Date.now() - clockOffset;
  return Math.max(0, (new Date(timerEndsAt).getTime() - serverNow) / 1000);
}

export const credits = (n) => `${Math.round(Number(n) || 0)}`;

/** A stable accent color for each team, derived from its id. */
export function teamHue(id) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
