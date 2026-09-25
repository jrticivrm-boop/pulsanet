import { useEffect, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { isRootUser } from '../api';
import ReorderableCatalogTabs from './ReorderableCatalogTabs.jsx';
import {
  matchTabPath,
  readRememberedTab,
  writeRememberedTab,
} from './rememberModuleTab.js';
import { canViewAdminRail, canViewModule } from './modulePermissions.js';

const MODULE_ID = 'admin';
const BASE = '/despacho/administracion';

export default function AdminLayout({ session }) {
  const { pathname } = useLocation();
  const isRoot = isRootUser(session?.user);

  const tabs = useMemo(() => {
    const list = [];
    if (canViewModule(session?.user, 'usuarios')) {
      list.push({ to: `${BASE}/usuarios`, label: 'Usuarios' });
    }
    if (isRoot) {
      list.push({ to: `${BASE}/perfiles`, label: 'Perfiles' });
    }
    if (canViewModule(session?.user, 'avisos')) {
      list.push({ to: `${BASE}/avisos`, label: 'Avisos' });
    }
    if (canViewModule(session?.user, 'grupos')) {
      list.push({ to: `${BASE}/grupos`, label: 'Grupos' });
    }
    // Sitios: visible si hay rail de administración
    if (canViewAdminRail(session?.user) || isRoot) {
      list.push({ to: `${BASE}/sitios-tacticos`, label: 'Sitios' });
    }
    return list;
  }, [session?.user, isRoot]);

  const tabPaths = useMemo(() => tabs.map((t) => t.to), [tabs]);
  const fallback = tabs[0]?.to || `${BASE}/usuarios`;

  useEffect(() => {
    const matched = matchTabPath(pathname, tabs);
    if (matched) writeRememberedTab(MODULE_ID, matched);
  }, [pathname, tabs]);

  if (!canViewAdminRail(session?.user) && !isRoot) {
    return <Navigate to="/despacho" replace />;
  }

  if (pathname === BASE || pathname === `${BASE}/`) {
    const to = readRememberedTab(MODULE_ID, tabPaths, fallback);
    return <Navigate to={to} replace />;
  }

  if (pathname.startsWith(`${BASE}/perfiles`) && !isRoot) {
    return <Navigate to={fallback} replace />;
  }

  if (pathname.startsWith(`${BASE}/usuarios`) && !canViewModule(session?.user, 'usuarios') && !isRoot) {
    return <Navigate to={fallback} replace />;
  }
  if (pathname.startsWith(`${BASE}/avisos`) && !canViewModule(session?.user, 'avisos') && !isRoot) {
    return <Navigate to={fallback} replace />;
  }
  if (pathname.startsWith(`${BASE}/grupos`) && !canViewModule(session?.user, 'grupos') && !isRoot) {
    return <Navigate to={fallback} replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Administración</h1>
        </div>
        <ReorderableCatalogTabs
          tabs={tabs}
          storageKey="tacticalptx_admin_tabs_order"
          ariaLabel="Administración"
        />
      </header>
      <div className="cc-catalogs-body">
        <Outlet />
      </div>
    </div>
  );
}
