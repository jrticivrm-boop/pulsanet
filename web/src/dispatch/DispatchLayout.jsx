import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../theme';
import { fetchGroups } from '../api';
import { usePtt } from '../usePtt';
import { useGpsReporter } from '../useGpsReporter';
import { useDispatchListen } from '../useDispatchListen';
import { unlockPanicAudio } from '../panicSound';
import { unlockAppNotifyAudio } from '../appNotify';
import { startBackgroundKeepalive, stopBackgroundKeepalive } from '../backgroundKeepalive';
import './command-center.css';
import '../institutional.css';

const ROLE_LABEL = {
  root: 'Superadministrador',
  admin: 'Administrador',
  dispatcher: 'Despacho',
  operator: 'Operador',
};

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
  { to: '/despacho/catalogos/usuarios', label: 'Usuarios', icon: 'users' },
  { to: '/despacho/catalogos/grupos', label: 'Grupos', icon: 'groups' },
  { to: '/despacho/catalogos/geocercas', label: 'Geocercas', icon: 'geofence' },
];

export default function DispatchLayout({ session, onLogout }) {
  const role = session.user.role;
  const roleLabel = ROLE_LABEL[role] || role;
  const location = useLocation();
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [railMini, setRailMini] = useState(() => {
    try {
      return localStorage.getItem(RAIL_MINI_KEY) === '1';
    } catch {
      return false;
    }
  });

  const ptt = usePtt({ token: session.token, user: session.user, group });
  useGpsReporter(session.token);
  useDispatchListen({
    token: session.token,
    groups,
    skipGroupId: group?.id,
    muted: ptt.listenMuted,
  });

  const catalogsOpen =
    location.pathname.startsWith('/despacho/catalogos') ||
    location.pathname.startsWith('/despacho/usuarios') ||
    location.pathname.startsWith('/despacho/grupos');

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
        setGroup(savedGroup || ops || list[0] || null);
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

  function onGroupChange(id) {
    const next = groups.find((g) => g.id === id) || null;
    setGroup(next);
    try {
      if (next?.id) localStorage.setItem(GROUP_KEY, next.id);
    } catch {
      /* ignore */
    }
  }

  const speakingGroupName = ptt.speaking?.groupId
    ? groups.find((g) => g.id === ptt.speaking.groupId)?.name
    : null;
  const speaker = ptt.holding
    ? 'Tú al aire'
    : ptt.speaking
      ? speakingGroupName && speakingGroupName !== group?.name
        ? `${ptt.speaking.displayName} · ${speakingGroupName}`
        : `${ptt.speaking.displayName} habla`
      : ptt.livekitReady
        ? 'Canal libre'
        : 'Conectando…';

  return (
    <div className={`cc-shell cc-shell--inst${railMini ? ' is-rail-mini' : ''}`}>
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
            <Link to="/radio">Radio</Link>
            <button type="button" className="nav-out" onClick={onLogout}>
              Salir
            </button>
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

            <Link to="/radio" className="cc-mod-link" title="Radio PTT">
              <span className="cc-mod-link-icon">
                <ModIcon name="radio" />
              </span>
              <span className="cc-mod-link-text">
                <span className="cc-mod-link-title">Radio PTT</span>
                <span className="cc-mod-link-hint">Hablar y chat</span>
              </span>
            </Link>
          </nav>

          <div className="cc-mod-rail-foot">
            <p className="cc-mod-link-hint cc-mod-rail-user">{session.user.displayName}</p>
            <button type="button" className="cc-btn ghost cc-mod-logout" onClick={onLogout} title="Cerrar sesión">
              <span className="cc-mod-link-icon">
                <ModIcon name="logout" />
              </span>
              <span className="cc-mod-logout-label">Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <div className="cc-body">
          <div
            className={`cc-radio-strip${ptt.speaking || ptt.holding ? ' live' : ''}${ptt.listenMuted ? ' is-muted' : ''}`}
            title="Oyes todos los canales. El selector es el canal por el que TÚ hablas."
          >
            <div
              className={`cc-radio-dock${ptt.speaking || ptt.holding ? ' live' : ''}${ptt.listenMuted ? ' is-muted' : ''}`}
            >
              <span className="cc-radio-dock-dot" aria-hidden="true" />
              {groups.length > 1 && group ? (
                <select
                  className="cc-radio-dock-select"
                  value={group.id}
                  onChange={(e) => onGroupChange(e.target.value)}
                  aria-label="Canal de radio"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="cc-radio-dock-ch">{group?.name || 'Sin canal'}</span>
              )}
              <span className="cc-radio-dock-status">{speaker}</span>
            </div>
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
              {ptt.listenMuted ? 'Silenciada' : 'En altavoz'}
            </button>
          </div>

          <main className="cc-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
