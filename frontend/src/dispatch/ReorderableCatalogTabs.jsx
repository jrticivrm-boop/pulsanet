import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useIsPhone, useIsCoarsePointer } from '../useMediaQuery.js';

/** Umbral real: evita “drag” por jitter de trackpad/mouse al solo hacer clic. */
const DRAG_THRESHOLD_PX = 8;

function loadOrder(key, defaults) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (!Array.isArray(raw) || !raw.length) return [...defaults];
    const known = new Set(defaults);
    const next = raw.filter((id) => known.has(id));
    for (const id of defaults) {
      if (!next.includes(id)) next.push(id);
    }
    return next;
  } catch {
    return [...defaults];
  }
}

function saveOrder(key, order) {
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function orderTabs(tabs, savedOrder) {
  const byTo = new Map(tabs.map((t) => [t.to, t]));
  const next = [];
  for (const to of savedOrder) {
    const item = byTo.get(to);
    if (item) {
      next.push(item);
      byTo.delete(to);
    }
  }
  for (const item of tabs) {
    if (byTo.has(item.to)) next.push(item);
  }
  return next;
}

function tabIdFromPoint(clientX, clientY, navEl) {
  const el = document.elementFromPoint(clientX, clientY);
  const a = el?.closest?.('a[data-tab-to]');
  if (!a || !navEl?.contains(a)) return null;
  return a.getAttribute('data-tab-to');
}

/**
 * Pestañas de catálogo/admin/config reordenables (pointer DnD + localStorage).
 * Pointer (no HTML5 DnD): en Chrome/Windows el drag nativo pisa el cursor CSS.
 * @param {{ tabs: { to: string, label: string }[], storageKey: string, ariaLabel: string }} props
 */
export default function ReorderableCatalogTabs({ tabs, storageKey, ariaLabel }) {
  const defaults = useMemo(() => tabs.map((t) => t.to), [tabs]);
  const defaultsKey = defaults.join('|');
  const [order, setOrder] = useState(() => loadOrder(storageKey, defaults));
  const [dragTo, setDragTo] = useState(null);
  const [overTo, setOverTo] = useState(null);
  /**
   * Sesión de pointer única (evita listeners apilados y cursor/clase pegados).
   * { id, x, y, moved, pointerId, target, onMove, onUp }
   */
  const sessionRef = useRef(null);
  const suppressClick = useRef(false);
  const navRef = useRef(null);
  const dragToRef = useRef(null);
  const overToRef = useRef(null);
  const isCoarse = useIsCoarsePointer();
  const isPhone = useIsPhone();
  const allowDrag = !isCoarse && !isPhone;

  function setDraggingClass(on) {
    const root = document.documentElement;
    if (on) root.classList.add('cc-catalogs-tabs-dragging');
    else root.classList.remove('cc-catalogs-tabs-dragging');
  }

  function setDragState(nextDrag, nextOver) {
    if (dragToRef.current !== nextDrag) {
      dragToRef.current = nextDrag;
      setDragTo(nextDrag);
      setDraggingClass(!!nextDrag);
    }
    if (overToRef.current !== nextOver) {
      overToRef.current = nextOver;
      setOverTo(nextOver);
    }
  }

  function clearDrag() {
    const sess = sessionRef.current;
    if (sess) {
      if (sess.onMove || sess.onUp) {
        window.removeEventListener('pointermove', sess.onMove, true);
        window.removeEventListener('pointerup', sess.onUp, true);
        window.removeEventListener('pointercancel', sess.onUp, true);
      }
      if (sess.target) {
        try {
          if (sess.target.hasPointerCapture?.(sess.pointerId)) {
            sess.target.releasePointerCapture(sess.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
    }
    sessionRef.current = null;
    setDragState(null, null);
    setDraggingClass(false);
  }

  useEffect(() => {
    setOrder((prev) => {
      const known = new Set(defaults);
      const next = prev.filter((id) => known.has(id));
      for (const id of defaults) {
        if (!next.includes(id)) next.push(id);
      }
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
      return next;
    });
  }, [defaultsKey, defaults]);

  /* Escape / visibilidad / unmount: no dejar cursor ni listeners pegados. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!sessionRef.current && !dragToRef.current) return;
      suppressClick.current = true;
      clearDrag();
    };
    const onVis = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!sessionRef.current && !dragToRef.current) return;
      suppressClick.current = true;
      clearDrag();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      clearDrag();
    };
    // Intencional: solo montaje/desmontaje; clearDrag usa refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reorder(from, to) {
    if (!from || !to || from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(to);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      saveOrder(storageKey, next);
      return next;
    });
  }

  const ordered = orderTabs(tabs, order);

  return (
    <nav ref={navRef} className="cc-catalogs-tabs" aria-label={ariaLabel}>
      {ordered.map((t) => {
        const dragging = dragTo === t.to;
        const over = overTo === t.to && dragTo && overTo !== dragTo;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            data-tab-to={t.to}
            draggable={false}
            className={({ isActive }) =>
              [
                isActive ? 'active' : '',
                allowDrag ? 'is-draggable' : '',
                dragging ? 'is-dragging' : '',
                over ? 'is-drag-over' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onDragStart={(e) => {
              /* Evitar DnD nativo del <a>: pisa el cursor CSS del sistema. */
              e.preventDefault();
            }}
            onClick={(e) => {
              if (suppressClick.current) {
                e.preventDefault();
                e.stopPropagation();
                suppressClick.current = false;
              }
            }}
            onPointerDown={(e) => {
              if (!allowDrag || e.button !== 0) return;
              /* Una sola sesión: si ya hay drag armado, no apilar listeners. */
              if (sessionRef.current) return;

              const target = e.currentTarget;
              const pointerId = e.pointerId;
              const session = {
                id: t.to,
                x: e.clientX,
                y: e.clientY,
                moved: false,
                pointerId,
                target,
                onMove: null,
                onUp: null,
              };
              sessionRef.current = session;

              try {
                target.setPointerCapture?.(pointerId);
              } catch {
                /* ignore */
              }

              const onMove = (ev) => {
                if (ev.pointerId !== pointerId) return;
                const start = sessionRef.current;
                if (!start || start.id !== t.to) return;
                if (!start.moved) {
                  if (
                    Math.abs(ev.clientX - start.x) < DRAG_THRESHOLD_PX &&
                    Math.abs(ev.clientY - start.y) < DRAG_THRESHOLD_PX
                  ) {
                    return;
                  }
                  start.moved = true;
                  /* Clase síncrona: grab solo tras umbral real. */
                  setDragState(t.to, tabIdFromPoint(ev.clientX, ev.clientY, navRef.current));
                  return;
                }
                const hit = tabIdFromPoint(ev.clientX, ev.clientY, navRef.current);
                setDragState(t.to, hit);
              };

              const onUp = (ev) => {
                if (ev.pointerId !== pointerId) return;
                const start = sessionRef.current;
                if (start && start.id === t.to && start.moved) {
                  suppressClick.current = true;
                  const hit = tabIdFromPoint(ev.clientX, ev.clientY, navRef.current);
                  if (hit) reorder(t.to, hit);
                }
                clearDrag();
              };

              session.onMove = onMove;
              session.onUp = onUp;
              window.addEventListener('pointermove', onMove, true);
              window.addEventListener('pointerup', onUp, true);
              window.addEventListener('pointercancel', onUp, true);
            }}
          >
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
