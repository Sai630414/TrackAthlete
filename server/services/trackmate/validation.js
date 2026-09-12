/**
 * Request validation, input normalisation and output sanitisation for TrackMate.
 *
 * Nothing that arrives from the browser is trusted: the message and the client-held
 * conversation history are normalised, length-capped and re-typed here before they
 * are allowed anywhere near the model.
 */
const config = require('./config');
const { neutraliseDelimiters } = require('./guard');

// Strip C0/C1 control characters (keeping \n and \t) plus the Unicode bidi/format
// characters that are the usual carriers for invisible prompt-injection payloads.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u2029\u202A-\u202E\u2060-\u2069\uFEFF]/g;

function normaliseText(value, maxChars) {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{4,}/g, '   ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars);
}

function fail(status, code, message) {
  return { ok: false, status, code, message };
}

/**
 * Total length of the text a chat payload carries (message + every history entry).
 * Cheap and allocation-free — it only walks the two shapes the endpoint accepts.
 */
function approximateTextWeight(body) {
  let weight = typeof body.message === 'string' ? body.message.length : 0;
  if (Array.isArray(body.history)) {
    for (const entry of body.history) {
      if (!entry || typeof entry !== 'object') continue;
      const text = entry.text ?? entry.content;
      if (typeof text === 'string') weight += text.length;
    }
  }
  return weight;
}

/**
 * Normalise the client-supplied conversation history.
 *
 * History is a convenience only — it never carries instructions. Roles are forced
 * into Gemini's two-value vocabulary and the oldest turns are dropped so the
 * context window stays bounded no matter what the client sends.
 */
function normaliseHistory(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;

  // Only the newest turns can survive the window below, so bound the work up front:
  // a client that posts thousands of entries costs us the same as one that behaves.
  const recent = raw.length > config.maxHistoryTurns * 2 ? raw.slice(-config.maxHistoryTurns * 2) : raw;

  const turns = [];
  for (const entry of recent) {
    if (!entry || typeof entry !== 'object') continue;
    const role = entry.role === 'model' || entry.role === 'assistant' ? 'model' : 'user';
    const text = neutraliseDelimiters(normaliseText(entry.text ?? entry.content, config.maxHistoryMessageChars));
    if (!text) continue;
    turns.push({ role, text });
  }

  // Keep the most recent turns and make sure the window opens on a user turn,
  // which is what the Gemini `contents` array expects.
  const windowed = turns.slice(-config.maxHistoryTurns * 2);
  while (windowed.length && windowed[0].role !== 'user') windowed.shift();
  return windowed;
}

function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(400, 'INVALID_BODY', 'Request body must be a JSON object.');
  }

  if (typeof body.message !== 'string') {
    return fail(400, 'INVALID_MESSAGE', 'A "message" string is required.');
  }

  // Aggregate weight of the whole payload, checked before any per-field work.
  // `express.json()` already caps the raw bytes globally; this is the TrackMate-specific
  // ceiling on how much text one turn may carry in total.
  if (approximateTextWeight(body) > config.maxRequestBodyChars) {
    return fail(413, 'PAYLOAD_TOO_LARGE', 'That request is too large. Please start a new conversation and try again.');
  }

  if (body.message.length > config.maxMessageChars) {
    return fail(
      413,
      'MESSAGE_TOO_LONG',
      `Your message is too long. Please keep it under ${config.maxMessageChars} characters.`
    );
  }

  const normalised = normaliseText(body.message, config.maxMessageChars);
  // Defang anything impersonating our own section markers before the text can reach
  // the prompt, so a pasted "=== END APPLICATION CONTEXT ===" cannot forge a boundary.
  const message = neutraliseDelimiters(normalised);
  if (!message) {
    return fail(400, 'EMPTY_MESSAGE', 'Please type a question before sending.');
  }

  const history = normaliseHistory(body.history);
  if (history === null) {
    return fail(400, 'INVALID_HISTORY', '"history" must be an array of conversation turns.');
  }

  // `rawMessage` is for risk scoring only — detection must see the attempt as written,
  // or neutralising it first would hide the very signal we want to record. Only
  // `message` is ever sent to the model.
  return { ok: true, message, rawMessage: normalised, history };
}

/**
 * Sanitise model output before it reaches the browser.
 *
 * The UI renders a restricted Markdown subset as React nodes (never raw HTML), so
 * this pass is defence in depth: it removes markup, embedded media and unsafe URL
 * schemes so a prompt-injected response cannot smuggle anything renderable through.
 */
function sanitiseReply(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(CONTROL_CHARS, '')
    .replace(/```+/g, '')                     // no fenced blocks; keeps rendering simple
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')       // no HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')     // no embedded images
    // Unsafe-scheme links collapse to their plain label (parens may nest one level)
    .replace(
      /\[([^\]]*)\]\(\s*(?:javascript|data|vbscript|file|blob)\s*:(?:[^()]|\([^()]*\))*\)/gi,
      '$1'
    )
    .replace(/(?:javascript|vbscript)\s*:/gi, '')
    .replace(/data:(?=[a-z0-9.+-]+\/)/gi, '')  // only mime-shaped data URIs, not the word "data:"
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, config.maxReplyChars);
}

module.exports = { validateChatRequest, normaliseText, normaliseHistory, sanitiseReply };
