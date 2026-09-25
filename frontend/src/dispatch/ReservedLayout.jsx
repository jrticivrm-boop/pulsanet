import { useEffect, useMemo } from 'react';
import { Outlet, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import ReorderableCatalogTabs from './ReorderableCatalogTabs.jsx';
import { matchTabPath, writeRememberedTab } from './rememberModuleTab.js';
import { canViewModule, filterTabsByPermission } from './modulePermissions.js';

const MODULE_ID = 'video';
const BASE = '/despacho/video';

/**
 * Módulo RESERVADO: pestañas Video · Grabaciones · Conversaciones.
 */
export default function ReservedLayout({ session: sessionProp }) {
  const { pathname } = useLocation();
  const parentCtx = useOutletContext();
  const session = sessionProp || parentCtx?.session;

  const allTabs = useMemo(
    () => [
      { to: BASE, label: 'Video', end: true, permKey: 'video' },
      { to: `${BASE}/grabaciones`, label: 'Grabaciones', permKey: 'grabaciones' },
      { to: `${BASE}/chats`, label: 'Conversaciones', permKey: 'chats' },
    ],
    []
  );

  const tabs = useMemo(
    () => filterTabsByPermission(session?.user, 'video', allTabs),
    [session?.user, allTabs]
  );

  const tabPaths = useMemo(() => tabs.map((t) => t.to), [tabs]);
  const fallback = tabs[0]?.to || BASE;

  useEffect(() => {
    const matched = matchTabPath(pathname, tabs);
    if (matched) writeRememberedTab(MODULE_ID, matched);
  }, [pathname, tabs]);

  if (!canViewModule(session?.user, 'video')) {
    return <Navigate to="/despacho" replace />;
  }

  if (pathname === `${BASE}/`) {
    return <Navigate to={fallback} replace />;
  }

  // Ruta de pestaña no permitida → primera permitida
  const onAllowed =
    pathname === BASE ||
    tabPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (tabs.length && !onAllowed) {
    return <Navigate to={fallback} replace />;
  }
  if (!tabs.length) {
    return <Navigate to="/despacho" replace />;
  }

  return (
    <div className="cc-catalogs cc-reserved">
      <header className="cc-catalogs-head">
        <div>
          <h1>RESERVADO</h1>
          <p className="cc-hint cc-reserved-head-hint">
            Video en vivo, grabaciones y conversaciones de operadores (solo lectura)
          </p>
        </div>
        <ReorderableCatalogTabs
          tabs={tabs}
          storageKey="tacticalptx_reserved_tabs_order"
          ariaLabel="RESERVADO"
        />
      </header>
      <div className="cc-catalogs-body cc-reserved-body">
        <Outlet context={parentCtx} />
      </div>
    </div>
  );
}

/** Rutas de pestañas del módulo (rail + localStorage). */
export const RESERVED_TAB_PATHS = tabPathsFromBase();

function tabPathsFromBase() {
  return [BASE, `${BASE}/grabaciones`, `${BASE}/chats`];
}

export { MODULE_ID as RESERVED_MODULE_ID, BASE as RESERVED_BASE };
