import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle, useTheme } from '../theme';
import { fetchGroups, fetchAuthMe, persistSession, canManageUsers } from '../api';
import { usePtt, pttUsesLatch } from '../usePtt';
import { useGpsReporter } from '../useGpsReporter';
import { useDispatchListen } from '../useDispatchListen';
import { unlockMediaAudio } from '../unlockMediaAudio';
import { startBackgroundKeepalive, stopBackgroundKeepalive } from '../backgroundKeepalive';
import DispatchPanicHost from './DispatchPanicHost.jsx';
import RadioPage from '../pages/RadioPage.jsx';
import { PEER_EVENTS, openPeoplePalette } from '../peerActions';
import { useIsPhone, useIsCoarsePointer } from '../useMediaQuery.js';
import { radioSpeakerStatusLabel } from '../radioSpeakerLabel';
import { SICOM_FULL_NAME } from '../BrandName.jsx';
import './command-center.css';
import '../institutional.css';
import '../theme-contrast.css';

/** Segmento de módulo del rail (no sub-rutas internas). */
function dispatchModuleSegment(pathname) {
  const p = pathname || '';
  if (p.startsWith('/despacho/radio')) return 'radio';
  if (p.startsWith('/despacho/seguimiento')) return 'track';
  if (p.startsWith('/despacho/video')) return 'video';
  if (p.startsWith('/despacho/catalogos')) return 'catalogs';
  if (
    p.startsWith('/despacho/administracion') ||
    p.startsWith('/despacho/usuarios') ||
    p.startsWith('/despacho/grupos')
  ) {
    return 'admin';
  }
  if (p.startsWith('/despacho/configuracion')) return 'config';
  return 'ops';
}

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
const TALK_IDS_KEY = 'tacticalptx_talk_groups';
const VIDEO_IDS_KEY = 'tacticalptx_video_groups';
const ALERT_IDS_KEY = 'tacticalptx_alert_groups';
const LISTEN_MODE_KEY = 'tacticalptx_listen_mode';
const TALK_MODE_KEY = 'tacticalptx_talk_mode';
const VIDEO_MODE_KEY = 'tacticalptx_video_mode';
const ALERT_MODE_KEY = 'tacticalptx_alert_mode';
const GROUP_ORDER_KEY = 'tacticalptx_group_order';
const RAIL_MINI_KEY = 'tacticalptx_mod_rail_hidden';

function readJsonArray(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readMode(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === 'individual' || v === 'multiple') return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

function pickTopId(ids, order) {
  const set = new Set(ids || []);
  if (!set.size) return '';
  for (const id of order || []) {
    if (set.has(id)) return id;
  }
  return [...set][0] || '';
}

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
  {
    id: 'ops',
    to: '/despacho',
    end: true,
    label: 'Consola de Operaciones',
    hint: 'Indicadores y mapa en vivo',
    icon: 'ops',
  },
  { id: 'track', to: '/despacho/seguimiento', label: 'Seguimiento', hint: 'Ubicación en vivo', icon: 'track' },
  { id: 'video', to: '/despacho/video', label: 'Video', hint: 'Cámara y transmisiones', icon: 'video' },
  { id: 'radio', to: '/despacho/radio', label: 'Radio PTT', hint: 'Hablar y chat', icon: 'radio' },
];

const NAV_ORDER_KEY = 'tacticalptx_mod_nav_order';
const DEFAULT_NAV_ORDER = ['ops', 'track', 'video', 'radio', 'catalogs', 'admin', 'config'];

function loadNavOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || 'null');
    if (!Array.isArray(raw) || !raw.length) return [...DEFAULT_NAV_ORDER];
    const known = new Set(DEFAULT_NAV_ORDER);
    // Quitar ítems obsoletos (p. ej. «map» tras fusionar Mapa en vivo)
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

/** Logos rail: Verde/Claro = Tactical 1/2; Obscuro = Tactical 3 (+ crop circular). */
const RAIL_BRAND = {
  militar: {
    expanded: '/brand/tactical_rail_expanded.png?v=4',
    collapsed: '/brand/tactical_rail_collapsed.png?v=2',
  },
  obscuro: {
    expanded: '/brand/tactical_rail_obscuro_expanded.png?v=2',
    collapsed: '/brand/tactical_rail_obscuro_collapsed.png?v=2',
  },
};

export default function DispatchLayout({ session, onLogout, onSession }) {
  const { theme } = useTheme();
  const railBrand = theme === 'obscuro' ? RAIL_BRAND.obscuro : RAIL_BRAND.militar;
  const role = session.user.role;
  const roleLabel = ROLE_LABEL[role] || role;
  const location = useLocation();
  const navigate = useNavigate();
  const onRadioPage = location.pathname.startsWith('/despacho/radio');
  const moduleSeg = dispatchModuleSegment(location.pathname);
  const prevModuleSegRef = useRef(moduleSeg);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('tacticalptx:module-nav', {
        detail: { path: location.pathname, module: moduleSeg },
      })
    );
  }, [location.pathname, moduleSeg]);

  const showSalir = canManageUsers(session.user);
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [listenIds, setListenIds] = useState([]);
  const [talkIds, setTalkIds] = useState([]);
  const [videoIds, setVideoIds] = useState([]);
  const [alertIds, setAlertIds] = useState([]);
  const [listenMode, setListenMode] = useState(() => readMode(LISTEN_MODE_KEY, 'multiple'));
  const [talkMode, setTalkMode] = useState(() => readMode(TALK_MODE_KEY, 'individual'));
  const [videoMode, setVideoMode] = useState(() => readMode(VIDEO_MODE_KEY, 'individual'));
  const [alertMode, setAlertMode] = useState(() => readMode(ALERT_MODE_KEY, 'individual'));
  const [groupOrder, setGroupOrder] = useState([]);
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

  const ptt = usePtt({
    token: session.token,
    user: session.user,
    group,
    talkGroupIds: talkIds,
    listenGroupIds: listenIds,
    presenceGroupIds: groups.map((g) => g.id).filter(Boolean),
  });
  useGpsReporter(session.token);

  // Cerrar sheet «Más» al navegar.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  /* Al cambiar de módulo del rail: soft-refresh de canales + remount del Outlet
   * (key abajo). Radio vive en keepalive: aviso module-refresh para re-fetch. */
  useEffect(() => {
    if (prevModuleSegRef.current === moduleSeg) return;
    const from = prevModuleSegRef.current;
    prevModuleSegRef.current = moduleSeg;

    let cancelled = false;
    fetchGroups(session.token)
      .then((data) => {
        if (cancelled) return;
        const list = data.groups || [];
        const allIds = new Set(list.map((x) => x.id));
        setGroups(list);
        setListenIds((prev) => prev.filter((id) => allIds.has(id)));
        setVideoIds((prev) => prev.filter((id) => allIds.has(id)));
        setAlertIds((prev) => prev.filter((id) => allIds.has(id)));
        setTalkIds((prevTalk) => {
          const nextTalk = prevTalk.filter((id) => allIds.has(id));
          setGroupOrder((prevOrder) => {
            const kept = prevOrder.filter((id) => allIds.has(id));
            for (const id of list.map((g) => g.id)) {
              if (!kept.includes(id)) kept.push(id);
            }
            const primaryId = pickTopId(nextTalk, kept);
            setGroup(list.find((g) => g.id === primaryId) || null);
            return kept;
          });
          return nextTalk;
        });
      })
      .catch(() => {});

    /* Siempre: listeners (Radio inbox, mapas, etc.) re-fetchean sin F5. */
    window.dispatchEvent(
      new CustomEvent('tacticalptx:module-refresh', {
        detail: { module: moduleSeg, from, path: location.pathname },
      })
    );

    return () => {
      cancelled = true;
    };
  }, [moduleSeg, session.token, location.pathname]);

  const listenGroups = groups.filter((g) => listenIds.includes(g.id));
  const skipListenIds = talkIds.length ? talkIds : group?.id ? [group.id] : [];
  useDispatchListen({
    token: session.token,
    groups: listenGroups,
    skipGroupIds: skipListenIds,
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

  const catalogsOpen = location.pathname.startsWith('/despacho/catalogos');
  const adminOpen =
    location.pathname.startsWith('/despacho/administracion') ||
    location.pathname.startsWith('/despacho/usuarios') ||
    location.pathname.startsWith('/despacho/grupos');
  const configOpen = location.pathname.startsWith('/despacho/configuracion');
  const showConfig = true;

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
          <NavLink
            to="/despacho/catalogos"
            title="Catálogos"
            className={() => `cc-mod-link${catalogsOpen ? ' active' : ''}`}
          >
            {handle}
            <span className="cc-mod-link-icon">
              <ModIcon name="catalog" />
            </span>
            <span className="cc-mod-link-text">
              <span className="cc-mod-link-title">Catálogos</span>
              <span className="cc-mod-link-hint">Jerarquías, grados y más</span>
            </span>
          </NavLink>
        </div>
      );
    }

    if (id === 'admin') {
      return (
        <div key={id} className={navSlotClass(id)} {...dragProps}>
          <NavLink
            to="/despacho/administracion"
            title="Administración"
            className={() => `cc-mod-link${adminOpen ? ' active' : ''}`}
          >
            {handle}
            <span className="cc-mod-link-icon">
              <ModIcon name="users" />
            </span>
            <span className="cc-mod-link-text">
              <span className="cc-mod-link-title">Administración</span>
              <span className="cc-mod-link-hint">Usuarios, grupos y sitios</span>
            </span>
          </NavLink>
        </div>
      );
    }

    if (id === 'config') {
      if (!showConfig) return null;
      return (
        <div key={id} className={navSlotClass(id)} {...dragProps}>
          <NavLink
            to="/despacho/configuracion"
            title="Configuración"
            className={() => `cc-mod-link${configOpen ? ' active' : ''}`}
          >
            {handle}
            <span className="cc-mod-link-icon">
              <ModIcon name="ops" />
            </span>
            <span className="cc-mod-link-text">
              <span className="cc-mod-link-title">Configuración</span>
              <span className="cc-mod-link-hint">Canales, estados y sistema</span>
            </span>
          </NavLink>
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
    if (session.avatarTicket && session.crypto?.wireEnabled != null) return undefined;
    let cancelled = false;
    fetchAuthMe(session.token)
      .then((data) => {
        if (cancelled || !data) return;
        const next = {
          ...session,
          user: data.user || session.user,
          crypto: {
            ...(session.crypto || {}),
            ...(data.crypto || {}),
            wireKey: session.crypto?.wireKey || data.crypto?.wireKey,
          },
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
        const allIds = list.map((x) => x.id);

        let savedOrder = readJsonArray(GROUP_ORDER_KEY) || [];
        savedOrder = savedOrder.filter((id) => allIds.includes(id));
        for (const id of allIds) {
          if (!savedOrder.includes(id)) savedOrder.push(id);
        }
        setGroupOrder(savedOrder);

        const savedListen = readJsonArray(LISTEN_KEY);
        let nextListen = Array.isArray(savedListen)
          ? savedListen.filter((id) => allIds.includes(id))
          : allIds;

        const savedTalk = readJsonArray(TALK_IDS_KEY);
        let nextTalk = Array.isArray(savedTalk)
          ? savedTalk.filter((id) => allIds.includes(id))
          : null;

        let savedGroupId = null;
        try {
          savedGroupId = localStorage.getItem(GROUP_KEY);
        } catch {
          savedGroupId = null;
        }
        // Compat: GROUP_KEY vacío = Ninguno; null ausente = migrar.
        if (nextTalk == null) {
          if (savedGroupId === '') {
            nextTalk = [];
          } else if (savedGroupId && allIds.includes(savedGroupId)) {
            nextTalk = [savedGroupId];
          } else {
            const ops = list.find((g) => !/^general$/i.test(g.name || ''));
            nextTalk = ops?.id ? [ops.id] : allIds[0] ? [allIds[0]] : [];
          }
        }

        const modeListen = readMode(LISTEN_MODE_KEY, 'multiple');
        const modeTalk = readMode(TALK_MODE_KEY, 'individual');
        const modeVideo = readMode(VIDEO_MODE_KEY, 'individual');
        const modeAlert = readMode(ALERT_MODE_KEY, 'individual');
        setListenMode(modeListen);
        setTalkMode(modeTalk);
        setVideoMode(modeVideo);
        setAlertMode(modeAlert);

        if (modeListen === 'individual') {
          const one = pickTopId(nextListen, savedOrder);
          nextListen = one ? [one] : [];
        }
        if (modeTalk === 'individual') {
          const one = pickTopId(nextTalk, savedOrder);
          nextTalk = one ? [one] : [];
        }

        let nextVideo = readJsonArray(VIDEO_IDS_KEY);
        if (!Array.isArray(nextVideo)) {
          nextVideo = [];
        } else {
          nextVideo = nextVideo.filter((id) => allIds.includes(id));
        }
        if (modeVideo === 'individual') {
          const one = pickTopId(nextVideo, savedOrder);
          nextVideo = one ? [one] : [];
        } else {
          nextVideo = savedOrder.filter((id) => nextVideo.includes(id));
        }

        let nextAlert = readJsonArray(ALERT_IDS_KEY);
        if (!Array.isArray(nextAlert)) {
          nextAlert = [];
        } else {
          nextAlert = nextAlert.filter((id) => allIds.includes(id));
        }
        if (modeAlert === 'individual') {
          const one = pickTopId(nextAlert, savedOrder);
          nextAlert = one ? [one] : [];
        } else {
          nextAlert = savedOrder.filter((id) => nextAlert.includes(id));
        }

        // Hablar ⇒ oír
        for (const id of nextTalk) {
          if (!nextListen.includes(id)) nextListen.push(id);
        }

        setListenIds(nextListen);
        setTalkIds(nextTalk);
        setVideoIds(nextVideo);
        setAlertIds(nextAlert);
        const primaryId = pickTopId(nextTalk, savedOrder);
        setGroup(list.find((g) => g.id === primaryId) || null);

        try {
          localStorage.setItem(LISTEN_KEY, JSON.stringify(nextListen));
          localStorage.setItem(TALK_IDS_KEY, JSON.stringify(nextTalk));
          localStorage.setItem(VIDEO_IDS_KEY, JSON.stringify(nextVideo));
          localStorage.setItem(ALERT_IDS_KEY, JSON.stringify(nextAlert));
          localStorage.setItem(GROUP_ORDER_KEY, JSON.stringify(savedOrder));
          if (primaryId) localStorage.setItem(GROUP_KEY, primaryId);
          else localStorage.setItem(GROUP_KEY, '');
        } catch {
          /* ignore */
        }
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

  /* Espacio = PTT (latch admins / hold operadores) en todas las pestañas */
  useEffect(() => {
    const latch = pttUsesLatch(session.user);
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      e.preventDefault();
      unlockMediaAudio(() => ptt.unlockAudio?.())
        .catch(() => {})
        .finally(() => {
          if (latch) ptt.toggle();
          else ptt.press();
        });
    };
    const onKeyUp = (e) => {
      if (e.code !== 'Space') return;
      if (latch) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      e.preventDefault();
      ptt.release();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [ptt.toggle, ptt.press, ptt.release, session.user]);

  function applyTalkIds(ids) {
    const valid = (ids || []).filter((id) => groups.some((g) => g.id === id));
    setTalkIds(valid);
    const primaryId = pickTopId(valid, groupOrder);
    setGroup(groups.find((g) => g.id === primaryId) || null);
    try {
      localStorage.setItem(TALK_IDS_KEY, JSON.stringify(valid));
      localStorage.setItem(GROUP_KEY, primaryId || '');
    } catch {
      /* ignore */
    }
  }

  function onGroupChange(id) {
    // Compat API: un id o '' → talk individual
    if (!id) {
      applyTalkIds([]);
      return;
    }
    applyTalkIds([id]);
    if (!listenIds.includes(id)) {
      onListenChange([...listenIds, id]);
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

  function onTalkIdsChange(ids) {
    applyTalkIds(ids);
  }

  function onListenModeChange(mode) {
    setListenMode(mode);
    try {
      localStorage.setItem(LISTEN_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function onTalkModeChange(mode) {
    setTalkMode(mode);
    try {
      localStorage.setItem(TALK_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function onVideoIdsChange(ids) {
    const valid = (ids || []).filter((id) => groups.some((g) => g.id === id));
    const ordered = groupOrder.length
      ? groupOrder.filter((id) => valid.includes(id))
      : valid;
    setVideoIds(ordered);
    try {
      localStorage.setItem(VIDEO_IDS_KEY, JSON.stringify(ordered));
    } catch {
      /* ignore */
    }
  }

  function onVideoModeChange(mode) {
    setVideoMode(mode);
    try {
      localStorage.setItem(VIDEO_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function onAlertIdsChange(ids) {
    const valid = (ids || []).filter((id) => groups.some((g) => g.id === id));
    const ordered = groupOrder.length
      ? groupOrder.filter((id) => valid.includes(id))
      : valid;
    setAlertIds(ordered);
    try {
      localStorage.setItem(ALERT_IDS_KEY, JSON.stringify(ordered));
    } catch {
      /* ignore */
    }
  }

  function onAlertModeChange(mode) {
    setAlertMode(mode);
    try {
      localStorage.setItem(ALERT_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function onGroupOrderChange(ids) {
    setGroupOrder(ids);
    try {
      localStorage.setItem(GROUP_ORDER_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
    // Recalcular PTT primario solo si el orden cambia el canal de Hablar activo
    if (talkIds.length) {
      const primaryId = pickTopId(talkIds, ids);
      if (primaryId !== group?.id) {
        setGroup(groups.find((g) => g.id === primaryId) || null);
        try {
          localStorage.setItem(GROUP_KEY, primaryId || '');
        } catch {
          /* ignore */
        }
      }
    }
    if (videoIds.length) {
      const nextVideo = ids.filter((id) => videoIds.includes(id));
      setVideoIds(nextVideo);
      try {
        localStorage.setItem(VIDEO_IDS_KEY, JSON.stringify(nextVideo));
      } catch {
        /* ignore */
      }
    }
    if (alertIds.length) {
      const nextAlert = ids.filter((id) => alertIds.includes(id));
      setAlertIds(nextAlert);
      try {
        localStorage.setItem(ALERT_IDS_KEY, JSON.stringify(nextAlert));
      } catch {
        /* ignore */
      }
    }
  }

  const speaker = radioSpeakerStatusLabel({
    listenMuted: ptt.listenMuted,
    holding: ptt.holding,
    speakers: ptt.speakers || (ptt.speaking ? [ptt.speaking] : []),
    selfUserId: session.user?.id,
    groupNameFor: (gid) => groups.find((g) => g.id === gid)?.name,
    livekitReady: ptt.livekitReady,
    hasPttGroup: Boolean(group),
  });

  const outletContext = {
    session,
    embeddedInDispatch: true,
    ptt,
    groups,
    group,
    listenIds,
    talkIds,
    videoIds,
    alertIds,
    listenMode,
    talkMode,
    videoMode,
    alertMode,
    groupOrder,
    onGroupChange,
    onListenChange,
    onTalkIdsChange,
    onVideoIdsChange,
    onAlertIdsChange,
    onListenModeChange,
    onTalkModeChange,
    onVideoModeChange,
    onAlertModeChange,
    onGroupOrderChange,
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
      path.startsWith('/despacho/administracion') ||
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
      {!isPhone ? (
        <aside id="cc-mod-rail" className="cc-mod-rail" aria-label="Módulos">
            <div
              className="cc-mod-rail-brand"
              aria-label={`SICOM — ${SICOM_FULL_NAME}`}
              title={SICOM_FULL_NAME}
            >
              <div className="cc-mod-rail-brand-mark" aria-hidden="true">
                <img
                  className="cc-mod-rail-brand-logo cc-mod-rail-brand-logo--full"
                  src={railBrand.expanded}
                  alt=""
                  draggable={false}
                />
                <img
                  className="cc-mod-rail-brand-logo cc-mod-rail-brand-logo--mini"
                  src={railBrand.collapsed}
                  alt=""
                  width={96}
                  height={96}
                  draggable={false}
                />
              </div>
            </div>

            <div className="cc-mod-rail-head">
              <div className="cc-mod-rail-titles">
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
              <ThemeToggle variant="rail" />
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
      ) : null}

      <div className="cc-shell-main">
        <header className="cc-topbar cc-topbar--inst">
          <div className="cc-top-left">
            {isPhone ? (
              <div className="cc-brand-wrap cc-brand-wrap--phone" title={SICOM_FULL_NAME}>
                <img
                  className="cc-brand-logo cc-brand-logo--phone"
                  src={railBrand.collapsed}
                  alt="SICOM"
                  width={40}
                  height={40}
                  draggable={false}
                />
                <span className="cc-brand-phone-name">SICOM</span>
              </div>
            ) : null}
          </div>
          <div className="cc-top-right">
            <div className="cc-user-chip">
              {!isPhone && <span className="cc-user">{session.user.displayName}</span>}
              <span className={`cc-role-badge role-${role}`}>{isPhone ? role : roleLabel}</span>
            </div>
          </div>
        </header>

        <div className="cc-body">
          {!onRadioPage ? (
          <div
            className={`cc-radio-strip${ptt.speaking || ptt.holding ? ' live' : ''}${ptt.listenMuted ? ' is-muted' : ''}`}
            title="Canal de habla y escucha. Cámbialos en Configuración → Canales."
          >
            {/* Consola (DispatchMap) porta los KPI aquí: izquierda de la misma fila */}
            <div id="cc-ops-kpi-host" className="cc-ops-kpi-host" />
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
                  <span className="cc-radio-dock-ch">
                    {talkIds.length > 1
                      ? `PTT → ${talkIds.length} · ${group.name}`
                      : group.name}
                  </span>
                  <span className="cc-radio-dock-listen">
                    Oír {listenIds.length || 0}
                    {groups.length ? `/${groups.length}` : ''}
                  </span>
                </Link>
              ) : (
                <Link
                  to="/despacho/configuracion/canales"
                  className="cc-radio-dock-ch-link"
                  title="Elegir canal de PTT"
                >
                  <span className="cc-radio-dock-ch">Sin canal PTT</span>
                  <span className="cc-radio-dock-listen">
                    Oír {listenIds.length || 0}
                    {groups.length ? `/${groups.length}` : ''}
                  </span>
                </Link>
              )}
              <span className="cc-radio-dock-status">{speaker}</span>
            </div>
            <button
              type="button"
              className={`cc-ptt-mini tp-coarse-touch${ptt.holding ? ' holding' : ''}`}
              disabled={!group || !ptt.livekitReady}
              onPointerDown={(e) => {
                unlockMediaAudio(() => ptt.unlockAudio?.()).catch(() => {});
                if (!pttUsesLatch(session.user) && e.button === 0) {
                  e.preventDefault();
                  ptt.press();
                }
              }}
              onPointerUp={(e) => {
                if (!pttUsesLatch(session.user) && e.button === 0) {
                  e.preventDefault();
                  ptt.release();
                }
              }}
              onPointerCancel={() => {
                if (!pttUsesLatch(session.user)) ptt.release();
              }}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await unlockMediaAudio(() => ptt.unlockAudio?.());
                } catch {
                  /* ignore */
                }
                if (pttUsesLatch(session.user)) ptt.toggle();
              }}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={ptt.holding}
              title={
                !group
                  ? 'Sin canal'
                  : !ptt.livekitReady
                    ? 'Conectando radio…'
                    : ptt.holding
                      ? pttUsesLatch(session.user)
                        ? 'Toca o Espacio para soltar'
                        : 'Suelta para dejar de transmitir'
                      : pttUsesLatch(session.user)
                        ? 'Toca o Espacio para hablar'
                        : 'Mantén pulsado o Espacio para hablar'
              }
            >
              <span className="cc-ptt-mini-label">{ptt.holding ? 'AL AIRE' : 'PTT'}</span>
              <span className="cc-ptt-mini-hint">
                {ptt.livekitReady
                  ? pttUsesLatch(session.user)
                    ? ptt.holding
                      ? 'soltar'
                      : 'tocar'
                    : ptt.holding
                      ? 'suelta'
                      : 'mantén'
                  : '…'}
              </span>
            </button>
            <button
              type="button"
              className="cc-radio-mute tp-coarse-touch"
              onClick={() => {
                unlockMediaAudio(() => ptt.unlockAudio?.()).catch(() => {});
                ptt.setListenMuted(!ptt.listenMuted);
              }}
              disabled={!group}
              aria-pressed={ptt.listenMuted}
              title={ptt.listenMuted ? 'Activar altavoz de radio' : 'Silenciar radio'}
            >
              {ptt.listenMuted ? 'MUTE' : 'Altavoz'}
            </button>
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
          ) : null}

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
              {/* Remount al cambiar de módulo (F5 de datos). Radio vive fuera en keepalive. */}
              <Outlet
                key={moduleSeg === 'radio' ? 'outlet-parked' : moduleSeg}
                context={outletContext}
              />
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
              <NavLink
                to="/despacho/catalogos"
                className={() => `cc-phone-more-link${catalogsOpen ? ' active' : ''}`}
                onClick={() => setMoreOpen(false)}
              >
                <span className="cc-mod-link-icon">
                  <ModIcon name="catalog" />
                </span>
                <span>
                  <strong>Catálogos</strong>
                  <small>Jerarquías, grados y más</small>
                </span>
              </NavLink>
              <NavLink
                to="/despacho/administracion"
                className={() => `cc-phone-more-link${adminOpen ? ' active' : ''}`}
                onClick={() => setMoreOpen(false)}
              >
                <span className="cc-mod-link-icon">
                  <ModIcon name="users" />
                </span>
                <span>
                  <strong>Administración</strong>
                  <small>Usuarios, grupos y sitios</small>
                </span>
              </NavLink>
              {showConfig && (
                <NavLink
                  to="/despacho/configuracion"
                  className={() => `cc-phone-more-link${configOpen ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="cc-mod-link-icon">
                    <ModIcon name="ops" />
                  </span>
                  <span>
                    <strong>Configuración</strong>
                    <small>Canales, estados y sistema</small>
                  </span>
                </NavLink>
              )}
              <ThemeToggle variant="phone" onAfterClick={() => setMoreOpen(false)} />
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
