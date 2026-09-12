import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import {
  MAX_LOCAL_HISTORY_TURNS, friendlyError, isRetryable, toHistory, trimFailedExchange
} from './conversation';

/**
 * TrackMate conversation state.
 *
 * History is kept in memory for the session only — nothing is persisted, so there
 * is no stored-conversation surface to secure and no cross-user access to guard.
 * The backend still owns the real context window: it re-validates, re-types and
 * trims whatever history we send, and it alone builds the system prompt.
 *
 * Beyond state, this hook owns two pieces of response handling:
 *   - a progressive reveal of the newest reply, so an answer starts reading
 *     immediately instead of landing as a wall of text
 *   - a retryable record of the last question, so a failed turn does not force
 *     the user to retype
 */

// Reveal pace. Fast enough to never feel like waiting, slow enough to read along.
const REVEAL_CHARS_PER_TICK = 4;
const REVEAL_TICK_MS = 16;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export default function useTrackMate({ enabled }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  // id of the message being revealed, and how much of it is visible so far
  const [reveal, setReveal] = useState({ id: null, chars: 0 });
  const [retryable, setRetryable] = useState(null);

  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  // Mirrors `messages` so a turn can read the thread synchronously. A `setMessages`
  // updater cannot be used for that: React runs it during the render phase, which is
  // after the request has already been sent.
  const messagesRef = useRef([]);
  const revealTimerRef = useRef(null);

  /** Single writer for both the ref and the state, so they can never diverge. */
  const appendMessage = useCallback((message) => {
    messagesRef.current = [...messagesRef.current, message];
    setMessages(messagesRef.current);
  }, []);

  const stopReveal = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  /** Show the whole of the message currently revealing. */
  const finishReveal = useCallback(() => {
    stopReveal();
    setReveal({ id: null, chars: 0 });
  }, [stopReveal]);

  const startReveal = useCallback(
    (id, length) => {
      stopReveal();
      if (prefersReducedMotion() || length <= 80) {
        setReveal({ id: null, chars: 0 });
        return;
      }
      setReveal({ id, chars: 0 });
      revealTimerRef.current = setInterval(() => {
        setReveal((current) => {
          if (current.id !== id) return current;
          const next = current.chars + REVEAL_CHARS_PER_TICK;
          if (next >= length) {
            stopReveal();
            return { id: null, chars: 0 };
          }
          return { id, chars: next };
        });
      }, REVEAL_TICK_MS);
    },
    [stopReveal]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopReveal();
    };
  }, [stopReveal]);

  // Welcome payload and quick actions are role-aware and fetched once per open.
  useEffect(() => {
    if (!enabled || session) return;
    let cancelled = false;

    api
      .get('/ai/session')
      .then((res) => {
        if (!cancelled) setSession(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyError(err));
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, session]);

  const send = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim();
      if (!text || pendingRef.current) return;

      pendingRef.current = true;
      setPending(true);
      setError(null);
      setRetryable(null);
      finishReveal();

      // Snapshot the thread as it stands *before* this turn is appended, so the new
      // message is not echoed back to itself as history.
      const history = toHistory(messagesRef.current, MAX_LOCAL_HISTORY_TURNS);

      appendMessage({ id: `u-${Date.now()}`, role: 'user', text });

      try {
        const res = await api.post('/ai/chat', { message: text, history });
        if (!mountedRef.current) return;
        const reply = res.data?.reply || '';
        const id = `a-${Date.now()}`;
        appendMessage({
          id,
          role: 'assistant',
          text: reply,
          groundedOn: res.data?.meta?.groundedOn || [],
          truncated: Boolean(res.data?.meta?.truncated),
          followUps: Array.isArray(res.data?.meta?.followUps) ? res.data.meta.followUps : []
        });
        startReveal(id, reply.length);
      } catch (err) {
        if (!mountedRef.current) return;
        const message = friendlyError(err);
        setError(message);
        if (isRetryable(err)) setRetryable(text);
        appendMessage({ id: `e-${Date.now()}`, role: 'assistant', text: message, isError: true });
      } finally {
        pendingRef.current = false;
        if (mountedRef.current) setPending(false);
      }
    },
    [appendMessage, finishReveal, startReveal]
  );

  /**
   * Re-ask the last question that failed. The failed exchange is dropped first so
   * the thread reads as one clean attempt rather than a pile of errors.
   */
  const retry = useCallback(() => {
    const question = retryable;
    if (!question || pendingRef.current) return;

    messagesRef.current = trimFailedExchange(messagesRef.current);
    setMessages(messagesRef.current);
    setRetryable(null);

    send(question);
  }, [retryable, send]);

  const reset = useCallback(() => {
    finishReveal();
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setRetryable(null);
  }, [finishReveal]);

  return {
    session,
    messages,
    pending,
    error,
    retryable,
    reveal,
    send,
    retry,
    reset,
    finishReveal,
    available: session ? session.available !== false : true,
    maxMessageChars: session?.limits?.maxMessageChars || 2000
  };
}
