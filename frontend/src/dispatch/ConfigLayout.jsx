import { useEffect, useMemo } from 'react';
import { Outlet, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import ReorderableCatalogTabs from './ReorderableCatalogTabs.jsx';
import {
  matchTabPath,
  readRememberedTab,
  writeRememberedTab,
} from './rememberModuleTab.js';
import { canViewModule, filterTabsByPermission, hasModulesPayload } from './modulePermissions.js';
import { isAdminUser } from '../api';

const MODULE_ID = 'config';
const BASE = '/despacho/configuracion';

export default function ConfigLayout({ session }) {
  const { pathname } = useLocation();
  const parentCtx = useOutletContext();
  const admin = isAdminUser(session?.user);

  const allTabs = useMemo(
    () => [
      { to: `${BASE}/canales`, label: 'Canales', permKey: 'canales' },
      { to: `${BASE}/estados`, label: 'Estados', permKey: 'estados' },
      { to: `${BASE}/respaldos`, label: 'Respaldos', permKey: 'respaldos' },
      { to: `${BASE}/presencia`, label: 'Presencia', permKey: 'presencia' },
      { to: `${BASE}/eventos`, label: 'Eventos', permKey: 'eventos' },
      { to: `${BASE}/auditoria`, label: 'Historial / Auditoría', permKey: 'auditoria' },
    ],
    []
  );

  const tabs = useMemo(() => {
    let list = filterTabsByPermission(session?.user, 'configuracion', allTabs);
    // Sin payload de módulos: conservar filtro legacy (pestañas sensibles solo admin)
    if (!hasModulesPayload(session?.user)) {
      list = allTabs.filter((t) => {
        if (['respaldos', 'presencia', 'eventos', 'auditoria'].includes(t.permKey)) {
          return admin;
        }
        return true;
      });
    }
    return list;
  }, [session?.user, allTabs, admin]);

  const tabPaths = useMemo(() => tabs.map((t) => t.to), [tabs]);
  const fallback = tabs[0]?.to || `${BASE}/canales`;

  useEffect(() => {
    const matched = matchTabPath(pathname, tabs);
    if (matched) writeRememberedTab(MODULE_ID, matched);
  }, [pathname, tabs]);

  if (!canViewModule(session?.user, 'configuracion')) {
    return <Navigate to="/despacho" replace />;
  }

  if (pathname === BASE || pathname === `${BASE}/`) {
    const to = readRememberedTab(MODULE_ID, tabPaths, fallback);
    return <Navigate to={to} replace />;
  }

  // Grabaciones vive en RESERVADO; URL antigua de Configuración redirige ahí
  if (pathname === `${BASE}/grabaciones` || pathname.startsWith(`${BASE}/grabaciones/`)) {
    return <Navigate to="/despacho/video/grabaciones" replace />;
  }

  if (tabs.length) {
    const allowed = tabPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!allowed) return <Navigate to={fallback} replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Configuración</h1>
        </div>
        <ReorderableCatalogTabs
          tabs={tabs}
          storageKey="tacticalptx_config_tabs_order"
          ariaLabel="Configuración"
        />
      </header>
      <div className="cc-catalogs-body">
        <Outlet context={parentCtx} />
      </div>
    </div>
  );
}
