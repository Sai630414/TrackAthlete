/**
 * TrackMate configuration.
 *
 * Every limit is env-overridable so the AI endpoint can be tuned per environment
 * without a code change. The Gemini API key is read here and nowhere else on the
 * request path — it is never placed in a prompt, a log line, or a response body.
 */

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  // --- Gemini ---
  apiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
  apiBaseUrl: process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  requestTimeoutMs: positiveInt(process.env.TRACKMATE_TIMEOUT_MS, 25000),

  // --- Generation (backend-owned; the browser can never influence these) ---
  temperature: 0.35,
  topP: 0.9,
  maxOutputTokens: positiveInt(process.env.TRACKMATE_MAX_OUTPUT_TOKENS, 1500),

  // --- Input limits ---
  maxMessageChars: positiveInt(process.env.TRACKMATE_MAX_MESSAGE_CHARS, 2000),
  maxHistoryTurns: positiveInt(process.env.TRACKMATE_MAX_HISTORY_TURNS, 8),
  maxHistoryMessageChars: positiveInt(process.env.TRACKMATE_MAX_HISTORY_MESSAGE_CHARS, 1200),
  maxRequestBodyChars: positiveInt(process.env.TRACKMATE_MAX_BODY_CHARS, 24000),

  // --- Output limits ---
  maxReplyChars: positiveInt(process.env.TRACKMATE_MAX_REPLY_CHARS, 4000),

  // --- Rate limiting ---
  // Layered on purpose: per-user windows meter one account, the per-IP window catches
  // one person spread across several accounts, and the concurrency caps stop any single
  // caller from holding the shared Gemini quota open.
  rateLimit: {
    shortWindowMs: positiveInt(process.env.TRACKMATE_RATE_SHORT_WINDOW_MS, 60000),
    shortWindowMax: positiveInt(process.env.TRACKMATE_RATE_SHORT_MAX, 10),
    longWindowMs: positiveInt(process.env.TRACKMATE_RATE_LONG_WINDOW_MS, 3600000),
    longWindowMax: positiveInt(process.env.TRACKMATE_RATE_LONG_MAX, 120),
    // Wider than one user's budget: shared networks (a school, an academy) are normal.
    ipWindowMs: positiveInt(process.env.TRACKMATE_RATE_IP_WINDOW_MS, 60000),
    ipWindowMax: positiveInt(process.env.TRACKMATE_RATE_IP_MAX, 40)
  },

  // --- Concurrency (in-flight requests, not requests per minute) ---
  concurrency: {
    perUser: positiveInt(process.env.TRACKMATE_MAX_INFLIGHT_PER_USER, 2),
    global: positiveInt(process.env.TRACKMATE_MAX_INFLIGHT_TOTAL, 8)
  },

  // --- Context retrieval limits ---
  maxItemsPerDataset: positiveInt(process.env.TRACKMATE_MAX_ITEMS_PER_DATASET, 5),
  recommendationRadiusKm: positiveInt(process.env.TRACKMATE_RECOMMEND_RADIUS_KM, 300),
  recommendationCacheTtlMs: positiveInt(process.env.TRACKMATE_RECOMMEND_CACHE_TTL_MS, 600000)
};

config.isConfigured = () => Boolean(config.apiKey);

module.exports = config;
