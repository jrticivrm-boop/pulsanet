import { useEffect, useRef } from 'react';
import { ensureFreshSession, jwtExpiresAtMs } from './api';

/** Margen antes del vencimiento del JWT para renovar (evita sockets con token muerto). */
const REFRESH_BEFORE_MS = 15 * 60 * 1000;
/** Si no se puede leer exp, renovar cada 3 h (JWT por defecto = 8 h). */
const FALLBACK_REFRESH_MS = 3 * 60 * 60 * 1000;
/** Revisión periódica (no hace fetch si el token aún es fresco). */
const TICK_MS = 60 * 1000;

/**
 * Mantiene viva la sesión en consolas abiertas muchas horas (mapa / despacho 24h+).
 * Renueva el access token antes de que caduque; no cierra sesión ante fallos de red.
 */
export default function SessionKeepaliveHost({ session }) {
  const busyRef = useRef(false);
  const lastOkRef = useRef(Date.now());

  useEffect(() => {
    if (!session?.token) return undefined;

    async function tick(force = false) {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const exp = jwtExpiresAtMs(session.token);
        const soon =
          force ||
          (exp != null
            ? exp - Date.now() <= REFRESH_BEFORE_MS
            : Date.now() - lastOkRef.current >= FALLBACK_REFRESH_MS);
        if (!soon && !force) return;
        const next = await ensureFreshSession({
          minTtlMs: REFRESH_BEFORE_MS,
          force: force || exp == null,
        });
        if (next?.token) lastOkRef.current = Date.now();
      } catch {
        /* red intermitente: reintentará en el próximo tick */
      } finally {
        busyRef.current = false;
      }
    }

    tick(false);
    const id = window.setInterval(() => tick(false), TICK_MS);
    const onVis = () => {
      if (!document.hidden) tick(false);
    };
    const onOnline = () => tick(true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
  }, [session?.token, session?.refreshToken]);

  return null;
}
