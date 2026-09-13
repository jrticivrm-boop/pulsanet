import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getDeviceId, socketAuth } from './deviceId';
import { socketIoOptions, socketUrl } from './socketConfig';

/**
 * Solo cierra sesión si otro dispositivo inició sesión (no si soy yo / mismo equipo).
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
      const except = payload?.deviceId != null ? String(payload.deviceId) : null;
      // El equipo que acaba de entrar no debe cerrarse.
      if (except && mine && except === mine) return;
      try {
        window.alert('Se inició sesión en otro dispositivo. Esta sesión se cerrará.');
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
