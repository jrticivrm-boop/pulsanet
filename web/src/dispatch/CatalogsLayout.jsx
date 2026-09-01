import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/despacho/catalogos/grados-empleos', label: 'Grados y empleos' },
  { to: '/despacho/catalogos/dependencias', label: 'Dependencias' },
  { to: '/despacho/catalogos/usuarios', label: 'Usuarios' },
  { to: '/despacho/catalogos/grupos', label: 'Grupos' },
];

export default function CatalogsLayout() {
  const { pathname } = useLocation();
  if (pathname === '/despacho/catalogos' || pathname === '/despacho/catalogos/') {
    return <Navigate to="/despacho/catalogos/dependencias" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/geocercas')) {
    return <Navigate to="/despacho/mapa" replace />;
  }
  if (pathname.startsWith('/despacho/catalogos/unidades')) {
    return <Navigate to="/despacho/catalogos/dependencias" replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Catálogos</h1>
          <p>Grados, empleos, dependencias militares, usuarios y canales.</p>
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
