import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../theme';
import { fetchGroups, fetchAuthMe, persistSession, canManageUsers } from '../api';
import { usePtt } from '../usePtt';
import { useGpsReporter } from '../useGpsReporter';
import { useDispatchListen } from '../useDispatchListen';
import { unlockMediaAudio } from '../unlockMediaAudio';
import { startBackgroundKeepalive, stopBackgroundKeepalive } from '../backgroundKeepalive';
import DispatchPanicHost from './DispatchPanicHost.jsx';
import RadioPage from '../pages/RadioPage.jsx';
import { PEER_EVENTS, openPeoplePalette } from '../peerActions';
import { useIsPhone, useIsCoarsePointer } from '../useMediaQuery.js';
import './command-center.css';
import '../institutional.css';
import '../theme-contrast.css';

const ROLE_LABEL = {
  root: 'Superadministrador',
  admin: 'Administrador (Región)',
  zone_admin: 'Admin de zona',
  unit_admin: 'Admin de unidad',
  dispatcher: 'Despacho',
  operator: 'Operador',
};

const LISTEN_KEY = 'tacticalptx_listen_groups';
const GROUP_KEY = 'tacticalptx_dispatch_group';
const RAIL_MINI_KEY = 'tacticalptx_mod_rail_hidden';

function ModIcon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    className: 'cc-mod-ico-svg',
  };
  switch (name) {
    case 'ops':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="14" rx="1.5" />
          <path d="M7 18v2M17 18v2M8 9h3M8 12h8M8 15h5" />
        </svg>
      );
    case 'track':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M3 6.5 9 4l6 2.5L21 4v15.5L15 22l-6-2.5L3 22Z" />
          <path d="M9 4v15.5M15 6.5V22" />
        </svg>
      );
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="12" height="10" rx="1.5" />
          <path d="M15 10.5 21 7v10l-6-3.5Z" />
        </svg>
      );
    case 'catalog':
      return (
        <svg {...common}>
          <path d="M4 5h7l2 2h7v12H4Z" />
          <path d="M8 11h8M8 14h5" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 19a4.5 4.5 0 0 1 4.5-4.2" />
        </svg>
      );
    case 'groups':
      return (
        <svg {...common}>
          <circle cx="8" cy="9" r="2.5" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3.5 18.5a4.5 4.5 0 0 1 9 0M11.5 18.5a4.5 4.5 0 0 1 9 0" />
        </svg>
      );
    case 'geofence':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" />
        </svg>
      );
    case 'radio':
      return (
        <svg {...common}>
          <rect x="6" y="7" width="12" height="13" rx="1.5" />
          <path d="M9 4h6M12 4v3M10 12h4M10 15h4" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 5H6v14h4" />
          <path d="M13 12H21M17 8l4 4-4 4" />
        </svg>
      );
    default:
      return null;
  }
}

const NAV = [
  { id: 'ops', to: '/despacho', end: true, label: 'Operaciones', hint: 'Consola PTT', icon: 'ops' },
  { id: 'track', to: '/despacho/seguimiento', label: 'Seguimiento', hint: 'Ubicación en vivo', icon: 'track' },
  { id: 'video', to: '/despacho/video', label: 'Video', hint: 'Cámara y transmisiones', icon: 'video' },
  { id: 'map', to: '/despacho/mapa', label: 'Mapa en vivo', hint: 'Rutas y geocercas', icon: 'map' },
  { id: 'radio', to: '/despacho/radio', label: 'Radio PTT', hint: 'Hablar y chat', icon: 'radio' },
];

const NAV_ORDER_KEY = 'tacticalptx_mod_nav_order';
const DEFAULT_NAV_ORDER = ['ops', 'track', 'video', 'map', 'radio', 'catalogs', 'config'];

function loadNavOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || 'null');
    if (!Array.isArray(raw) || !raw.length) return [...DEFAULT_NAV_ORDER];
    const known = new Set(DEFAULT_NAV_ORDER);
    const next = raw.filter((id) => known.has(id));
    for (const id of DEFAULT_NAV_ORDER) {
      if (!next.includes(id)) next.push(id);
    }
    return next;
  } catch {
    return [...DEFAULT_NAV_ORDER];
  }
}

function saveNavOrder(order) {
  try {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

const CATALOG_LINKS = [
  { to: '/despacho/catalogos/grados-empleos', label: 'Grados y empleos', icon: 'users' },
  { to: '/despacho/catalogos/dependencias', label: 'Dependencias', icon: 'groups' },
  { to: '/despacho/catalogos/usuarios', label: 'Usuarios', icon: 'users' },
  { to: '/despacho/catalogos/grupos', label: 'Grupos', icon: 'groups' },
];

const CONFIG_LINKS = [
  { to: '/despacho/configuracion/canales', label: 'Canales', icon: 'radio', allRoles: true },
  { to: '/despacho/configuracion/respaldos', label: 'Respaldos', icon: 'catalog', adminOnly: true },
  {
    to: '/despacho/configuracion/auditoria',
    label: 'Historial / Auditoría',
    icon: 'catalog',
    adminOnly: true,
  },
];

export default function DispatchLayout({ session, onLogout, onSession }) {
  const role = session.user.role;
  const roleLabel = ROLE_LABEL[role] || role;
  const location = useLocation();
  const navigate = useNavigate();
  const onRadioPage = location.pathname.startsWith('/despacho/radio');
  const showSalir = canManageUsers(session.user);
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [listenIds, setListenIds] = useState([]);
  const [railMini, setRailMini] = useState(() => {
    try {
      return localStorage.getItem(RAIL_MINI_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [navOrder, setNavOrder] = useState(loadNavOrder);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const isPhone = useIsPhone();
  const isCoarse = useIsCoarsePointer();

  const ptt = usePtt({ token: session.token, user: session.user, group });
  useGpsReporter(session.token);

  // Cerrar sheet «Más» al navegar.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const listenGroups = groups.filter((g) => listenIds.includes(g.id));
  useDispatchListen({
    token: session.token,
    groups: listenGroups,
    skipGroupId: group?.id,
    muted: ptt.listenMuted,
  });

  useEffect(() => {
    const onOpenDm = (e) => {
      const peer = e.detail?.peer;
      if (!peer?.id) return;
      if (location.pathname.startsWith('/despacho/radio')) return;
      navigate('/despacho/radio', { state: { focusPeerId: peer.id } });
    };
    window.addEventListener(PEER_EVENTS.OPEN_DM, onOpenDm);
    return () => window.removeEventListener(PEER_EVENTS.OPEN_DM, onOpenDm);
  }, [location.pathname, navigate]);

  const catalogsOpen =
    location.pathname.startsWith('/despacho/catalogos') ||
    location.pathname.startsWith('/despacho/usuarios') ||
    location.pathname.startsWith('/despacho/grupos');
  const configOpen = location.pathname.startsWith('/despacho/configuracion');
  const showConfig = true;
  const configLinks = CONFIG_LINKS.filter(
    (l) => l.allRoles || (l.adminOnly && ['root', 'admin'].includes(role))
  );

  function toggleRail() {
    setRailMini((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_MINI_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function reorderNav(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setNavOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(fromId);
      const to = next.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, fromId);
      saveNavOrder(next);
      return next;
    });
  }

  function onNavDragStart(e, id) {
    if (isCoarse || isPhone) {
      e.preventDefault();
      return;
    }
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    try {
      e.dataTransfer.setData('application/x-tacticalptx-nav', id);
    } catch {
      /* ignore */
    }
  }

  function onNavDragOver(e, id) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  }

  function onNavDrop(e, id) {
    e.preventDefault();
    const from =
      e.dataTransfer.getData('application/x-tacticalptx-nav') ||
      e.dataTransfer.getData('text/plain') ||
      dragId;
    reorderNav(from, id);
    setDragId(null);
    setOverId(null);
  }

  function onNavDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  function navSlotClass(id) {
    return [
      'cc-mod-slot',
      dragId === id ? 'is-dragging' : '',
      overId === id && dragId && overId !== dragId ? 'is-drag-over' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  function renderNavItem(id) {
    const dragProps = {
      onDragOver: (e) => onNavDragOver(e, id),
      onDrop: (e) => onNavDrop(e, id),
    };
    const allowDrag = !isCoarse && !isPhone;
    const handle = (
      <span
        className="cc-mod-drag-handle"
        title={allowDrag ? 'Arrastrar para reordenar' : undefined}
        aria-label={allowDrag ? 'Arrastrar para reordenar' : undefined}
        aria-hidden={!allowDrag}
        draggable={allowDrag}
        onDragStart={(e) => {
          if (!allowDrag) return;
          e.stopPropagation();
          onNavDragStart(e, id);
        }}
        onDragEnd={onNavDragEnd}
        onClick={(e) => e.preventDefault()}
      >
        ⋮⋮
      </span>
    );

    if (id === 'catalogs') {
      return (
        <div key={id} className={navSlotClass(id)} {...dragProps}>
          <details className="cc-mod-group" open={catalogsOpen}>
            <summary title="Catálogos">
              {handle}
              <span className="cc-mod-link-icon">
                <ModIcon name="catalog" />
              </span>
              <span className="cc-mod-group-label">Catálogos</span>
              <span className="cc-mod-group-chevron" aria-hidden="true" />
            </summary>
            <div className="cc-mod-sub">
              {CATALOG_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <span className="cc-mod-link-icon">
                    <ModIcon name={item.icon} />
                  </span>
                  <span className="cc-mod-sub-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </details>
        </div>
      );
    }

    if (id === 'config') {
      if (!showConfig) return null;
      return (
        <div key={id} className={navSlotClass(id)} {...dragProps}>
          <details className="cc-mod-group" open={configOpen}>
            <summary title="Configuración">
              {handle}
              <span className="cc-mod-link-icon">
                <ModIcon name="ops" />
              </span>
              <span className="cc-mod-group-label">Configuración</span>
              <span className="cc-mod-group-chevron" aria-hidden="true" />
            </summary>
            <div className="cc-mod-sub">
              {configLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <span className="cc-mod-link-icon">
                    <ModIcon name={item.icon} />
                  </span>
                  <span className="cc-mod-sub-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </details>
        </div>
      );
    }

    const item = NAV.find((n) => n.id === id);
    if (!item) return null;
    return (
      <div key={id} className={navSlotClass(id)} {...dragProps}>
        <NavLink
          to={item.to}
          end={item.end}
          title={item.label}
          className={({ isActive }) => `cc-mod-link${isActive ? ' active' : ''}`}
        >
          {handle}
          <span className="cc-mod-link-icon">
            <ModIcon name={item.icon} />
          </span>
          <span className="cc-mod-link-text">
            <span className="cc-mod-link-title">{item.label}</span>
            <span className="cc-mod-link-hint">{item.hint}</span>
          </span>
        </NavLink>
      </div>
    );
  }

  useEffect(() => {
    if (!session?.token || !onSession) return undefined;
    if (session.crypto?.wireKey && session.avatarTicket) return undefined;
    let cancelled = false;
    fetchAuthMe(session.token)
      .then((data) => {
        if (cancelled || !data) return;
        const next = {
          ...session,
          user: data.user || session.user,
          crypto: data.crypto || session.crypto,
          avatarTicket: data.avatarTicket || session.avatarTicket,
        };
        persistSession(next);
        onSession(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar token
  }, [session?.token, onSession]);

  useEffect(() => {
    let cancelled = false;
    fetchGroups(session.token)
      .then((data) => {
        if (cancelled) return;
        const list = data.groups || [];
        setGroups(list);
        let saved = null;
        try {
          saved = localStorage.getItem(GROUP_KEY);
        } catch {
          saved = null;
        }
        const savedGroup = list.find((g) => g.id === saved);
        const ops = list.find((g) => !/^general$/i.test(g.name || ''));
        const nextGroup = savedGroup || ops || list[0] || null;
        setGroup(nextGroup);

        let savedListen = null;
        try {
          savedListen = JSON.parse(localStorage.getItem(LISTEN_KEY) || 'null');
        } catch {
          savedListen = null;
        }
        const allIds = list.map((x) => x.id);
        const nextListen = Array.isArray(savedListen)
          ? savedListen.filter((id) => allIds.includes(id))
          : allIds;
        if (nextGroup?.id && !nextListen.includes(nextGroup.id)) {
          nextListen.push(nextGroup.id);
        }
        setListenIds(nextListen.length ? nextListen : allIds);
      })
      .catch((e) => {
        if (/token|autoriz/i.test(e.message)) onLogout();
      });
    return () => {
      cancelled = true;
    };
  }, [session.token, onLogout]);

  useEffect(() => {
    if (!group?.id) return undefined;
    startBackgroundKeepalive({ channelName: group?.name || 'Canal' }).catch(() => {});
    return () => {
      stopBackgroundKeepalive();
    };
  }, [group?.id, group?.name]);

  useEffect(() => {
    const unlock = () => {
      unlockMediaAudio(() => ptt.unlockAudio?.()).catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [ptt.unlockAudio]);

  /* Espacio = PTT toggle en todas las pestañas del despacho */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      e.preventDefault();
      ptt.toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [ptt.toggle]);

  function onGroupChange(id) {
    const next = groups.find((g) => g.id === id) || null;
    setGroup(next);
    try {
      if (next?.id) localStorage.setItem(GROUP_KEY, next.id);
    } catch {
      /* ignore */
    }
    if (next?.id && !listenIds.includes(next.id)) {
      onListenChange([...listenIds, next.id]);
    }
  }

  function onListenChange(ids) {
    setListenIds(ids);
    try {
      localStorage.setItem(LISTEN_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }

  const speakingGroupName = ptt.speaking?.groupId
    ? groups.find((g) => g.id === ptt.speaking.groupId)?.name
    : null;
  const speaker = ptt.listenMuted
    ? 'Radio silenciada'
    : ptt.holding
      ? 'Tú al aire'
      : ptt.speaking
        ? speakingGroupName
          ? `${ptt.speaking.displayName}, ${speakingGroupName}`
          : `${ptt.speaking.displayName} habla`
        : ptt.livekitReady
          ? 'Canal libre'
          : 'Conectando…';

  const outletContext = {
    session,
    embeddedInDispatch: true,
    ptt,
    groups,
    group,
    listenIds,
    onGroupChange,
    onListenChange,
  };

  const path = location.pathname;
  const tabRadio = path.startsWith('/despacho/radio');
  const tabMore =
    !tabRadio &&
    (path === '/despacho' ||
      path.startsWith('/despacho/seguimiento') ||
      path.startsWith('/despacho/video') ||
      path.startsWith('/despacho/mapa') ||
      path.startsWith('/despacho/catalogos') ||
      path.startsWith('/despacho/configuracion') ||
      path.startsWith('/despacho/usuarios') ||
      path.startsWith('/despacho/grupos'));

  return (
    <div
      className={`cc-shell cc-shell--inst${railMini ? ' is-rail-mini' : ''}${isPhone ? ' is-phone' : ''}${moreOpen ? ' is-more-open' : ''}`}
    >
      <DispatchPanicHost
        session={session}
        channelPanic={ptt.incomingPanic}
        onChannelPanicAck={ptt.ackPanic}
        onChannelPanicSilence={ptt.silencePanicAlarm}
      />
      <header className="cc-topbar cc-topbar--inst">
        <div className="cc-top-left">
          <div>
            {!isPhone && (
              <p className="cc-product">Centro de operaciones</p>
            )}
            <div className="cc-brand">
              <span className="brand-tactical">Tactical</span>
              <span className="brand-ptx">Ptx</span>
            </div>
          </div>
        </div>
        <div className="cc-top-right">
          {!isPhone && (
            <button
              type="button"
              className="cc-btn ghost btn-personas"
              title="Buscar personas (Ctrl+K)"
              onClick={() => openPeoplePalette()}
            >
              Personas
            </button>
          )}
          <div className="cc-user-chip">
            {!isPhone && <span className="cc-user">{session.user.displayName}</span>}
            <span className={`cc-role-badge role-${role}`}>{isPhone ? role : roleLabel}</span>
            <ThemeToggle className="cc-theme-toggle" />
          </div>
          {!isPhone && (
            <nav className="cc-topnav-inst" aria-label="Accesos rápidos">
              <Link to="/despacho/radio">Radio</Link>
              {showSalir && (
                <button type="button" className="nav-out" onClick={onLogout}>
                  Salir
                </button>
              )}
            </nav>
          )}
        </div>
      </header>

      <div className="cc-shell-body">
        {!isPhone && (
          <aside id="cc-mod-rail" className="cc-mod-rail" aria-label="Módulos">
            <div className="cc-mod-rail-head">
              <div className="cc-mod-rail-titles">
                <p className="cc-mod-rail-kicker">Operación</p>
                <h2 className="cc-mod-rail-title">Módulos</h2>
              </div>
              <button
                type="button"
                className={`cc-rail-chevron-btn${railMini ? ' is-mini' : ''}`}
                onClick={toggleRail}
                aria-expanded={!railMini}
                aria-controls="cc-mod-rail"
                title={railMini ? 'Expandir menú' : 'Contraer menú'}
                aria-label={railMini ? 'Expandir menú' : 'Contraer menú'}
              >
                <span className="cc-rail-chevron" aria-hidden="true" />
              </button>
            </div>

            <nav
              className="cc-mod-nav"
              aria-label={isCoarse ? 'Módulos' : 'Módulos (arrastra para reordenar)'}
            >
              {navOrder.map((id) => renderNavItem(id))}
            </nav>

            <div className="cc-mod-rail-foot">
              <p className="cc-mod-link-hint cc-mod-rail-user">{session.user.displayName}</p>
              {showSalir && (
                <button type="button" className="cc-btn ghost cc-mod-logout" onClick={onLogout} title="Salir">
                  <span className="cc-mod-link-icon">
                    <ModIcon name="logout" />
                  </span>
                  <span className="cc-mod-logout-label">Salir</span>
                </button>
              )}
            </div>
          </aside>
        )}

        <div className="cc-body">
          <div
            className={`cc-radio-strip${ptt.speaking || ptt.holding ? ' live' : ''}${ptt.listenMuted ? ' is-muted' : ''}`}
            title="Canal de habla y escucha. Cámbialos en Configuración → Canales."
          >
            <div
              className={`cc-radio-dock${ptt.speaking || ptt.holding ? ' live' : ''}${ptt.listenMuted ? ' is-muted' : ''}`}
            >
              <span className="cc-radio-dock-dot" aria-hidden="true" />
              {group ? (
                <Link
                  to="/despacho/configuracion/canales"
                  className="cc-radio-dock-ch-link"
                  title="Elegir canales a oír y canal de PTT"
                >
                  <span className="cc-radio-dock-ch">{group.name}</span>
                  <span className="cc-radio-dock-listen">
                    Oye {listenIds.length || 0}
                    {groups.length ? `/${groups.length}` : ''}
                  </span>
                </Link>
              ) : (
                <span className="cc-radio-dock-ch">Sin canal</span>
              )}
              <span className="cc-radio-dock-status">{speaker}</span>
            </div>
            <button
              type="button"
              className={`cc-ptt-mini tp-coarse-touch${ptt.holding ? ' holding' : ''}`}
              disabled={!group || !ptt.livekitReady}
              onClick={(e) => {
                e.preventDefault();
                ptt.unlockAudio?.().catch(() => {});
                ptt.toggle();
              }}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={ptt.holding}
              title={
                !group
                  ? 'Sin canal'
                  : !ptt.livekitReady
                    ? 'Conectando radio…'
                    : ptt.holding
                      ? 'Toca o Espacio para soltar'
                      : 'Toca o Espacio para hablar'
              }
            >
              <span className="cc-ptt-mini-label">{ptt.holding ? 'AL AIRE' : 'PTT'}</span>
              <span className="cc-ptt-mini-hint">
                {ptt.livekitReady ? (ptt.holding ? 'soltar' : 'tocar') : '…'}
              </span>
            </button>
            {!onRadioPage && (
              <button
                type="button"
                className="cc-radio-mute tp-coarse-touch"
                onClick={() => {
                  ptt.unlockAudio?.().catch(() => {});
                  ptt.setListenMuted(!ptt.listenMuted);
                }}
                disabled={!group}
                aria-pressed={ptt.listenMuted}
                title={ptt.listenMuted ? 'Activar altavoz de radio' : 'Silenciar radio'}
              >
                {ptt.listenMuted ? 'MUTE' : 'Altavoz'}
              </button>
            )}
            {(ptt.denied || ptt.error) && (
              <span className="cc-ptt-mini-err" role="status">
                {ptt.denied?.reason === 'busy'
                  ? 'Canal ocupado'
                  : ptt.denied
                    ? 'Sin permiso'
                    : 'Error de audio'}
              </span>
            )}
          </div>

          <main className="cc-main">
            <div
              className={`cc-radio-keepalive${onRadioPage ? '' : ' is-parked'}`}
              aria-hidden={!onRadioPage}
            >
              <RadioPage
                session={session}
                onLogout={onLogout}
                dispatchEmbed={outletContext}
              />
            </div>
            <div
              className={`cc-outlet-panel${onRadioPage ? ' is-parked' : ''}`}
              aria-hidden={onRadioPage}
            >
              <Outlet context={outletContext} />
            </div>
          </main>
        </div>
      </div>

      {isPhone && (
        <>
          {moreOpen && (
            <button
              type="button"
              className="cc-phone-more-backdrop"
              aria-label="Cerrar menú"
              onClick={() => setMoreOpen(false)}
            />
          )}
          <div
            className={`cc-phone-more${moreOpen ? ' is-open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Más módulos"
            hidden={!moreOpen}
          >
            <div className="cc-phone-more-head">
              <h2>Módulos</h2>
              <button type="button" className="cc-btn ghost" onClick={() => setMoreOpen(false)}>
                Cerrar
              </button>
            </div>
            <nav className="cc-phone-more-nav" aria-label="Módulos">
              {NAV.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `cc-phone-more-link${isActive ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="cc-mod-link-icon">
                    <ModIcon name={item.icon} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                </NavLink>
              ))}
              {CATALOG_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `cc-phone-more-link${isActive ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="cc-mod-link-icon">
                    <ModIcon name={item.icon} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>Catálogos</small>
                  </span>
                </NavLink>
              ))}
              {configLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `cc-phone-more-link${isActive ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="cc-mod-link-icon">
                    <ModIcon name={item.icon} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>Configuración</small>
                  </span>
                </NavLink>
              ))}
              {showSalir && (
                <button type="button" className="cc-phone-more-link" onClick={onLogout}>
                  <span className="cc-mod-link-icon">
                    <ModIcon name="logout" />
                  </span>
                  <span>
                    <strong>Salir</strong>
                    <small>Cerrar sesión</small>
                  </span>
                </button>
              )}
            </nav>
          </div>

          <nav className="cc-phone-tabbar" aria-label="Navegación principal">
            <NavLink
              to="/despacho/radio"
              className={() => `cc-phone-tab${tabRadio ? ' active' : ''}`}
            >
              <ModIcon name="radio" />
              <span>Radio</span>
            </NavLink>
            <NavLink
              to="/despacho/radio"
              className={() => `cc-phone-tab${tabRadio ? ' active' : ''}`}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('tacticalptx:inbox-list'));
              }}
            >
              <ModIcon name="groups" />
              <span>Chats</span>
            </NavLink>
            <button
              type="button"
              className="cc-phone-tab"
              onClick={() => openPeoplePalette()}
            >
              <ModIcon name="users" />
              <span>Personas</span>
            </button>
            <button
              type="button"
              className={`cc-phone-tab${moreOpen || tabMore ? ' active' : ''}`}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <ModIcon name="ops" />
              <span>Más</span>
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
