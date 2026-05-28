/**
 * A tiny, dependency-free sliding-window rate limiter. Used to blunt brute-force
 * login attempts and general API abuse. In-memory per-process — fine for the
 * single-host event-day deployment; swap for a shared store if ever scaled out.
 */
export class SlidingWindow {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map(); // key -> number[] (timestamps)
  }

  /** Records a hit for `key`. Returns { allowed, remaining, retryAfterMs }. */
  hit(key, now = Date.now()) {
    const cutoff = now - this.windowMs;
    const arr = (this.hits.get(key) || []).filter((t) => t > cutoff);
    if (arr.length >= this.max) {
      const retryAfterMs = Math.max(0, arr[0] + this.windowMs - now);
      this.hits.set(key, arr);
      return { allowed: false, remaining: 0, retryAfterMs };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { allowed: true, remaining: this.max - arr.length, retryAfterMs: 0 };
  }

  /** Periodic cleanup so the map doesn't grow unbounded. */
  sweep(now = Date.now()) {
    const cutoff = now - this.windowMs;
    for (const [key, arr] of this.hits) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
  }
}

/**
 * Express middleware factory. `keyFn` defaults to the client IP. On limit it
 * responds 429 with a Retry-After header.
 */
export function rateLimit({ windowMs, max, message = 'Too many requests, please slow down.', keyFn } = {}) {
  const limiter = new SlidingWindow({ windowMs, max });
  const getKey = keyFn || ((req) => req.ip || req.socket?.remoteAddress || 'unknown');
  const sweepTimer = setInterval(() => limiter.sweep(), windowMs);
  if (sweepTimer.unref) sweepTimer.unref();

  return (req, res, next) => {
    const { allowed, retryAfterMs } = limiter.hit(getKey(req));
    if (!allowed) {
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
