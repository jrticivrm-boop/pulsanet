import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { playGeofenceBellTone, unlockAppNotifyAudio } from '../appNotify.js';
import { pushNotice } from '../notifyCenter.js';
import { isValidMapCoord } from '../panicMaps';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { sessionWireKey, socketWireKey, unwrapDispatchPayload, applyDispatchJoinedWire } from '../wireCrypto.js';

const SOCKET_URL = socketUrl();

/**
 * Campanita + tarjeta (pila global de avisos) al enter/exit de geocerca (consola despacho).
 */
export default function DispatchGeofenceToastHost({ session }) {
  useEffect(() => {
    if (!session?.token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });

    const offWire = applyDispatchJoinedWire(socket);
    socket.on('connect', () => {
      socket.emit('dispatch:join');
    });
    socket.on('reconnect', () => {
      socket.emit('dispatch:join');
    });

    socket.on('dispatch:geofence', (raw) => {
      void (async () => {
        const g = await unwrapDispatchPayload(
          raw,
          socketWireKey(socket, session) || sessionWireKey(session)
        );
        if (!g?.event || !g?.name) return;
        const entra = g.event === 'enter';
        unlockAppNotifyAudio().catch(() => {});
        playGeofenceBellTone({ soft: Boolean(document.hidden) });
        const params = new URLSearchParams();
        if (g.userId) params.set('user', String(g.userId));
        if (isValidMapCoord(g.latitude, g.longitude)) {
          params.set('lat', String(Number(g.latitude)));
          params.set('lng', String(Number(g.longitude)));
          params.set('zoom', '17');
        }
        params.set('t', String(Date.now()));
        pushNotice({
          kind: 'geofence',
          title: `${g.displayName || 'Operador'} ${entra ? 'entró a' : 'salió de'} «${g.name}»`,
          body: entra ? 'Entrada a geocerca' : 'Salida de geocerca',
          userId: g.userId,
          route: `/despacho?${params.toString()}`,
        });
      })();
    });

    return () => {
      try {
        offWire?.();
      } catch {
        /* ignore */
      }
      socket.disconnect();
    };
  }, [session?.token]);

  return null;
}
