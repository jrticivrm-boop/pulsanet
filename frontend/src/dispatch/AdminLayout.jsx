import { useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { isRootUser } from '../api';
import ReorderableCatalogTabs from './ReorderableCatalogTabs.jsx';

export default function AdminLayout({ session }) {
  const { pathname } = useLocation();
  const isRoot = isRootUser(session?.user);

  const tabs = useMemo(
    () => [
      { to: '/despacho/administracion/usuarios', label: 'Usuarios' },
      ...(isRoot ? [{ to: '/despacho/administracion/perfiles', label: 'Perfiles' }] : []),
      { to: '/despacho/administracion/avisos', label: 'Avisos' },
      { to: '/despacho/administracion/grupos', label: 'Grupos' },
      { to: '/despacho/administracion/sitios-tacticos', label: 'Sitios' },
    ],
    [isRoot]
  );

  if (pathname === '/despacho/administracion' || pathname === '/despacho/administracion/') {
    return <Navigate to="/despacho/administracion/usuarios" replace />;
  }

  if (pathname.startsWith('/despacho/administracion/perfiles') && !isRoot) {
    return <Navigate to="/despacho/administracion/usuarios" replace />;
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
