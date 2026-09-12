import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import useTrackMate from './useTrackMate';
import trackmateMark from '../../assets/trackmate-mark.png';
import './trackmate.css';

// The conversation panel (and its Markdown renderer and icon set) is only fetched
// the first time someone opens TrackMate, so the dashboards' initial load is
// unaffected. The conversation *state* lives here rather than in the panel, so
// closing the panel does not throw away the thread.
const TrackMatePanel = lazy(() => import('./TrackMatePanel'));

/**
 * Floating TrackMate entry point.
 *
 * Rendered through a portal to <body> so it cannot inherit or disturb the
 * existing app-shell layout, scroll containers or stacking contexts. It renders
 * nothing at all when no one is signed in — TrackMate is authenticated-only, and
 * the backend enforces that independently.
 */
export default function TrackMateLauncher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef(null);
  const shouldRestoreFocus = useRef(false);

  // `enabled` gates the one-off session fetch until TrackMate is actually opened.
  const trackmate = useTrackMate({ enabled: open });
  const { finishReveal, messages } = trackmate;

  const close = useCallback(() => {
    shouldRestoreFocus.current = true;
    finishReveal(); // don't leave a reveal ticking behind a closed panel
    setOpen(false);
  }, [finishReveal]);

  // Closing the panel unmounts whatever had focus, which would otherwise drop the
  // caret back to the top of the document. Hand focus back to the launcher so a
  // keyboard or screen-reader user stays where they were.
  useEffect(() => {
    if (!open && shouldRestoreFocus.current) {
      shouldRestoreFocus.current = false;
      launcherRef.current?.focus();
    }
  }, [open]);

  if (!user) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="tm-root">
      {open ? (
        <Suspense fallback={null}>
          <TrackMatePanel trackmate={trackmate} onClose={close} />
        </Suspense>
      ) : (
        <button
          type="button"
          ref={launcherRef}
          className="tm-launcher"
          onClick={() => setOpen(true)}
          aria-label={
            messages.length
              ? 'Open TrackMate, your AI sports development companion (conversation in progress)'
              : 'Open TrackMate, your AI sports development companion'
          }
          aria-expanded={false}
        >
          <span className="tm-launcher-pulse" aria-hidden="true" />
          <img className="tm-launcher-mark" src={trackmateMark} alt="" aria-hidden="true" />
          <span className="tm-launcher-label">TrackMate</span>
          {messages.length > 0 && <span className="tm-launcher-dot" aria-hidden="true" />}
        </button>
      )}
    </div>,
    document.body
  );
}
