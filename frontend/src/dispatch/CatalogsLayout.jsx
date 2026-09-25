import { useEffect, useMemo } from 'react';
import { Outlet, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import ReorderableCatalogTabs from './ReorderableCatalogTabs.jsx';
import {
  matchTabPath,
  readRememberedTab,
  writeRememberedTab,
} from './rememberModuleTab.js';
import { canViewModule, filterTabsByPermission } from './modulePermissions.js';

const MODULE_ID = 'catalogs';
const BASE = '/despacho/catalogos';

const ALL_TABS = [
  { to: `${BASE}/jerarquias`, label: 'Jerarquías', permKey: 'jerarquias' },
  { to: `${BASE}/grados`, label: 'Grados', permKey: 'grados' },
  { to: `${BASE}/empleos`, label: 'Empleos', permKey: 'empleos' },
  { to: `${BASE}/dependencias`, label: 'Dependencias', permKey: 'dependencias' },
];

export default function CatalogsLayout() {
  const { pathname } = useLocation();
  const parentCtx = useOutletContext();
  const session = parentCtx?.session;

  const tabs = useMemo(
    () => filterTabsByPermission(session?.user, 'catalogos', ALL_TABS),
    [session?.user]
  );
  const tabPaths = useMemo(() => tabs.map((t) => t.to), [tabs]);
  const fallback = tabs[0]?.to || `${BASE}/jerarquias`;

  useEffect(() => {
    const matched = matchTabPath(pathname, tabs);
    if (matched) writeRememberedTab(MODULE_ID, matched);
  }, [pathname, tabs]);

  if (session?.user && !canViewModule(session.user, 'catalogos')) {
    return <Navigate to="/despacho" replace />;
  }

  if (pathname === BASE || pathname === `${BASE}/`) {
    const to = readRememberedTab(MODULE_ID, tabPaths, fallback);
    return <Navigate to={to} replace />;
  }
  if (pathname.startsWith(`${BASE}/geocercas`)) {
    return <Navigate to="/despacho" replace />;
  }
  if (pathname.startsWith(`${BASE}/unidades`)) {
    return <Navigate to={BASE + '/dependencias'} replace />;
  }
  if (pathname.startsWith(`${BASE}/grados-empleos`)) {
    return <Navigate to={BASE + '/grados'} replace />;
  }
  if (pathname.startsWith(`${BASE}/usuarios`)) {
    return <Navigate to="/despacho/administracion/usuarios" replace />;
  }
  if (pathname.startsWith(`${BASE}/grupos`)) {
    return <Navigate to="/despacho/administracion/grupos" replace />;
  }
  if (pathname.startsWith(`${BASE}/sitios-tacticos`)) {
    return <Navigate to="/despacho/administracion/sitios-tacticos" replace />;
  }

  if (tabs.length) {
    const allowed = tabPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!allowed) return <Navigate to={fallback} replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Catálogos</h1>
        </div>
        <ReorderableCatalogTabs
          tabs={tabs}
          storageKey="tacticalptx_catalog_tabs_order"
          ariaLabel="Catálogos"
        />
      </header>
      <div className="cc-catalogs-body">
        <Outlet />
      </div>
    </div>
  );
}
