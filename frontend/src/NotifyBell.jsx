import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import PersonAvatar from './PersonAvatar';
import {
  NOTICE_KIND_LABEL,
  clearNotices,
  getNotices,
  markAllNoticesRead,
  noticeTimeLabel,
  subscribeNotices,
  unreadNoticeCount,
} from './notifyCenter';
import NoticeIcon from './NoticeIcon.jsx';

const SLOT_ID = 'nt-bell-slot';
const FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: 'msg', label: 'Mensajes' },
  { id: 'alert', label: 'Alertas' },
  { id: 'call', label: 'Llamadas' },
  { id: 'geo', label: 'Geocercas' },
];

function matchesFilter(it, f) {
  if (f === 'all') return true;
  if (f === 'msg') return it.kind === 'dm' || it.kind === 'group';
  if (f === 'alert') return it.kind === 'panic';
  if (f === 'call') return it.kind === 'missed_call' || it.kind === 'video';
  if (f === 'geo') return it.kind === 'geofence';
  return true;
}

/**
 * Campana con contador + historial. Se monta en `#nt-bell-slot` (barra superior de
 * Despacho / Radio); en rutas sin barra queda flotante arriba a la derecha.
 */
export default function NotifyBell({ session, onOpenNotice }) {
  const location = useLocation();
  const [list, setList] = useState(getNotices);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [slot, setSlot] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [panelPos, setPanelPos] = useState(null);
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => subscribeNotices(setList), []);

  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const find = () => {
      const el = document.getElementById(SLOT_ID);
      setSlot(el);
      if (!el && tries++ < 20) raf = window.requestAnimationFrame(find);
    };
    find();
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    setNow(Date.now());
    document.body.classList.add('nt-panel-open');
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('nt-panel-open');
      window.clearInterval(t);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (location.pathname === '/login') return null;

  const unread = unreadNoticeCount(list);
  const shown = list.filter((it) => matchesFilter(it, filter));

  const bell = (
    <span className={`nt-bell${slot ? '' : ' nt-bell--floating'}`}>
      <button
        ref={btnRef}
        type="button"
        className={`nt-bell-btn${unread ? ' has-unread' : ''}`}
        aria-label={unread ? `Avisos: ${unread} sin leer` : 'Avisos'}
        aria-expanded={open}
        title="Avisos"
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setPanelPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
          setOpen((v) => !v);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread ? <span className="nt-bell-badge">{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? createPortal(
        <div
          ref={panelRef}
          className="nt-panel"
          role="dialog"
          aria-label="Historial de avisos"
          style={panelPos ? { top: panelPos.top, right: panelPos.right } : undefined}
        >
          <div className="nt-panel-head">
            <strong>Avisos</strong>
            <span className="nt-panel-head-actions">
              <button type="button" disabled={!unread} onClick={() => markAllNoticesRead()}>
                Marcar leídos
              </button>
              <button type="button" disabled={!list.length} onClick={() => clearNotices()}>
                Limpiar
              </button>
            </span>
          </div>
          <div className="nt-panel-filters" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={filter === f.id ? 'is-on' : ''}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="nt-panel-list">
            {shown.length ? (
              shown.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`nt-row nt-row--${it.kind}${it.read ? '' : ' is-unread'}`}
                  onClick={() => {
                    setOpen(false);
                    onOpenNotice?.(it);
                  }}
                >
                  <span className="nt-row-avatar">
                    {it.userId && (it.kind === 'dm' || it.kind === 'group' || it.kind === 'missed_call') ? (
                      <PersonAvatar
                        userId={it.userId}
                        name={it.title}
                        token={session?.token}
                        className="nt-card-avatar-img"
                      />
                    ) : (
                      <span className="nt-card-avatar-ico">
                        <NoticeIcon kind={it.kind} msgType={it.msgType} />
                      </span>
                    )}
                  </span>
                  <span className="nt-row-text">
                    <span className="nt-card-meta">
                      <span className="nt-card-chip">
                        {it.kind === 'group' ? it.groupName || 'Canal' : NOTICE_KIND_LABEL[it.kind] || 'Aviso'}
                      </span>
                      <span className="nt-card-time">{noticeTimeLabel(it.at, now)}</span>
                    </span>
                    <strong>{it.title}</strong>
                    {it.body ? <span className="nt-row-body">{it.body}</span> : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="nt-panel-empty">Sin avisos{filter !== 'all' ? ' en este filtro' : ''}.</p>
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </span>
  );

  return createPortal(bell, slot || document.body);
}
