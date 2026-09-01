import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../theme';
import { fetchGroups, fetchAuthMe, persistSession, canManageUsers } from '../api';
import { usePtt } from '../usePtt';
import { useGpsReporter } from '../useGpsReporter';
import { useDispatchListen } from '../useDispatchListen';
import { unlockPanicAudio } from '../panicSound';
import { unlockAppNotifyAudio } from '../appNotify';
import { startBackgroundKeepalive, stopBackgroundKeepalive } from '../backgroundKeepalive';
import DispatchPanicHost from './DispatchPanicHost.jsx';
import RadioPage from '../pages/RadioPage.jsx';
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
  { to: '/despacho', end: true, label: 'Operaciones', hint: 'Consola PTT', icon: 'ops' },
  { to: '/despacho/seguimiento', label: 'Seguimiento', hint: 'Ubicación en vivo', icon: 'track' },
  { to: '/despacho/mapa', label: 'Mapa en vivo', hint: 'Rutas y geocercas', icon: 'map' },
];

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

  const ptt = usePtt({ token: session.token, user: session.user, group });
  useGpsReporter(session.token);

  const listenGroups = groups.filter((g) => listenIds.includes(g.id));
  useDispatchListen({
    token: session.token,
    groups: listenGroups,
    skipGroupId: group?.id,
    muted: ptt.listenMuted,
  });

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
      unlockPanicAudio().catch(() => {});
      unlockAppNotifyAudio().catch(() => {});
      ptt.unlockAudio?.().catch(() => {});
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

  return (
    <div className={`cc-shell cc-shell--inst${railMini ? ' is-rail-mini' : ''}`}>
      <DispatchPanicHost
        session={session}
        channelPanic={ptt.incomingPanic}
        onChannelPanicAck={ptt.ackPanic}
        onChannelPanicSilence={ptt.silencePanicAlarm}
      />
      <header className="cc-topbar cc-topbar--inst">
        <div className="cc-top-left">
          <div>
            <p className="cc-product">Centro de operaciones</p>
            <div className="cc-brand">
              <span className="brand-tactical">Tactical</span>
              <span className="brand-ptx">Ptx</span>
            </div>
          </div>
        </div>
        <div className="cc-top-right">
          <div className="cc-user-chip">
            <span className="cc-user">{session.user.displayName}</span>
            <span className={`cc-role-badge role-${role}`}>{roleLabel}</span>
            <ThemeToggle className="cc-theme-toggle" />
          </div>
          <nav className="cc-topnav-inst" aria-label="Accesos rápidos">
            <Link to="/despacho/radio">Radio</Link>
            {showSalir && (
              <button type="button" className="nav-out" onClick={onLogout}>
                Salir
              </button>
            )}
          </nav>
        </div>
      </header>

      <div className="cc-shell-body">
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

          <nav className="cc-mod-nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                className={({ isActive }) => `cc-mod-link${isActive ? ' active' : ''}`}
              >
                <span className="cc-mod-link-icon">
                  <ModIcon name={item.icon} />
                </span>
                <span className="cc-mod-link-text">
                  <span className="cc-mod-link-title">{item.label}</span>
                  <span className="cc-mod-link-hint">{item.hint}</span>
                </span>
              </NavLink>
            ))}

            <NavLink
              to="/despacho/radio"
              title="Radio PTT"
              className={({ isActive }) => `cc-mod-link${isActive ? ' active' : ''}`}
            >
              <span className="cc-mod-link-icon">
                <ModIcon name="radio" />
              </span>
              <span className="cc-mod-link-text">
                <span className="cc-mod-link-title">Radio PTT</span>
                <span className="cc-mod-link-hint">Hablar y chat</span>
              </span>
            </NavLink>

            <details className="cc-mod-group" open={catalogsOpen}>
              <summary title="Catálogos">
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

            {showConfig && (
              <details className="cc-mod-group" open={configOpen}>
                <summary title="Configuración">
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
            )}
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
              className={`cc-ptt-mini${ptt.holding ? ' holding' : ''}`}
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
                className="cc-radio-mute"
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
            {/* Radio PTT se mantiene montado al cambiar de módulo (Seguimiento, etc.)
                para no perder conversación, draft ni posición de scroll. */}
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
    </div>
  );
}
