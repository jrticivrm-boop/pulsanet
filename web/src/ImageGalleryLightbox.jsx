import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchMediaBlobUrl } from './api';
import {
  copyImageFromObjectUrl,
  downloadFromObjectUrl,
  friendlyMediaName,
  isImageMessage,
} from './chatMediaActions';
import { esMsg } from './esMsg';

/**
 * Lightbox con swipe / flechas entre imágenes del chat (estilo WhatsApp).
 * Acciones: copiar / descargar (toolbar + clic derecho).
 */
export default function ImageGalleryLightbox({ token, items, index, onClose }) {
  const [i, setI] = useState(index);
  const [urls, setUrls] = useState({});
  const [err, setErr] = useState({});
  const [hint, setHint] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y }
  const [busy, setBusy] = useState(false);
  const touchX = useRef(null);
  const inFlight = useRef(new Set());
  const urlsRef = useRef({});
  const hintTimer = useRef(null);

  const safeItems = useMemo(
    () => (Array.isArray(items) ? items.filter((m) => m?.mediaUrl && isImageMessage(m)) : []),
    [items]
  );

  const itemKey = (m) => String(m?.id || m?.mediaUrl || '');

  function showHint(msg) {
    setHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 2200);
  }

  useEffect(() => {
    setI(Math.max(0, Math.min(index, Math.max(0, safeItems.length - 1))));
  }, [index, safeItems.length]);

  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  const loadSig = useMemo(
    () => safeItems.map((m) => `${itemKey(m)}:${m.mediaUrl}`).join('|'),
    [safeItems]
  );

  useEffect(() => {
    if (!token || !safeItems.length) return undefined;
    let cancelled = false;
    const claimed = [];

    const toLoad = [i - 1, i, i + 1].filter((n) => n >= 0 && n < safeItems.length);
    toLoad.forEach((n) => {
      const m = safeItems[n];
      const key = itemKey(m);
      if (!m?.mediaUrl || !key) return;
      if (urlsRef.current[key] || inFlight.current.has(key)) return;
      inFlight.current.add(key);
      claimed.push(key);
      fetchMediaBlobUrl(token, m.mediaUrl)
        .then((u) => {
          if (cancelled) {
            URL.revokeObjectURL(u);
            inFlight.current.delete(key);
            return;
          }
          setUrls((prev) => {
            if (prev[key]) {
              URL.revokeObjectURL(u);
              return prev;
            }
            return { ...prev, [key]: u };
          });
        })
        .catch((e) => {
          inFlight.current.delete(key);
          if (!cancelled) {
            setErr((prev) => ({
              ...prev,
              [key]: esMsg(e.message || e, 'No se pudo cargar la imagen'),
            }));
          }
        });
    });

    return () => {
      cancelled = true;
      claimed.forEach((k) => {
        if (!urlsRef.current[k]) inFlight.current.delete(k);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadSig, i]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (ctxMenu) {
          setCtxMenu(null);
          return;
        }
        onClose?.();
      }
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
      if (e.key === 'ArrowRight') setI((v) => Math.min(safeItems.length - 1, v + 1));
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose, safeItems.length, ctxMenu]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      Object.values(urlsRef.current).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
    };
  }, []);

  if (!safeItems.length) return null;
  const cur = safeItems[i] || safeItems[0];
  const key = itemKey(cur);
  const url = urls[key];
  const error = err[key];
  const name = friendlyMediaName(cur);

  function go(delta) {
    setCtxMenu(null);
    setI((v) => Math.max(0, Math.min(safeItems.length - 1, v + delta)));
  }

  function retry() {
    if (!cur?.mediaUrl || !key) return;
    setErr((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setUrls((prev) => {
      const next = { ...prev };
      if (next[key]) {
        try {
          URL.revokeObjectURL(next[key]);
        } catch {
          /* ignore */
        }
        delete next[key];
      }
      return next;
    });
    inFlight.current.delete(key);
    inFlight.current.add(key);
    fetchMediaBlobUrl(token, cur.mediaUrl)
      .then((u) => setUrls((prev) => ({ ...prev, [key]: u })))
      .catch((e) => {
        inFlight.current.delete(key);
        setErr((prev) => ({
          ...prev,
          [key]: esMsg(e.message || e, 'No se pudo cargar la imagen'),
        }));
      });
  }

  async function copyImage() {
    if (!url || busy) return;
    setBusy(true);
    setCtxMenu(null);
    try {
      const ok = await copyImageFromObjectUrl(url);
      showHint(ok ? 'Imagen copiada' : 'No se pudo copiar la imagen');
    } catch {
      showHint('No se pudo copiar la imagen');
    } finally {
      setBusy(false);
    }
  }

  async function downloadImage() {
    if (!url || busy) return;
    setBusy(true);
    setCtxMenu(null);
    try {
      await downloadFromObjectUrl(url, name || 'Img.jpg');
      showHint('Descarga iniciada');
    } catch {
      showHint('No se pudo descargar');
    } finally {
      setBusy(false);
    }
  }

  function openCtx(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!url) return;
    const pad = 8;
    const mw = 180;
    const mh = 96;
    let x = e.clientX;
    let y = e.clientY;
    if (x + mw > window.innerWidth - pad) x = window.innerWidth - mw - pad;
    if (y + mh > window.innerHeight - pad) y = window.innerHeight - mh - pad;
    setCtxMenu({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }

  return (
    <div
      className="wa-lightbox wa-lightbox-gallery"
      role="dialog"
      aria-modal="true"
      aria-label="Galería de imágenes"
      data-esc-close=""
      onClick={() => {
        setCtxMenu(null);
        onClose?.();
      }}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches?.[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches?.[0]?.clientX;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 50) return;
        if (dx < 0) go(1);
        else go(-1);
      }}
    >
      <div className="wa-lightbox-topbar" onClick={(e) => e.stopPropagation()}>
        <div className="wa-lightbox-toolbar">
          <button type="button" disabled={!url || busy} onClick={copyImage} title="Copiar imagen">
            Copiar
          </button>
          <button type="button" disabled={!url || busy} onClick={downloadImage} title="Descargar">
            Descargar
          </button>
        </div>
        <button
          type="button"
          className="wa-lightbox-close"
          aria-label="Cerrar"
          data-esc-close-btn=""
          title="Cerrar (Esc)"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {safeItems.length > 1 && (
        <p className="wa-lightbox-counter" aria-live="polite">
          {i + 1} / {safeItems.length}
        </p>
      )}
      {safeItems.length > 1 && (
        <>
          <button
            type="button"
            className="wa-lightbox-nav prev"
            aria-label="Anterior"
            disabled={i <= 0}
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="wa-lightbox-nav next"
            aria-label="Siguiente"
            disabled={i >= safeItems.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            ›
          </button>
        </>
      )}
      <div className="wa-lightbox-stage" onClick={(e) => e.stopPropagation()} onContextMenu={openCtx}>
        {error ? (
          <div className="wa-lightbox-error">
            <p className="muted">{error}</p>
            <button type="button" className="btn primary" onClick={retry}>
              Reintentar
            </button>
          </div>
        ) : !url ? (
          <p className="muted">Cargando imagen…</p>
        ) : (
          <img
            src={url}
            alt={name || 'imagen'}
            className="wa-lightbox-img"
            draggable={false}
            onContextMenu={openCtx}
            onError={() =>
              setErr((prev) => ({
                ...prev,
                [key]: 'No se pudo mostrar la imagen',
              }))
            }
          />
        )}
      </div>
      {name ? <p className="wa-lightbox-caption">{name}</p> : null}
      {hint ? (
        <p className="wa-lightbox-hint" role="status" aria-live="polite">
          {hint}
        </p>
      ) : null}

      {ctxMenu && (
        <div
          className="wa-context-menu is-floating wa-lightbox-ctx"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button type="button" role="menuitem" disabled={!url || busy} onClick={copyImage}>
            Copiar imagen
          </button>
          <button type="button" role="menuitem" disabled={!url || busy} onClick={downloadImage}>
            Descargar
          </button>
        </div>
      )}
    </div>
  );
}

/** Lista ordenada de mensajes imagen (sin eliminados). */
export function collectImageMessages(messages) {
  return (messages || []).filter((m) => m && !m.isDeleted && m.mediaUrl && isImageMessage(m));
}
