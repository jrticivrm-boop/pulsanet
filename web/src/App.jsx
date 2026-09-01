import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { canDispatch, changePassword, fetchAuthMe, login, persistSession, isAdminUser } from './api';
import { ThemeToggle } from './theme';
import BrandName from './BrandName.jsx';
import { ensureNotifyServiceWorker } from './appNotify.js';
import GlobalChatNotifyHost from './GlobalChatNotifyHost.jsx';
import RadioPage from './pages/RadioPage.jsx';
import DispatchLayout from './dispatch/DispatchLayout.jsx';
import CommandCenter from './dispatch/CommandCenter.jsx';
import DispatchMap from './dispatch/DispatchMap.jsx';
import DispatchUsers from './dispatch/DispatchUsers.jsx';
import DispatchGroups from './dispatch/DispatchGroups.jsx';
import LiveTrackMap from './dispatch/LiveTrackMap.jsx';
import CatalogsLayout from './dispatch/CatalogsLayout.jsx';
import CatalogGradesEmpleos from './dispatch/CatalogGradesEmpleos.jsx';
import DispatchDependencias from './dispatch/DispatchDependencias.jsx';
import ConfigLayout from './dispatch/ConfigLayout.jsx';
import ConfigBackups from './dispatch/ConfigBackups.jsx';
import ConfigAudit from './dispatch/ConfigAudit.jsx';
import ConfigChannels from './dispatch/ConfigChannels.jsx';

const STORAGE_KEY = 'tacticalptx_session';

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || 'null');
    if (!parsed) return null;
    if (parsed.crypto) {
      parsed.crypto = {
        alg: parsed.crypto.alg,
        wireEnabled: Boolean(parsed.crypto.wireEnabled),
      };
    }
    return parsed;
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

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <div className="password-field">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={visible ? 'Ocultar' : 'Mostrar'}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
              />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

export default function App() {
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    if (!session?.token) return;
    ensureNotifyServiceWorker().catch(() => {});
  }, [session?.token]);

  useEffect(() => {
    function onSession(e) {
      if (e.detail) setSession(e.detail);
    }
    window.addEventListener('tacticalptx:session', onSession);
    return () => window.removeEventListener('tacticalptx:session', onSession);
  }, []);

  // Rehidratar wireKey / avatar (no se guardan en localStorage) para radio y despacho.
  useEffect(() => {
    if (!session?.token) return;
    if (session.crypto?.wireKey && session.avatarTicket) return;
    let cancelled = false;
    fetchAuthMe(session.token)
      .then((data) => {
        if (cancelled || !data) return;
        const next = {
          ...session,
          user: data.user || session.user,
          crypto: data.crypto || session.crypto,
          avatarTicket: data.avatarTicket || session.avatarTicket,
        };
        persistSession(next);
        setSession(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar token
  }, [session?.token]);

  function saveSession(next) {
    persistSession(next);
    setSession(next);
  }

  function logout() {
    persistSession(null);
    setSession(null);
  }

  return (
    <>
      {session?.token ? <GlobalChatNotifyHost session={session} /> : null}
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
          ) : canDispatch(session.user) ? (
            <Navigate to="/despacho/radio" replace />
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
            <DispatchLayout session={session} onLogout={logout} onSession={saveSession} />
          ) : (
            <Navigate to="/radio" replace />
          )
        }
      >
        <Route index element={<CommandCenter session={session} />} />
        <Route path="seguimiento" element={<LiveTrackMap session={session} />} />
        <Route path="mapa" element={<DispatchMap session={session} />} />
        <Route path="radio" element={null} />
        <Route path="catalogos" element={<CatalogsLayout />}>
          <Route path="grados-empleos" element={<CatalogGradesEmpleos session={session} />} />
          <Route path="dependencias" element={<DispatchDependencias session={session} />} />
          <Route path="unidades" element={<Navigate to="/despacho/catalogos/dependencias" replace />} />
          <Route path="usuarios" element={<DispatchUsers session={session} />} />
          <Route path="grupos" element={<DispatchGroups session={session} />} />
          <Route path="geocercas" element={<Navigate to="/despacho/mapa" replace />} />
        </Route>
        <Route
          path="configuracion"
          element={session ? <ConfigLayout session={session} /> : <Navigate to="/login" replace />}
        >
          <Route path="canales" element={<ConfigChannels />} />
          <Route
            path="respaldos"
            element={
              isAdminUser(session?.user) ? (
                <ConfigBackups session={session} />
              ) : (
                <Navigate to="/despacho/configuracion/canales" replace />
              )
            }
          />
          <Route
            path="auditoria"
            element={
              isAdminUser(session?.user) ? (
                <ConfigAudit session={session} />
              ) : (
                <Navigate to="/despacho/configuracion/canales" replace />
              )
            }
          />
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
    </>
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
        crypto: data.crypto || undefined,
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
        <div className="login-hero-veil" aria-hidden="true" />
        <div className="login-brand">
          <img className="login-hero-mark" src="/brand/tacticalptx.png" alt="" />
          <BrandName size="lg" className="login-brand-name" />
          <span className="login-hero-kicker">Radio institucional</span>
        </div>
        <p className="login-hero-line">
          Voz PTT, mensajes y despacho en un solo enlace seguro.
        </p>
      </section>

      <section className="login-side">
        <div className="login-card">
          <div className="login-card-accent" aria-hidden="true" />
          <div className="login-card-tools">
            <ThemeToggle />
          </div>
          <header className="login-card-head">
            <h1>Iniciar sesión</h1>
            <p>Usuario corporativo</p>
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
            <PasswordField
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
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
        crypto: data.crypto || session.crypto,
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
        <div className="login-hero-veil" aria-hidden="true" />
        <div className="login-brand">
          <img className="login-hero-mark" src="/brand/tacticalptx.png" alt="" />
          <BrandName size="lg" className="login-brand-name" />
          <span className="login-hero-kicker">Radio institucional</span>
        </div>
        <p className="login-hero-line">Actualiza tu contraseña temporal para continuar.</p>
      </section>

      <section className="login-side">
        <div className="login-card">
          <div className="login-card-accent" aria-hidden="true" />
          <div className="login-card-tools">
            <ThemeToggle />
          </div>
          <header className="login-card-head">
            <h1>Cambiar contraseña</h1>
            <p>Acceso seguro</p>
          </header>
          <p className="login-card-note">
            Hola {session.user?.displayName || session.user?.username}. Elige una contraseña
            nueva (mín. 8 caracteres, con letras y números).
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <PasswordField
              label="Contraseña temporal"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <PasswordField
              label="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
            <PasswordField
              label="Confirmar nueva"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
            {err && <p className="error">{err}</p>}
            <button type="submit" className="btn primary login-submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar y continuar'}
            </button>
            <button type="button" className="btn ghost" onClick={onLogout} disabled={busy}>
              Salir
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

