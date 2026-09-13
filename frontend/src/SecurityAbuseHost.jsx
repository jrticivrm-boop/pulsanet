import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { socketAuth } from './deviceId';
import { socketIoOptions, socketUrl } from './socketConfig';
import { canManageUsers, isAdminUser } from './api';

/**
 * Warning en consola cuando hay excesos de intentos de login / bloqueo de cuenta.
 * No afecta lockdown global (ese es emergencia aparte).
 */
export default function SecurityAbuseHost({ session }) {
  const [banner, setBanner] = useState(null);
  const hideTimer = useRef(null);

  const canSee =
    session?.token &&
    (canManageUsers(session.user) || isAdminUser(session.user) || session.user?.role === 'dispatcher');

  useEffect(() => {
    if (!canSee) return undefined;
    const socket = io(socketUrl(), {
      ...socketIoOptions,
      auth: socketAuth(session.token),
    });
    const onAbuse = (payload) => {
      if (!payload || payload.action === 'unlocked') return;
      const who = payload.displayName || payload.username || 'usuario';
      const ip = payload.ip ? ` · IP ${payload.ip}` : '';
      const fails = payload.failCount != null ? ` · ${payload.failCount} fallos` : '';
      let msg = '';
      if (payload.action === 'locked') {
        msg = `Usuario bloqueado: ${who}${ip}${fails}. Debe contactar a un administrador.`;
      } else if (payload.action === 'warned' || payload.action === 'root_warn') {
        msg = `Aviso de seguridad: demasiados intentos de ingreso de ${who}${ip}${fails}.`;
      } else if (payload.action === 'ip_throttle') {
        msg = `Aviso: muchos fallos de login desde la misma IP${ip}.`;
      } else {
        msg = `Aviso de seguridad (login): ${who}${ip}${fails}.`;
      }
      setBanner({ level: payload.level || 'warning', text: msg, at: payload.at });
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setBanner(null), 20000);
    };
    socket.on('security:login_abuse', onAbuse);
    return () => {
      socket.off('security:login_abuse', onAbuse);
      socket.disconnect();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [canSee, session?.token]);

  if (!banner) return null;
  return (
    <div
      role="status"
      className="security-abuse-banner"
      style={{
        position: 'fixed',
        top: '0.75rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000,
        maxWidth: 'min(42rem, 94vw)',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: '#7a5b00',
        color: '#fff8e6',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        fontSize: '0.92rem',
        lineHeight: 1.35,
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Advertencia de seguridad</strong>
      {banner.text}
      <button
        type="button"
        onClick={() => setBanner(null)}
        style={{
          marginLeft: '0.75rem',
          border: 0,
          background: 'transparent',
          color: 'inherit',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        Cerrar
      </button>
    </div>
  );
}
