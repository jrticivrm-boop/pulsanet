import { Outlet, Navigate, useLocation } from 'react-router-dom';
import ReorderableCatalogTabs from './ReorderableCatalogTabs.jsx';

const TABS = [
  { to: '/despacho/administracion/usuarios', label: 'Usuarios' },
  { to: '/despacho/administracion/grupos', label: 'Grupos' },
  { to: '/despacho/administracion/sitios-tacticos', label: 'Sitios' },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  if (pathname === '/despacho/administracion' || pathname === '/despacho/administracion/') {
    return <Navigate to="/despacho/administracion/usuarios" replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Administración</h1>
        </div>
        <ReorderableCatalogTabs
          tabs={TABS}
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
