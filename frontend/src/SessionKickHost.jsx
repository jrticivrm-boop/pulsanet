import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getDeviceId, socketAuth } from './deviceId';
import { socketIoOptions, socketUrl } from './socketConfig';

function sessionKickMessage(payload) {
  const reason = payload?.reason != null ? String(payload.reason) : '';
  const custom = payload?.message != null ? String(payload.message).trim() : '';
  if (reason === 'force_logout') {
    return custom || 'Tu sesión fue cerrada por un administrador.';
  }
  if (custom && reason && reason !== 'login_elsewhere') {
    return custom;
  }
  if (reason === 'login_elsewhere') {
    return custom || 'Se inició sesión en otro dispositivo. Esta sesión se cerrará.';
  }
  return custom || 'Se inició sesión en otro dispositivo. Esta sesión se cerrará.';
}

/**
 * Cierra sesión ante session:replaced / bloqueo.
 * force_logout: mensaje de admin; login_elsewhere: otro dispositivo (salvo el que acaba de entrar).
 */
export default function SessionKickHost({ session, onLogout }) {
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    if (!session?.token) return undefined;
    const mine = getDeviceId();
    const socket = io(socketUrl(), {
      ...socketIoOptions,
      auth: socketAuth(session.token),
    });
    const onReplaced = (payload) => {
      const reason = payload?.reason != null ? String(payload.reason) : '';
      const except = payload?.deviceId != null ? String(payload.deviceId) : null;
      // Solo el equipo que acaba de entrar ignora login_elsewhere.
      if (reason !== 'force_logout' && except && mine && except === mine) return;
      try {
        window.alert(sessionKickMessage(payload));
      } catch {
        /* ignore */
      }
      onLogoutRef.current?.();
    };
    socket.on('session:replaced', onReplaced);
    const onUserLocked = () => {
      try {
        window.alert(
          'Tu usuario fue bloqueado por exceso de intentos de ingreso. Contacta a un administrador.'
        );
      } catch {
        /* ignore */
      }
      onLogoutRef.current?.();
    };
    socket.on('security:user_locked', onUserLocked);
    return () => {
      socket.off('session:replaced', onReplaced);
      socket.off('security:user_locked', onUserLocked);
      socket.disconnect();
    };
  }, [session?.token]);

  return null;
}
