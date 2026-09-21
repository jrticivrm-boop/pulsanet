import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** Class on <html> while a map page is viewport-maximized (CSS + body lock). */
export const MAP_VIEWPORT_MAX_CLASS = 'map-viewport-max';

function requestElFullscreen(el) {
  if (!el || typeof document === 'undefined') return Promise.resolve();
  if (document.fullscreenElement === el) return Promise.resolve();
  const req =
    el.requestFullscreen?.bind(el) ||
    el.webkitRequestFullscreen?.bind(el) ||
    el.msRequestFullscreen?.bind(el);
  if (!req) return Promise.resolve();
  try {
    const out = req.call(el);
    return out && typeof out.then === 'function' ? out : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

function exitDocFullscreen() {
  if (typeof document === 'undefined' || !document.fullscreenElement) return Promise.resolve();
  const exit =
    document.exitFullscreen?.bind(document) ||
    document.webkitExitFullscreen?.bind(document) ||
    document.msExitFullscreen?.bind(document);
  if (!exit) return Promise.resolve();
  try {
    const out = exit();
    return out && typeof out.then === 'function' ? out : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

/** Leaflet freeze mitigation after Fullscreen API enter/exit. */
export function invalidateLeafletUnder(el) {
  if (typeof window === 'undefined') return;
  const fire = () => {
    try {
      window.dispatchEvent(new Event('resize'));
    } catch {
      /* ignore */
    }
  };
  fire();
  // Staggered passes: browser chrome hide/show + layout settle (~1–2s freeze risk).
  [50, 120, 250, 450].forEach((ms) => window.setTimeout(fire, ms));
}

/**
 * Escape shell clipping + true OS/browser fullscreen (F11-like).
 *
 * 1) Reparent page node under document.body (same DOM node → no Leaflet remount)
 * 2) html.map-viewport-max for full-bleed CSS inside the fullscreen element
 * 3) element.requestFullscreen() so Edge tabs/address bar + Windows taskbar hide
 *
 * Note: after reparent, React 17+ synthetic events on the page no longer reach
 * #root. Controls that must work maximized (ops Ocultar/Mostrar, etc.) need
 * native listeners on the page node, a createPortal into the page, or both.
 *
 * Call enterMaximize from a click handler (user activation required for Fullscreen API).
 */
export function useMapViewportMaximize(pageRef, maximized, setMaximized) {
  const homeRef = useRef({ parent: null, next: null });
  const skipFsExitSyncRef = useRef(false);

  const restoreHome = useCallback((el) => {
    const { parent, next } = homeRef.current;
    if (!parent || !el?.isConnected) {
      homeRef.current = { parent: null, next: null };
      return;
    }
    if (el.parentElement === document.body || el.parentElement !== parent) {
      try {
        parent.insertBefore(el, next && next.parentNode === parent ? next : null);
      } catch {
        /* parent may be unmounting */
      }
    }
    homeRef.current = { parent: null, next: null };
  }, []);

  const applyEnterDom = useCallback((el) => {
    if (!el) return;
    if (el.parentElement !== document.body) {
      homeRef.current = { parent: el.parentElement, next: el.nextSibling };
      document.body.appendChild(el);
    }
    document.documentElement.classList.add(MAP_VIEWPORT_MAX_CLASS);
    try {
      el.dataset.mapViewportMax = '1';
    } catch {
      /* ignore */
    }
  }, []);

  const applyExitDom = useCallback(
    (el) => {
      document.documentElement.classList.remove(MAP_VIEWPORT_MAX_CLASS);
      try {
        if (el?.dataset) delete el.dataset.mapViewportMax;
      } catch {
        /* ignore */
      }
      restoreHome(el);
    },
    [restoreHome]
  );

  const enterMaximize = useCallback(() => {
    const el = pageRef.current;
    if (!el) {
      setMaximized(true);
      return;
    }
    // Sync reparent before requestFullscreen so FS root is the map page on body
    // (portals / PTT resolve via document.fullscreenElement).
    applyEnterDom(el);
    setMaximized(true);
    requestElFullscreen(el).finally(() => invalidateLeafletUnder(el));
  }, [pageRef, setMaximized, applyEnterDom]);

  const exitMaximize = useCallback(() => {
    const el = pageRef.current;
    skipFsExitSyncRef.current = true;
    setMaximized(false);
    applyExitDom(el);
    exitDocFullscreen()
      .catch(() => {})
      .finally(() => {
        skipFsExitSyncRef.current = false;
        invalidateLeafletUnder(el);
      });
  }, [pageRef, setMaximized, applyExitDom]);

  const toggleMaximize = useCallback(() => {
    if (maximized) exitMaximize();
    else enterMaximize();
  }, [maximized, enterMaximize, exitMaximize]);

  // Keep DOM + class in sync when maximized flips (Esc / external FS / Restaurar).
  // Cleanup only on unmount — intermediate cleanups must not undo enterMaximize's
  // sync reparent before requestFullscreen settles.
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return undefined;

    if (maximized) {
      applyEnterDom(el);
      invalidateLeafletUnder(el);
    } else {
      applyExitDom(el);
      invalidateLeafletUnder(el);
    }

    return undefined;
  }, [maximized, pageRef, applyEnterDom, applyExitDom]);

  useEffect(() => {
    return () => {
      const el = pageRef.current;
      document.documentElement.classList.remove(MAP_VIEWPORT_MAX_CLASS);
      restoreHome(el);
      try {
        if (el?.dataset) delete el.dataset.mapViewportMax;
      } catch {
        /* ignore */
      }
      if (document.fullscreenElement) {
        exitDocFullscreen().catch(() => {});
      }
    };
  }, [pageRef, restoreHome]);

  // Esc / browser UI exit → sync React state + restore home.
  useEffect(() => {
    const onFs = () => {
      invalidateLeafletUnder(pageRef.current);
      if (document.fullscreenElement) return;
      if (skipFsExitSyncRef.current) return;
      setMaximized(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, [pageRef, setMaximized]);

  return { enterMaximize, exitMaximize, toggleMaximize };
}
