/**
 * TrackMate controller — the one place a Gemini-backed reply is produced.
 *
 * Request path: authenticate -> rate limit (route level) -> validate -> retrieve
 * sanitised context -> build server-owned prompt -> call Gemini -> sanitise output.
 *
 * Errors never surface upstream detail to the browser: each failure maps to a typed
 * code plus a friendly message, and the diagnostic is logged server-side only.
 */
const config = require('../services/trackmate/config');
const { validateChatRequest, sanitiseReply } = require('../services/trackmate/validation');
const { buildContext } = require('../services/trackmate/context');
const { buildSystemInstruction, buildContents } = require('../services/trackmate/prompt');
const { generateContent, GeminiError } = require('../services/trackmate/gemini');
const { getWelcome } = require('../services/trackmate/welcome');
const { suggestFollowUps } = require('../services/trackmate/followups');
const { assessRisk, scanReply } = require('../services/trackmate/guard');

const UNAVAILABLE = 'TrackMate is temporarily unavailable. Please try again in a moment.';

/** Maps an internal failure code to a status + user-facing message. Never leaks detail. */
const FAILURE_RESPONSES = {
  NOT_CONFIGURED: { status: 503, message: 'TrackMate is not configured on this server yet.' },
  TIMEOUT: { status: 504, message: 'TrackMate took too long to respond. Please try again.' },
  NETWORK: { status: 503, message: UNAVAILABLE },
  AUTH: { status: 503, message: UNAVAILABLE },
  QUOTA: { status: 503, message: 'TrackMate is busy right now. Please try again in a few minutes.' },
  MODEL_UNAVAILABLE: { status: 503, message: UNAVAILABLE },
  UPSTREAM: { status: 502, message: UNAVAILABLE },
  MALFORMED_RESPONSE: { status: 502, message: UNAVAILABLE },
  EMPTY_RESPONSE: { status: 502, message: "TrackMate couldn't produce an answer for that. Try rephrasing your question." },
  SAFETY_BLOCKED: {
    status: 200,
    reply:
      "I'm not able to answer that one. If it's about an injury, symptom or anything medical, " +
      'please speak to a qualified medical professional — and seek urgent care straight away if ' +
      "it's serious. Otherwise, ask me about sports pathways, coaches, academies, tournaments or " +
      'your TrackAthlete recommendations and I will help.'
  }
};

/**
 * GET /api/ai/session
 * Role-aware welcome payload for the chat panel. Cheap, no model call.
 */
function getSession(req, res) {
  res.json({
    available: config.isConfigured(),
    limits: {
      maxMessageChars: config.maxMessageChars,
      maxHistoryTurns: config.maxHistoryTurns
    },
    ...getWelcome(req.auth?.role || null)
  });
}

/**
 * POST /api/ai/chat
 * Body: { message: string, history?: Array<{ role: 'user'|'model', text: string }> }
 */
async function chat(req, res) {
  const validation = validateChatRequest(req.body);
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.message, code: validation.code });
  }

  if (!config.isConfigured()) {
    console.error('[TrackMate] GEMINI_API_KEY is not configured; refusing chat request.');
    const failure = FAILURE_RESPONSES.NOT_CONFIGURED;
    return res.status(failure.status).json({ error: failure.message, code: 'NOT_CONFIGURED' });
  }

  const { message, rawMessage, history } = validation;
  const startedAt = Date.now();

  // Advisory only — the structural separation in prompt.js is the real defence. A high
  // score adds one hardening sentence to this turn and a log line worth reviewing.
  // Scored on the message as written, before delimiter neutralisation, so the log
  // records the attempt rather than the defanged remains of it.
  const risk = assessRisk(rawMessage || message);

  try {
    const context = await buildContext(req.auth, message);
    const systemInstruction = buildSystemInstruction(context, risk);
    const contents = buildContents(history, message);

    const { text, finishReason } = await generateContent({ systemInstruction, contents });
    const reply = sanitiseReply(text);

    if (!reply) {
      throw new GeminiError('EMPTY_RESPONSE', 'Reply was empty after sanitisation.');
    }

    // Output tripwire: the canary appearing means the instructions leaked, and a
    // credential shape means something escaped that never should have. Either way the
    // reply is dropped rather than sent, and the incident is logged.
    const scan = scanReply(reply);
    if (!scan.safe) {
      console.error(
        `[TrackMate] BLOCKED reply role=${context?.viewer?.role || 'unknown'} ` +
          `reason=${scan.reason} riskLevel=${risk.level} signals=[${risk.signals.join(',')}]`
      );
      return res.status(200).json({
        reply:
          "I can't share that. Ask me about sports pathways, coaches, academies, " +
          'tournaments or your TrackAthlete recommendations and I will help.',
        meta: { groundedOn: [], filtered: true, followUps: [] }
      });
    }

    // Diagnostics only: no message content, no context, no secrets.
    console.log(
      `[TrackMate] reply ok role=${context?.viewer?.role || 'unknown'} ` +
        `datasets=[${(context?.datasetsQueried || []).join(',')}] ` +
        `risk=${risk.level}${risk.signals.length ? `[${risk.signals.join(',')}]` : ''} ` +
        `chars=${reply.length} ms=${Date.now() - startedAt}`
    );

    return res.json({
      reply,
      meta: {
        groundedOn: context?.datasetsQueried || [],
        truncated: finishReason === 'MAX_TOKENS',
        // Derived from the data this turn actually used, not from the model.
        followUps: suggestFollowUps({
          role: context?.viewer?.role || req.auth?.role || null,
          message,
          retrievedData: context?.retrievedData || {}
        })
      }
    });
  } catch (err) {
    const code = err instanceof GeminiError ? err.code : 'UNEXPECTED';
    console.error(
      `[TrackMate] chat failed code=${code} risk=${risk.level} ` +
        `ms=${Date.now() - startedAt}: ${err.message}`
    );

    const failure = FAILURE_RESPONSES[code];
    if (failure?.reply) {
      return res.status(failure.status).json({ reply: failure.reply, meta: { groundedOn: [], filtered: true } });
    }
    return res
      .status(failure?.status || 500)
      .json({ error: failure?.message || UNAVAILABLE, code });
  }
}

module.exports = { chat, getSession };
