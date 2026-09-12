import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, BadgeCheck, ChartNoAxesColumn, Check, Compass, Copy, Handshake,
  Landmark, NotebookPen, Route, RotateCcw, Send, Sparkles, Trophy, UsersRound, X
} from 'lucide-react';
import MessageContent from './MessageContent';
import trackmateMark from '../../assets/trackmate-mark.png';

/**
 * The TrackMate conversation panel.
 *
 * Desktop: a compact docked panel in the bottom-right corner.
 * Mobile:  a bottom sheet (see trackmate.css) that leaves the top of the page visible.
 *
 * The panel is intentionally non-modal — it does not trap focus or block the page,
 * so the dashboard underneath stays fully usable while it is open.
 *
 * Conversation state is owned by TrackMateLauncher and passed in, so closing and
 * reopening the panel keeps the thread instead of starting over.
 */

/** Semantic icon keys from the server mapped to icons; unknown keys fall back. */
const ACTION_ICONS = {
  route: Route,
  users: UsersRound,
  trophy: Trophy,
  badge: BadgeCheck,
  compass: Compass,
  chart: ChartNoAxesColumn,
  landmark: Landmark,
  handshake: Handshake,
  notes: NotebookPen
};

const DATASET_LABELS = {
  sportRecommendations: 'sport recommendations',
  coachesOnPlatform: 'coach directory',
  academies: 'academy listings',
  saiCentres: 'SAI centre data',
  tournaments: 'tournament data',
  federationStatus: 'federation status',
  sportsQuota: 'sports quota records',
  developmentRoadmap: 'development roadmap',
  myConnections: 'your connections'
};

function groundingLabel(datasets) {
  const labels = datasets.map((d) => DATASET_LABELS[d]).filter(Boolean);
  if (!labels.length) return null;
  const joined =
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Read from TrackAthlete ${joined}`;
}

/** Copy-to-clipboard button that confirms in place, then reverts. */
function CopyReplyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context or denied permission): stay silent
      // rather than showing a failure the user can do nothing about.
    }
  };

  return (
    <button
      type="button"
      className="tm-reply-action"
      onClick={copy}
      aria-label={copied ? 'Answer copied' : 'Copy answer'}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

export default function TrackMatePanel({ trackmate, onClose }) {
  const {
    session, messages, pending, error, retryable, reveal,
    send, retry, reset, finishReveal, available, maxMessageChars
  } = trackmate;
  const [draft, setDraft] = useState('');
  const [atBottom, setAtBottom] = useState(true);

  const textareaRef = useRef(null);
  const threadRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Focus the composer when the panel opens so keyboard users land in the right place.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Escape closes the panel from anywhere inside it.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeRef.current?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Track whether the reader is parked at the bottom. Anything else means they have
  // scrolled up to re-read, and auto-scrolling would yank the text away from them.
  const onThreadScroll = useCallback(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const distance = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    setAtBottom(distance < 48);
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior });
    setAtBottom(true);
  }, []);

  // Follow new content only while the reader is already at the bottom.
  useLayoutEffect(() => {
    if (!atBottom) return;
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, pending, reveal.chars, atBottom]);

  const autoGrow = useCallback((element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 116)}px`;
  }, []);

  const submit = useCallback(
    (text) => {
      const value = String(text ?? draft).trim();
      if (!value || pending) return;
      send(value);
      setDraft('');
      setAtBottom(true);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.focus();
        }
      });
    },
    [draft, pending, send]
  );

  const onKeyDown = (event) => {
    // Enter sends, Shift+Enter inserts a newline — matching the existing chat panel.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const trimmed = draft.trim();
  const canSend = Boolean(trimmed) && !pending;
  const showWelcome = messages.length === 0;
  const nearLimit = draft.length > maxMessageChars * 0.8;

  // Announce only the settled answer, so a screen reader is not read a reply
  // character by character while it reveals.
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);
  const announcement = lastAssistant && reveal.id !== lastAssistant.id ? lastAssistant.text : '';

  return (
    <section className="tm-panel" role="dialog" aria-label="TrackMate, AI sports development companion">
      <header className="tm-header">
        <img className="tm-mark" src={trackmateMark} alt="" aria-hidden="true" />
        <span className="tm-title">
          <b>TrackMate</b>
          <small>AI Sports Development Companion</small>
        </span>
        <span
          className={`tm-status${available ? '' : ' is-offline'}`}
          title={available ? 'Connected and ready' : 'Not configured on the server'}
        >
          <i aria-hidden="true" />
          <em>{available ? 'Ready' : 'Offline'}</em>
        </span>
        {messages.length > 0 && (
          <button type="button" className="tm-icon-btn" onClick={reset} aria-label="Start a new conversation">
            <RotateCcw size={15} />
          </button>
        )}
        <button type="button" className="tm-icon-btn" onClick={onClose} aria-label="Close TrackMate">
          <X size={16} />
        </button>
      </header>

      <div className="tm-thread" ref={threadRef} onScroll={onThreadScroll}>
        {showWelcome && (
          <div className="tm-welcome">
            <h2 className="tm-welcome-headline">
              {session?.headline || 'Where would you like to go next?'}
            </h2>
            <p className="tm-welcome-sub">
              {session?.subline ||
                'I read what TrackAthlete already holds and explain what it means for you.'}
            </p>

            {!available && (
              <div className="tm-notice">
                TrackMate needs a Gemini API key on the server before it can answer. Everything else
                in TrackAthlete works as usual.
              </div>
            )}

            {/* A failure with no thread yet (the session lookup) has nowhere else to show. */}
            {available && error && <div className="tm-notice">{error}</div>}

            {available && session?.quickActions?.length > 0 && (
              <div className="tm-actions">
                {session.quickActions.map((action) => {
                  const Icon = ACTION_ICONS[action.icon] || Compass;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      className="tm-action"
                      disabled={pending}
                      onClick={() => submit(action.prompt)}
                    >
                      <Icon size={15} aria-hidden="true" />
                      <span>
                        <b>{action.label}</b>
                        {action.caption && <small>{action.caption}</small>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === 'user';
          const revealing = reveal.id === message.id;
          const shown = revealing ? message.text.slice(0, reveal.chars) : message.text;
          const settled = !revealing && !message.isError && !isUser;
          const grounding = settled ? groundingLabel(message.groundedOn || []) : null;

          return (
            <div key={message.id} className={`tm-msg${isUser ? ' is-user' : ''}`}>
              <div className={`tm-bubble${message.isError ? ' is-error' : ''}`}>
                {isUser ? message.text : <MessageContent text={shown} />}
                {revealing && <span className="tm-caret" aria-hidden="true" />}
              </div>

              {grounding && (
                <p className="tm-source">
                  <BadgeCheck size={11} aria-hidden="true" />
                  {grounding}
                </p>
              )}

              {message.truncated && settled && (
                <p className="tm-source">That answer was cut short. Ask me to continue it.</p>
              )}

              {settled && message.text.length > 160 && (
                <div className="tm-reply-actions">
                  <CopyReplyButton text={message.text} />
                </div>
              )}

              {/* Suggested next questions, only under the newest answer so older
                  turns do not litter the thread with stale prompts. */}
              {settled && message.id === lastAssistant?.id && !pending && message.followUps?.length > 0 && (
                <div className="tm-followups">
                  <p className="tm-followups-label">
                    <Sparkles size={11} aria-hidden="true" />
                    Ask next
                  </p>
                  <div className="tm-followup-list">
                    {message.followUps.map((f) => (
                      <button
                        key={f.prompt}
                        type="button"
                        className="tm-followup"
                        onClick={() => submit(f.prompt)}
                        title={f.prompt}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {message.isError && retryable && !pending && (
                <div className="tm-reply-actions">
                  <button type="button" className="tm-reply-action is-retry" onClick={retry}>
                    <RotateCcw size={13} />
                    <span>Try again</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {pending && (
          <div className="tm-msg">
            <div className="tm-bubble is-thinking">
              <span className="tm-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Reading TrackAthlete
            </div>
          </div>
        )}

        {reveal.id && (
          <button type="button" className="tm-skip" onClick={finishReveal}>
            Show the whole answer
          </button>
        )}
      </div>

      {!atBottom && (
        <button
          type="button"
          className="tm-jump"
          onClick={() => scrollToBottom()}
          aria-label="Jump to the latest message"
        >
          <ArrowDown size={14} />
        </button>
      )}

      {/* Assistant replies are announced once, politely, after they settle. */}
      <p className="tm-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div className="tm-composer">
        <div className="tm-input-row">
          <label className="tm-sr-only" htmlFor="tm-message">
            Message TrackMate
          </label>
          <textarea
            id="tm-message"
            ref={textareaRef}
            className="tm-textarea"
            rows={1}
            value={draft}
            maxLength={maxMessageChars}
            disabled={!available}
            placeholder={available ? 'Ask about pathways, coaches, tournaments…' : 'TrackMate is offline'}
            onChange={(event) => {
              setDraft(event.target.value);
              autoGrow(event.target);
            }}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="tm-send"
            onClick={() => submit()}
            disabled={!canSend || !available}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
        {/* Failures are reported in the thread (or the welcome notice), never here as
            well — the footnote stays the standing disclaimer so it is never a surprise. */}
        <p className="tm-footnote">
          <span>AI assistant · not a coach, doctor or official</span>
          {nearLimit && (
            <span className="tm-counter is-near">
              {draft.length}/{maxMessageChars}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
