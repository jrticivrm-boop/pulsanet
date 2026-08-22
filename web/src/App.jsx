import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { canDispatch, changePassword, login } from './api';
import { ThemeToggle } from './theme';
import BrandName from './BrandName.jsx';
import RadioPage from './pages/RadioPage.jsx';
import DispatchLayout from './dispatch/DispatchLayout.jsx';
import CommandCenter from './dispatch/CommandCenter.jsx';
import DispatchMap from './dispatch/DispatchMap.jsx';
import DispatchUsers from './dispatch/DispatchUsers.jsx';
import DispatchGroups from './dispatch/DispatchGroups.jsx';
import LiveTrackMap from './dispatch/LiveTrackMap.jsx';
import CatalogsLayout from './dispatch/CatalogsLayout.jsx';
import GeofenceCatalog from './dispatch/GeofenceCatalog.jsx';

const STORAGE_KEY = 'tacticalptx_session';

function loadSession() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('pulsanet_session') ||
      localStorage.getItem('pulsanet_demo_session');
    return JSON.parse(raw || 'null');
  } catch {
    return null;
  }
}

function needsPasswordChange(session) {
  return Boolean(session?.user?.mustChangePassword);
}

function homeFor(user) {
  return canDispatch(user) ? '/despacho' : '/radio';
}

export default function App() {
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    function onSession(e) {
      if (e.detail) setSession(e.detail);
    }
    window.addEventListener('tacticalptx:session', onSession);
    return () => window.removeEventListener('tacticalptx:session', onSession);
  }, []);

  function saveSession(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          session ? (
            <Navigate
              to={needsPasswordChange(session) ? '/cambiar-clave' : homeFor(session.user)}
              replace
            />
          ) : (
            <LoginPage onLogin={saveSession} />
          )
        }
      />
      <Route
        path="/cambiar-clave"
        element={
          session ? (
            needsPasswordChange(session) ? (
              <ChangePasswordPage session={session} onDone={saveSession} onLogout={logout} />
            ) : (
              <Navigate to={homeFor(session.user)} replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/radio"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : needsPasswordChange(session) ? (
            <Navigate to="/cambiar-clave" replace />
          ) : (
            <RadioPage session={session} onLogout={logout} />
          )
        }
      />
      <Route
        path="/despacho"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : needsPasswordChange(session) ? (
            <Navigate to="/cambiar-clave" replace />
          ) : session && canDispatch(session.user) ? (
            <DispatchLayout session={session} onLogout={logout} />
          ) : (
            <Navigate to="/radio" replace />
          )
        }
      >
        <Route index element={<CommandCenter session={session} />} />
        <Route path="seguimiento" element={<LiveTrackMap session={session} />} />
        <Route path="mapa" element={<DispatchMap session={session} />} />
        <Route path="catalogos" element={<CatalogsLayout />}>
          <Route path="usuarios" element={<DispatchUsers session={session} />} />
          <Route path="grupos" element={<DispatchGroups session={session} />} />
          <Route path="geocercas" element={<GeofenceCatalog session={session} />} />
        </Route>
        <Route path="usuarios" element={<Navigate to="/despacho/catalogos/usuarios" replace />} />
        <Route path="grupos" element={<Navigate to="/despacho/catalogos/grupos" replace />} />
      </Route>
      <Route
        path="*"
        element={
          <Navigate
            to={
              !session
                ? '/login'
                : needsPasswordChange(session)
                  ? '/cambiar-clave'
                  : homeFor(session.user)
            }
            replace
          />
        }
      />
    </Routes>
  );
}

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleLogin(e) {
    e?.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const data = await login(username.trim().toLowerCase(), password);
      const next = {
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      };
      onLogin(next);
      navigate(data.user?.mustChangePassword ? '/cambiar-clave' : homeFor(data.user));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero" aria-label="TacticalPtx">
        <div className="login-hero-glow" aria-hidden="true" />
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-brand">
          <img className="login-hero-mark" src="/brand/tacticalptx.png" alt="TacticalPtx" />
          <BrandName size="lg" />
        </div>
        <p className="login-hero-line">Radio institucional PTT · operación y despacho.</p>
      </section>

      <section className="login-side">
        <div className="login-card">
          <div className="login-card-tools">
            <ThemeToggle />
          </div>
          <header className="login-card-head">
            <h1>Iniciar sesión</h1>
            <p>Accede con tu usuario corporativo.</p>
          </header>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Usuario
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                autoComplete="username"
                spellCheck={false}
                placeholder="Ej. ggomezd2"
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {err && <p className="error">{err}</p>}
            <button type="submit" className="btn primary login-submit" disabled={busy}>
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function ChangePasswordPage({ session, onDone, onLogout }) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setErr('La confirmación no coincide');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const data = await changePassword(session.token, {
        currentPassword,
        newPassword,
      });
      onDone({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      navigate(homeFor(data.user));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero" aria-label="TacticalPtx">
        <div className="login-hero-glow" aria-hidden="true" />
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-brand">
          <img className="login-hero-mark" src="/brand/tacticalptx.png" alt="TacticalPtx" />
          <BrandName size="lg" />
        </div>
        <p className="login-hero-line">Debes cambiar tu contraseña temporal.</p>
      </section>

      <section className="login-side">
        <div className="login-card">
          <div className="login-card-tools">
            <ThemeToggle />
          </div>
          <header className="login-card-head">
            <h1>Cambiar contraseña</h1>
            <p>
              Hola {session.user?.displayName || session.user?.username}. Elige una contraseña
              nueva (mín. 8 caracteres, con letras y números).
            </p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              Contraseña temporal
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Nueva contraseña
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
            <label>
              Confirmar nueva
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
            {err && <p className="error">{err}</p>}
            <button type="submit" className="btn primary login-submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar y continuar'}
            </button>
            <button type="button" className="btn ghost" onClick={onLogout} disabled={busy}>
              Cerrar sesión
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
