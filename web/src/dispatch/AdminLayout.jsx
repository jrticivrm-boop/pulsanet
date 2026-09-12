import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/despacho/administracion/usuarios', label: 'Usuarios' },
  { to: '/despacho/administracion/grupos', label: 'Grupos' },
  { to: '/despacho/administracion/sitios-tacticos', label: 'Sitios tácticos' },
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
          <p>Usuarios, grupos (canales) y sitios tácticos.</p>
        </div>
        <nav className="cc-catalogs-tabs" aria-label="Administración">
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
