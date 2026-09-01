import { NavLink, Outlet, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import { isAdminUser } from '../api';

export default function ConfigLayout({ session }) {
  const { pathname } = useLocation();
  const parentCtx = useOutletContext();
  const admin = isAdminUser(session?.user);

  if (pathname === '/despacho/configuracion' || pathname === '/despacho/configuracion/') {
    return <Navigate to="/despacho/configuracion/canales" replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Configuración</h1>
          <p>Preferencias de radio y operación del sistema.</p>
        </div>
        <nav className="cc-catalogs-tabs" aria-label="Configuración">
          <NavLink
            to="/despacho/configuracion/canales"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Canales
          </NavLink>
          {admin && (
            <NavLink
              to="/despacho/configuracion/respaldos"
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Respaldos
            </NavLink>
          )}
          {admin && (
            <NavLink
              to="/despacho/configuracion/auditoria"
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Historial / Auditoría
            </NavLink>
          )}
        </nav>
      </header>
      <div className="cc-catalogs-body">
        <Outlet context={parentCtx} />
      </div>
    </div>
  );
}
