import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveDropdownPortalHost } from './dropdownPortalHost.js';

const POS_KEY = 'tacticalptx_map_ptt_float_pos';
export const MAP_PTT_MENU_LAYOUT_KEY = 'tacticalptx_map_ptt_menu_layout';
export const MAP_PTT_MENU_LAYOUT_EVENT = 'tacticalptx:map-ptt-menu-layout';
const PANEL_KEY = 'tacticalptx_map_ptt_menu_panel';
const DRAG_THRESHOLD_PX = 8;
const BTN_SIZE = 92;
const EDGE_PAD = 12;

const PANELS = [
  { id: 'listen', label: 'Escuchar' },
  { id: 'talk', label: 'Hablar' },
  { id: 'video', label: 'Video' },
  { id: 'alert', label: 'Alerta' },
];

export function readMapPttMenuLayout() {
  try {
    const v = localStorage.getItem(MAP_PTT_MENU_LAYOUT_KEY);
    if (v === 'tabs' || v === 'select') return v;
  } catch {
    /* ignore */
  }
  return 'tabs';
}

export function writeMapPttMenuLayout(mode) {
  const next = mode === 'select' ? 'select' : 'tabs';
  try {
    localStorage.setItem(MAP_PTT_MENU_LAYOUT_KEY, next);
    window.dispatchEvent(
      new CustomEvent(MAP_PTT_MENU_LAYOUT_EVENT, { detail: { mode: next } })
    );
  } catch {
    /* ignore */
  }
  return next;
}

function readStoredPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
  } catch {
    /* ignore */
  }
  return null;
}

function readActivePanel() {
  try {
    const v = localStorage.getItem(PANEL_KEY);
    if (PANELS.some((p) => p.id === v)) return v;
  } catch {
    /* ignore */
  }
  return 'talk';
}

function writeActivePanel(panel) {
  try {
    localStorage.setItem(PANEL_KEY, panel);
  } catch {
    /* ignore */
  }
}

function clampPos(x, y, hostEl) {
  const w = hostEl?.clientWidth || window.innerWidth;
  const h = hostEl?.clientHeight || window.innerHeight;
  const maxX = Math.max(EDGE_PAD, w - BTN_SIZE - EDGE_PAD);
  const maxY = Math.max(EDGE_PAD, h - BTN_SIZE - EDGE_PAD);
  return {
    x: Math.min(maxX, Math.max(EDGE_PAD, x)),
    y: Math.min(maxY, Math.max(EDGE_PAD, y)),
  };
}

function applyToggle(ids, id, mode) {
  const sid = String(id);
  const set = new Set((ids || []).map(String));
  if (mode === 'individual') {
    return set.has(sid) ? [] : [id];
  }
  if (set.has(sid)) return (ids || []).filter((x) => String(x) !== sid);
  return [...(ids || []), id];
}

/**
 * PTT flotante en mapa maximizado: arrastrable, click = hablar, click derecho = menú canales.
 */
export default function MapPttFloat({
  ptt,
  group,
  groups = [],
  talkIds = [],
  listenIds = [],
  videoIds = [],
  alertIds = [],
  listenMode = 'multiple',
  talkMode = 'individual',
  videoMode = 'individual',
  alertMode = 'individual',
  onTalkIdsChange,
  onListenChange,
  onVideoIdsChange,
  onAlertIdsChange,
  portalHost,
}) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const dragRef = useRef(null);
  const [pos, setPos] = useState(() => readStoredPos());
  const [menu, setMenu] = useState(null); // { x, y } | null
  const [busyPanic, setBusyPanic] = useState(false);
  const [activePanel, setActivePanel] = useState(() => readActivePanel());
  const [menuLayout, setMenuLayout] = useState(() => readMapPttMenuLayout());

  const hostEl =
    portalHost ||
    (typeof document !== 'undefined'
      ? document.querySelector('.lt-page--maximized, .map-page--maximized') ||
        document.fullscreenElement ||
        document.body
      : null);

  const persistPos = useCallback((next) => {
    setPos(next);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!pos || !hostEl) return undefined;
    const onResize = () => {
      setPos((prev) => (prev ? clampPos(prev.x, prev.y, hostEl) : prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos, hostEl]);

  useEffect(() => {
    const sync = (e) => {
      const mode = e?.detail?.mode || readMapPttMenuLayout();
      setMenuLayout(mode === 'select' ? 'select' : 'tabs');
    };
    window.addEventListener(MAP_PTT_MENU_LAYOUT_EVENT, sync);
    return () => window.removeEventListener(MAP_PTT_MENU_LAYOUT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setMenu(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const talkSet = new Set((talkIds || []).map(String));
  const listenSet = new Set((listenIds || []).map(String));
  const videoSet = new Set((videoIds || []).map(String));
  const alertSet = new Set((alertIds || []).map(String));
  const orderedGroups = Array.isArray(groups) ? groups : [];

  const hint =
    talkIds.length > 1
      ? `PTT → ${talkIds.length}`
      : group?.name || orderedGroups.find((g) => talkSet.has(String(g.id)))?.name || 'Sin canal';

  const canTalk = Boolean(group || talkIds.length) && Boolean(ptt?.livekitReady);
  const holding = Boolean(ptt?.holding);

  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : undefined;

  function changePanel(panel) {
    setActivePanel(panel);
    writeActivePanel(panel);
  }

  function toggleTalk(id) {
    if (!onTalkIdsChange) return;
    const next = applyToggle(talkIds, id, talkMode);
    onTalkIdsChange(next);
    if (next.length && onListenChange) {
      const sid = String(id);
      if (next.map(String).includes(sid) && !listenSet.has(sid)) {
        onListenChange([...(listenIds || []), id]);
      }
    }
  }

  function toggleListen(id) {
    if (!onListenChange) return;
    onListenChange(applyToggle(listenIds, id, listenMode));
  }

  function toggleVideo(id) {
    if (!onVideoIdsChange) return;
    onVideoIdsChange(applyToggle(videoIds, id, videoMode));
  }

  function toggleAlert(id) {
    if (!onAlertIdsChange) return;
    onAlertIdsChange(applyToggle(alertIds, id, alertMode));
  }

  async function onSendPanic() {
    if (!ptt?.sendPanic || busyPanic) return;
    const ids = alertIds.length
      ? alertIds
      : talkIds.length
        ? talkIds
        : group?.id
          ? [group.id]
          : [];
    if (!ids.length) return;
    const names = orderedGroups
      .filter((g) => ids.map(String).includes(String(g.id)))
      .map((g) => g.name)
      .join(', ');
    const ok = window.confirm(
      `¿Enviar alarma de pánico a ${ids.length === 1 ? '«' + (names || 'canal') + '»' : ids.length + ' canales'}?`
    );
    if (!ok) return;
    setBusyPanic(true);
    setMenu(null);
    try {
      await ptt.sendPanic({ groupIds: ids });
    } finally {
      setBusyPanic(false);
    }
  }

  function fireTogglePtt() {
    if (!canTalk && !holding) return;
    setMenu(null);
    ptt.unlockAudio?.().catch(() => {});
    if (ptt.usesLatch !== false) {
      ptt.toggle();
    } else if (holding) {
      ptt.release();
    } else {
      ptt.press();
    }
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.lt-ptt-float-menu')) return;
    const latch = ptt.usesLatch !== false;
    // Hold (operadores): pulsar = al aire; soltar = liberar (también permite arrastre).
    if (!latch && canTalk) {
      const el = rootRef.current;
      const rect = el?.getBoundingClientRect();
      const hostRect = hostEl?.getBoundingClientRect?.() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos ? pos.x : (rect ? rect.left - hostRect.left : 0),
        origY: pos ? pos.y : (rect ? rect.top - hostRect.top : 0),
        moved: false,
        hostRect,
        holdMode: true,
      };
      if (!holding) {
        ptt.unlockAudio?.().catch(() => {});
        ptt.press();
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    // Al aire: click suelta (no arrastre) — evita quedar trabado
    if (holding) {
      dragRef.current = { pointerId: e.pointerId, releaseOnly: true };
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const hostRect = hostEl?.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos ? pos.x : rect.left - hostRect.left,
      origY: pos ? pos.y : rect.top - hostRect.top,
      moved: false,
      hostRect,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || d.releaseOnly) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    e.preventDefault();
    const next = clampPos(d.origX + dx, d.origY + dy, hostEl);
    setPos(next);
  }

  function onPointerUp(e) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d.releaseOnly) {
      fireTogglePtt();
      return;
    }
    if (d.holdMode) {
      ptt.release();
      if (d.moved) {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        persistPos(clampPos(d.origX + dx, d.origY + dy, hostEl));
      }
      return;
    }
    if (d.moved) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      persistPos(clampPos(d.origX + dx, d.origY + dy, hostEl));
      return;
    }
    fireTogglePtt();
  }

  function onContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    // Cancelar drag pendiente para no mezclar con el menú
    dragRef.current = null;
    const menuW = 280;
    const menuH = 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setMenu({
      x: Math.min(Math.max(8, e.clientX), Math.max(8, vw - menuW - 8)),
      y: Math.min(Math.max(8, e.clientY), Math.max(8, vh - menuH - 8)),
    });
  }

  function resetPosition() {
    try {
      localStorage.removeItem(POS_KEY);
    } catch {
      /* ignore */
    }
    setPos(null);
    setMenu(null);
  }

  const panelMeta = PANELS.find((p) => p.id === activePanel) || PANELS[1];
  const activeIds =
    activePanel === 'listen'
      ? listenSet
      : activePanel === 'video'
        ? videoSet
        : activePanel === 'alert'
          ? alertSet
          : talkSet;
  const onToggleRow =
    activePanel === 'listen'
      ? toggleListen
      : activePanel === 'video'
        ? toggleVideo
        : activePanel === 'alert'
          ? toggleAlert
          : toggleTalk;

  if (!ptt || !hostEl) return null;

  const menuHost =
    resolveDropdownPortalHost(rootRef.current) || hostEl || document.body;

  return createPortal(
    <>
      <div
        ref={rootRef}
        className={`lt-ptt-float${pos ? ' lt-ptt-float--placed' : ''}${holding ? ' is-holding' : ''}`}
        style={style}
        role="group"
        aria-label="PTT en pantalla completa"
      >
        <button
          type="button"
          className={`lt-ptt-float-btn${holding ? ' holding' : ''}`}
          disabled={!canTalk && !holding}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={onContextMenu}
          onClick={(e) => e.preventDefault()}
          aria-pressed={holding}
          title={
            holding
              ? 'Toca para soltar · click derecho: canales'
              : 'Click: hablar · arrastrar: mover · click derecho: canales / alarma'
          }
        >
          <span className="lt-ptt-float-label">{holding ? 'AL AIRE' : 'PTT'}</span>
          <span className="lt-ptt-float-hint">{hint}</span>
        </button>
      </div>

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className={`lt-ptt-float-menu layout-${menuLayout}`}
            style={{ left: menu.x, top: menu.y }}
            role="dialog"
            aria-label="Canales PTT"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {menuLayout === 'select' ? (
              <label className="lt-ptt-float-menu-select-wrap">
                <span className="lt-ptt-float-menu-select-label">Panel</span>
                <select
                  className="lt-ptt-float-menu-select"
                  value={activePanel}
                  aria-label="Panel de canales"
                  onChange={(e) => changePanel(e.target.value)}
                >
                  {PANELS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="lt-ptt-float-menu-tabs channel-panel-tabs" role="tablist" aria-label="Panel de canales">
                {PANELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={activePanel === p.id}
                    className={`channel-panel-tab${activePanel === p.id ? ' on' : ''}`}
                    onClick={() => changePanel(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <div className="lt-ptt-float-menu-title">{panelMeta.label}</div>
            <div className="lt-ptt-float-menu-list" role="tabpanel">
              {orderedGroups.length === 0 ? (
                <p className="lt-ptt-float-menu-empty">Sin canales</p>
              ) : (
                orderedGroups.map((g) => {
                  const id = g.id;
                  const on = activeIds.has(String(id));
                  return (
                    <label
                      key={id}
                      className="lt-ptt-float-menu-row"
                      role="menuitemcheckbox"
                      aria-checked={on}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggleRow(id)}
                      />
                      <span className="lt-ptt-float-menu-name">{g.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="lt-ptt-float-menu-actions">
              {activePanel === 'alert' ? (
                <button
                  type="button"
                  className="lt-ptt-float-menu-panic"
                  disabled={
                    busyPanic ||
                    ptt.panicSending ||
                    !(alertIds.length || talkIds.length || group?.id)
                  }
                  onClick={onSendPanic}
                >
                  {busyPanic || ptt.panicSending ? 'Enviando…' : 'Enviar alarma'}
                </button>
              ) : null}
              <button
                type="button"
                className="lt-ptt-float-menu-reset"
                onClick={resetPosition}
              >
                Posición inicial
              </button>
            </div>
          </div>,
          menuHost
        )}
    </>,
    hostEl
  );
}
