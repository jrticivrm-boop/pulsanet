import { useMemo } from 'react';
import { Outlet, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import { isAdminUser } from '../api';
import ReorderableCatalogTabs from './ReorderableCatalogTabs.jsx';

export default function ConfigLayout({ session }) {
  const { pathname } = useLocation();
  const parentCtx = useOutletContext();
  const admin = isAdminUser(session?.user);

  const tabs = useMemo(
    () => [
      { to: '/despacho/configuracion/canales', label: 'Canales' },
      { to: '/despacho/configuracion/grabaciones', label: 'Grabaciones' },
      { to: '/despacho/configuracion/estados', label: 'Estados' },
      ...(admin
        ? [
            { to: '/despacho/configuracion/respaldos', label: 'Respaldos' },
            { to: '/despacho/configuracion/presencia', label: 'Presencia' },
            { to: '/despacho/configuracion/auditoria', label: 'Historial / Auditoría' },
          ]
        : []),
    ],
    [admin]
  );

  if (pathname === '/despacho/configuracion' || pathname === '/despacho/configuracion/') {
    return <Navigate to="/despacho/configuracion/canales" replace />;
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
