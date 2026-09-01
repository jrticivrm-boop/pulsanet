import { useEffect, useRef } from 'react';
import { postLocation } from './api';

/** Intervalo de envío de GPS a despacho (ms) — mismo latido que la app móvil (~5 s). */
export const GPS_INTERVAL_MS = 5000;

/**
 * Reporta la ubicación del operador autenticado cada ~5 s.
 * Devuelve un ref con la última coordenada (pánico / UI).
 * @param {string|null} token
 * @param {(ok: boolean) => void} [onStatus]
 */
export function useGpsReporter(token, onStatus) {
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const lastRef = useRef({ latitude: null, longitude: null, accuracyM: null });

  useEffect(() => {
    if (!navigator.geolocation || !token) return undefined;
    let cancelled = false;
    let lastSent = 0;

    const send = (pos) => {
      if (cancelled) return;
      lastRef.current = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
      };
      const now = Date.now();
      if (now - lastSent < GPS_INTERVAL_MS - 400) return;
      lastSent = now;
      postLocation(token, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
      })
        .then(() => onStatusRef.current?.(true))
        .catch(() => onStatusRef.current?.(false));
    };

    const fail = () => onStatusRef.current?.(false);

    navigator.geolocation.getCurrentPosition(send, fail, {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 10000,
    });
    const watch = navigator.geolocation.watchPosition(send, fail, {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 10000,
    });
    const ping = setInterval(() => {
      navigator.geolocation.getCurrentPosition(send, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 4000,
        timeout: 8000,
      });
    }, GPS_INTERVAL_MS);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watch);
      clearInterval(ping);
    };
  }, [token]);

  return lastRef;
}
