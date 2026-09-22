import { useEffect, useRef } from 'react';
import { fetchGpsSettings, postLocation } from './api';
import {
  GPS_MAX_ACCURACY_M,
  createGpsWarmupGate,
  isAbsurdGpsJump,
  isAccuracyAcceptable,
  softSmoothFix,
} from './gpsQuality';

/** Intervalo por defecto (ms) si el servidor no responde. */
export const GPS_INTERVAL_MS = 5000;

/** No reutilizar fixes viejos del navegador. */
const GEO_MAXIMUM_AGE_MS = 1000;

const GEO_OPTS = {
  enableHighAccuracy: true,
  maximumAge: GEO_MAXIMUM_AGE_MS,
  timeout: 10000,
};

/**
 * Reporta la ubicación del operador autenticado.
 * Umbral e intervalo vienen de la org (`/api/me/gps-settings`); fallback a defaults.
 * @param {string|null} token
 * @param {(ok: boolean) => void} [onStatus]
 */
export function useGpsReporter(token, onStatus) {
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const lastRef = useRef({ latitude: null, longitude: null, accuracyM: null });
  const policyRef = useRef({
    maxAccuracyM: GPS_MAX_ACCURACY_M,
    intervalMs: GPS_INTERVAL_MS,
  });

  useEffect(() => {
    if (!navigator.geolocation || !token) return undefined;
    let cancelled = false;
    let lastSent = 0;
    /** @type {{ latitude: number, longitude: number, accuracyM: number|null, t: number }|null} */
    let lastAccepted = null;
    const warmup = createGpsWarmupGate();
    let ping = null;

    const applyPolicy = (gps) => {
      const maxAccuracyM = Number(gps?.maxAccuracyM) || GPS_MAX_ACCURACY_M;
      const sec = Number(gps?.intervalSec) || 5;
      policyRef.current = {
        maxAccuracyM: Math.min(200, Math.max(10, maxAccuracyM)),
        intervalMs: Math.min(60_000, Math.max(2000, sec * 1000)),
      };
    };

    const restartPing = () => {
      if (ping) clearInterval(ping);
      const ms = policyRef.current.intervalMs;
      ping = setInterval(() => {
        navigator.geolocation.getCurrentPosition(send, () => {}, {
          ...GEO_OPTS,
          timeout: 8000,
        });
      }, ms);
    };

    const send = (pos) => {
      if (cancelled) return;
      const accuracyM =
        pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
          ? pos.coords.accuracy
          : null;

      lastRef.current = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM,
      };

      const { maxAccuracyM, intervalMs } = policyRef.current;
      if (!isAccuracyAcceptable(accuracyM, maxAccuracyM)) return;
      if (!warmup.allow(accuracyM)) return;

      const raw = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM,
        t: Date.now(),
      };

      if (lastAccepted && isAbsurdGpsJump(lastAccepted, raw)) return;

      const smoothed = softSmoothFix(lastAccepted, raw);
      const now = Date.now();
      if (now - lastSent < intervalMs - 400) return;
      lastSent = now;
      lastAccepted = { ...smoothed, t: now };

      postLocation(token, {
        latitude: smoothed.latitude,
        longitude: smoothed.longitude,
        accuracyM: smoothed.accuracyM,
      })
        .then(() => onStatusRef.current?.(true))
        .catch(() => onStatusRef.current?.(false));
    };

    const fail = () => onStatusRef.current?.(false);

    const boot = async () => {
      try {
        const data = await fetchGpsSettings(token);
        if (!cancelled && data?.gps) applyPolicy(data.gps);
      } catch {
        /* defaults */
      }
      if (cancelled) return;
      navigator.geolocation.getCurrentPosition(send, fail, GEO_OPTS);
      restartPing();
    };

    const watch = navigator.geolocation.watchPosition(send, fail, GEO_OPTS);
    boot();

    const refresh = setInterval(() => {
      fetchGpsSettings(token)
        .then((data) => {
          if (cancelled || !data?.gps) return;
          const prev = policyRef.current.intervalMs;
          applyPolicy(data.gps);
          if (policyRef.current.intervalMs !== prev) restartPing();
        })
        .catch(() => {});
    }, 60_000);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watch);
      if (ping) clearInterval(ping);
      clearInterval(refresh);
    };
  }, [token]);

  return lastRef;
}
