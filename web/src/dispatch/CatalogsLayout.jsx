import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/despacho/catalogos/usuarios', label: 'Usuarios' },
  { to: '/despacho/catalogos/grupos', label: 'Grupos' },
  { to: '/despacho/catalogos/geocercas', label: 'Geocercas' },
];

export default function CatalogsLayout() {
  const { pathname } = useLocation();
  if (pathname === '/despacho/catalogos' || pathname === '/despacho/catalogos/') {
    return <Navigate to="/despacho/catalogos/usuarios" replace />;
  }

  return (
    <div className="cc-catalogs">
      <header className="cc-catalogs-head">
        <div>
          <h1>Catálogos</h1>
          <p>Administra usuarios, canales y zonas operativas.</p>
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
