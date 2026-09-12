/**
 * TrackMate AI assistant routes.
 *
 * Mounted at /api/ai — deliberately separate from /api/chat, which is the existing
 * human coach-athlete messaging API and is not touched by this feature.
 *
 * Every route here requires a valid JWT. The rate limiter meters the authenticated
 * user id (falling back to the client IP only if a request somehow arrives without
 * one), so one user cannot spend another user's budget.
 */
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { createRateLimiter, createConcurrencyLimiter } = require('../middleware/rateLimit');
const config = require('../services/trackmate/config');
const ctrl = require('../controllers/ai.controller');

// 1. Per-account budget: a burst window plus an hourly ceiling.
const perUserRateLimit = createRateLimiter({
  windows: [
    { windowMs: config.rateLimit.shortWindowMs, max: config.rateLimit.shortWindowMax },
    { windowMs: config.rateLimit.longWindowMs, max: config.rateLimit.longWindowMax }
  ],
  keyGenerator: (req) => req.auth?.id || `ip:${req.ip}`,
  onLimited: (_req, res, { retryAfterSec }) =>
    res.status(429).json({
      error: "You're sending messages too quickly. Please wait a moment and try again.",
      code: 'RATE_LIMITED',
      retryAfterSeconds: retryAfterSec
    })
});

// 2. Per-source budget: one person cycling through several accounts still shares an IP.
//    Deliberately wider than one user's budget so a shared network is not punished.
const perIpRateLimit = createRateLimiter({
  windows: [{ windowMs: config.rateLimit.ipWindowMs, max: config.rateLimit.ipWindowMax }],
  keyGenerator: (req) => `ip:${req.ip}`,
  setHeaders: false, // the per-user headers are the ones a client should pace against
  onLimited: (_req, res, { retryAfterSec }) =>
    res.status(429).json({
      error: 'Too many requests from this network right now. Please try again shortly.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: retryAfterSec
    })
});

// 3. In-flight caps: the control that actually protects the shared Gemini quota.
const chatConcurrency = createConcurrencyLimiter({
  perKey: config.concurrency.perUser,
  global: config.concurrency.global,
  keyGenerator: (req) => req.auth?.id || `ip:${req.ip}`,
  onBusy: (_req, res, { scope }) =>
    scope === 'user'
      ? res.status(429).json({
          error: 'Still working on your previous message — one at a time, please.',
          code: 'REQUEST_IN_FLIGHT'
        })
      : res.status(503).json({
          error: 'TrackMate is handling a lot of requests right now. Please try again in a moment.',
          code: 'BUSY',
          retryAfterSeconds: 5
        })
});

// GET /api/ai/session — role-aware welcome + quick actions (no model call)
router.get('/session', requireAuth, ctrl.getSession);

// POST /api/ai/chat — one TrackMate turn.
// Order matters: authenticate first so limits meter a real identity, then the cheap
// window checks, and only then claim an in-flight slot.
router.post('/chat', requireAuth, perIpRateLimit, perUserRateLimit, chatConcurrency, ctrl.chat);

module.exports = router;
