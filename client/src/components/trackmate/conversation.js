/**
 * Pure conversation rules for TrackMate.
 *
 * Kept free of React so the decisions that matter — what history the server is sent,
 * what a failure means, what a retry does to the thread — are plain functions that
 * can be reasoned about and tested on their own. `useTrackMate` owns the React state
 * and calls into these.
 */

/** Turns kept locally; the server re-trims whatever it receives regardless. */
export const MAX_LOCAL_HISTORY_TURNS = 8;

/**
 * Build the history payload from the thread as it stands.
 *
 * Error bubbles are excluded deliberately: an error is UI we generated, not something
 * the assistant said, and feeding it back would teach the model to apologise for
 * failures it never had.
 */
export function toHistory(messages, maxTurns = MAX_LOCAL_HISTORY_TURNS) {
  return messages
    .filter((m) => !m.isError && typeof m.text === 'string' && m.text.trim())
    .slice(-maxTurns * 2)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
}

/**
 * Drop a failed exchange (the error bubble and the user turn that caused it) so a
 * retry reads as one clean attempt instead of stacking up failures.
 */
export function trimFailedExchange(messages) {
  let cut = messages.length;
  if (cut && messages[cut - 1].isError) cut -= 1;
  if (cut && messages[cut - 1].role === 'user') cut -= 1;
  return messages.slice(0, cut);
}

/** Map a request failure to something the user can act on. */
export function friendlyError(err) {
  if (!err?.response) {
    return "Couldn't reach TrackMate. Check your connection and try again.";
  }
  const { status, data } = err.response;
  if (status === 401) return 'Your session has expired. Please sign in again to use TrackMate.';
  if (status === 429) return data?.error || "You're sending messages too quickly. Please wait a moment.";
  if (status === 413) return data?.error || 'That message is too long. Please shorten it and try again.';
  return data?.error || 'TrackMate is temporarily unavailable. Please try again.';
}

/**
 * Whether re-sending the same question unchanged could plausibly succeed.
 * A rate limit needs waiting, an expired session needs signing in, and an oversized
 * message needs editing — offering "try again" for those would just fail again.
 */
export function isRetryable(err) {
  if (!err?.response) return true; // network / timeout
  const { status } = err.response;
  return status !== 401 && status !== 413 && status !== 429;
}
