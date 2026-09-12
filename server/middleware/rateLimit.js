/**
 * In-process rate limiting and concurrency control.
 *
 * Written locally rather than pulling in a dependency: the project had no rate
 * limiting today, and what this endpoint needs is a few hundred lines of bookkeeping,
 * not a framework.
 *
 * Three different abuses need three different controls, because a single
 * requests-per-minute number stops none of them cleanly:
 *
 *   1. One account sending too much          -> per-identity sliding windows
 *   2. One person behind many accounts       -> a wider per-IP sliding window
 *   3. One caller holding the upstream open  -> concurrency caps, per user and global
 *
 * (3) is the one a naive limiter misses: ten parallel requests are "ten requests" to a
 * window counter, but they are ten simultaneous Gemini calls — real money, and latency
 * for everyone else. Capping in-flight work is what actually protects the shared quota,
 * so a heavy user degrades their own experience rather than the whole platform's.
 *
 * Scope note: state lives in this process. On a single Node instance that is exactly
 * right; behind several instances each keeps its own counters, so treat the configured
 * numbers as per-instance. Swapping in Redis later means replacing the two Maps below.
 */

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Keeps a timer from holding the process open. */
function unref(timer) {
  if (timer && typeof timer.unref === 'function') timer.unref();
  return timer;
}

/**
 * Sliding-window counter over one or more windows, all enforced.
 *
 * @param {object} options
 * @param {Array<{windowMs:number,max:number,name?:string}>} options.windows
 * @param {(req)=>string|null} options.keyGenerator  identity to meter on; null skips
 * @param {(req,res,info)=>void} [options.onLimited]
 * @param {boolean} [options.setHeaders=true]        emit RateLimit-* headers
 */
function createRateLimiter({ windows, keyGenerator, onLimited, setHeaders = true }) {
  const hits = new Map(); // key -> number[] of timestamps, ascending
  const longestWindowMs = windows.reduce((max, w) => Math.max(max, w.windowMs), 0);

  unref(
    setInterval(() => {
      const cutoff = Date.now() - longestWindowMs;
      for (const [key, stamps] of hits) {
        const kept = stamps.filter((t) => t > cutoff);
        if (kept.length) hits.set(key, kept);
        else hits.delete(key);
      }
    }, SWEEP_INTERVAL_MS)
  );

  return function rateLimit(req, res, next) {
    const key = keyGenerator(req);
    if (!key) return next();

    const now = Date.now();
    const stamps = (hits.get(key) || []).filter((t) => t > now - longestWindowMs);

    // Report on the window closest to exhaustion, so a client pacing itself off the
    // headers respects the tightest constraint rather than the most generous one.
    let tightest = null;
    for (const w of windows) {
      const used = stamps.filter((t) => t > now - w.windowMs).length;
      const remaining = Math.max(0, w.max - used);
      if (!tightest || remaining < tightest.remaining) {
        tightest = { remaining, window: w, used, oldest: stamps.find((t) => t > now - w.windowMs) };
      }
      if (used >= w.max) {
        hits.set(key, stamps);
        const resetSec = Math.max(1, Math.ceil((tightest.oldest + w.windowMs - now) / 1000));
        if (setHeaders) {
          res.set('Retry-After', String(resetSec));
          res.set('RateLimit-Limit', String(w.max));
          res.set('RateLimit-Remaining', '0');
          res.set('RateLimit-Reset', String(resetSec));
        }
        if (onLimited) return onLimited(req, res, { retryAfterSec: resetSec, window: w });
        return res.status(429).json({ error: 'Too many requests. Please slow down.' });
      }
    }

    stamps.push(now);
    hits.set(key, stamps);

    if (setHeaders && tightest) {
      const resetSec = Math.max(
        1,
        Math.ceil(((tightest.oldest || now) + tightest.window.windowMs - now) / 1000)
      );
      res.set('RateLimit-Limit', String(tightest.window.max));
      res.set('RateLimit-Remaining', String(Math.max(0, tightest.remaining - 1)));
      res.set('RateLimit-Reset', String(resetSec));
    }
    return next();
  };
}

/**
 * Caps simultaneous in-flight requests, per identity and across the whole process.
 *
 * This is what stops one caller from occupying the upstream: a user may have `perKey`
 * requests running, and the process may have `global` running, whichever binds first.
 * Slots are released when the response finishes, however it finishes — including
 * client disconnects, which is why it hooks `close` as well as `finish`.
 *
 * @param {object} options
 * @param {number} options.perKey
 * @param {number} options.global
 * @param {(req)=>string|null} options.keyGenerator
 * @param {(req,res,info)=>void} [options.onBusy]
 */
function createConcurrencyLimiter({ perKey, global: globalMax, keyGenerator, onBusy }) {
  const inFlight = new Map(); // key -> count
  let globalInFlight = 0;

  return function concurrency(req, res, next) {
    const key = keyGenerator(req);
    if (!key) return next();

    const mine = inFlight.get(key) || 0;

    if (globalInFlight >= globalMax) {
      if (onBusy) return onBusy(req, res, { scope: 'global' });
      return res.status(503).json({ error: 'Busy right now. Please try again shortly.' });
    }
    if (mine >= perKey) {
      if (onBusy) return onBusy(req, res, { scope: 'user' });
      return res.status(429).json({ error: 'Please wait for your previous message to finish.' });
    }

    inFlight.set(key, mine + 1);
    globalInFlight += 1;

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const left = (inFlight.get(key) || 1) - 1;
      if (left > 0) inFlight.set(key, left);
      else inFlight.delete(key);
      globalInFlight = Math.max(0, globalInFlight - 1);
    };

    res.on('finish', release);
    res.on('close', release); // client hung up mid-answer
    return next();
  };
}

module.exports = { createRateLimiter, createConcurrencyLimiter };
