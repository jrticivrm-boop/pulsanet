import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/despacho/catalogos/jerarquias', label: 'Jerarquías' },
  { to: '/despacho/catalogos/grados', label: 'Grados' },
  { to: '/despacho/catalogos/empleos', label: 'Empleos' },
  { to: '/despacho/catalogos/dependencias', label: 'Dependencias' },
];

export default function CatalogsLayout() {
  const { pathname } = useLocation();
  if (pathname === '/despacho/catalogos' || pathname === '/despacho/catalogos/') {
    return <Navigate to="/despacho/catalogos/jerarquias" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/geocercas')) {
    return <Navigate to="/despacho" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/unidades')) {
    return <Navigate to="/despacho/catalogos/dependencias" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/grados-empleos')) {
    return <Navigate to="/despacho/catalogos/grados" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/usuarios')) {
    return <Navigate to="/despacho/administracion/usuarios" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/grupos')) {
    return <Navigate to="/despacho/administracion/grupos" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/sitios-tacticos')) {
    return <Navigate to="/despacho/administracion/sitios-tacticos" replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Catálogos</h1>
          <p>Jerarquías, grados, empleos y dependencias.</p>
        </div>
        <nav className="cc-catalogs-tabs" aria-label="Catálogos">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="cc-catalogs-body">
        <Outlet />
      </div>
    </div>
  );
}
