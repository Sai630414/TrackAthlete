/**
 * Google Gemini client — server side only.
 *
 * Implemented against the official Generative Language REST API using Node's built-in
 * global `fetch` (Node 18+; this project runs on Node 26). That keeps the integration
 * on a current, documented interface with no extra runtime dependency and no
 * deprecated SDK, while leaving model, endpoint and timeout env-configurable.
 *
 * The API key is sent in the `x-goog-api-key` header rather than a query string so it
 * cannot end up in a URL that gets logged. It is never returned, never logged, and
 * never placed in a prompt.
 */
const config = require('./config');

/** Typed failure so the controller can map to a user-safe message without leaking detail. */
class GeminiError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.detail = detail;
  }
}

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
];

function classifyHttpError(status, body) {
  const upstreamMessage = body?.error?.message || '';
  if (status === 400 && /api key not valid/i.test(upstreamMessage)) {
    return new GeminiError('AUTH', 'Gemini rejected the API key.', upstreamMessage);
  }
  if (status === 401 || status === 403) {
    return new GeminiError('AUTH', 'Gemini rejected the credentials for this request.', upstreamMessage);
  }
  if (status === 404) {
    return new GeminiError('MODEL_UNAVAILABLE', `Gemini model "${config.model}" is not available.`, upstreamMessage);
  }
  if (status === 429) {
    return new GeminiError('QUOTA', 'Gemini quota or rate limit reached.', upstreamMessage);
  }
  if (status >= 500) {
    return new GeminiError('UPSTREAM', 'Gemini returned a server error.', upstreamMessage);
  }
  return new GeminiError('UPSTREAM', `Gemini request failed with status ${status}.`, upstreamMessage);
}

function extractText(payload) {
  const blockReason = payload?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new GeminiError('SAFETY_BLOCKED', `Prompt blocked by Gemini safety filters (${blockReason}).`);
  }

  const candidate = payload?.candidates?.[0];
  if (!candidate) {
    throw new GeminiError('EMPTY_RESPONSE', 'Gemini returned no candidates.');
  }

  const finishReason = candidate.finishReason;
  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT' || finishReason === 'BLOCKLIST') {
    throw new GeminiError('SAFETY_BLOCKED', `Response blocked by Gemini safety filters (${finishReason}).`);
  }
  if (finishReason === 'RECITATION') {
    throw new GeminiError('SAFETY_BLOCKED', 'Response withheld by Gemini recitation filter.');
  }

  const text = (candidate.content?.parts || [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) {
    // MAX_TOKENS with no text usually means the model spent the budget on reasoning.
    throw new GeminiError(
      'EMPTY_RESPONSE',
      `Gemini returned an empty response${finishReason ? ` (finishReason: ${finishReason})` : ''}.`
    );
  }

  return { text, finishReason: finishReason || null };
}

/**
 * Call Gemini's generateContent endpoint.
 * @param {{ systemInstruction: string, contents: Array }} params
 * @returns {Promise<{ text: string, finishReason: string|null }>}
 */
async function generateContent({ systemInstruction, contents }) {
  if (!config.isConfigured()) {
    throw new GeminiError('NOT_CONFIGURED', 'GEMINI_API_KEY is not set on the server.');
  }

  const url = `${config.apiBaseUrl}/models/${encodeURIComponent(config.model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          temperature: config.temperature,
          topP: config.topP,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: 'text/plain'
        }
      })
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new GeminiError('TIMEOUT', `Gemini did not respond within ${config.requestTimeoutMs}ms.`);
    }
    throw new GeminiError('NETWORK', 'Could not reach the Gemini API.', err?.message);
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) throw new GeminiError('MALFORMED_RESPONSE', 'Gemini returned a non-JSON response.');
  }

  if (!response.ok) {
    throw classifyHttpError(response.status, payload);
  }

  return extractText(payload);
}

module.exports = { generateContent, GeminiError };
