import { useEffect, useRef, useState } from 'react';
import { fetchTrackGapRoute } from '../api';
import { gapKey } from './trackHighlighter.js';

/**
 * Resuelve la ruta por calles de cada hueco de señal.
 *
 * Se pide una sola vez por hueco y se cachea en sessionStorage: el mapa repolla
 * la traza cada pocos segundos y el tramo entre dos coordenadas fijas no cambia.
 * Mientras llega (el OSRM público en frío puede tardar ~20 s), el mapa ya dibuja
 * la estimación punteada y luego se sustituye por la ruta real.
 */

const STORE_KEY = 'tacticalptx_gap_routes_v1';
/** Tope de entradas en sessionStorage (rutas largas pesan). */
const STORE_MAX = 120;
/** Reintentos si salió estimada (OSRM público en frío puede tardar >20 s). */
const MAX_ATTEMPTS = 3;
const RETRY_MS = 25_000;

function loadStore() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(map) {
  try {
    const keys = Object.keys(map);
    const trimmed = keys.length > STORE_MAX
      ? Object.fromEntries(keys.slice(-STORE_MAX).map((k) => [k, map[k]]))
      : map;
    sessionStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {
    /* cuota llena: la caché en memoria sigue sirviendo */
  }
}

/**
 * @param {string} token
 * @param {Array} gaps huecos de `buildHighlighterLayers`
 * @param {{ enabled?: boolean }} [opts]
 * @returns {Record<string, { points: [number,number][], estimated: boolean, source?: string, distanceM?: number, durationS?: number }>}
 */
export function useGapRoutes(token, gaps, { enabled = true } = {}) {
  const [routes, setRoutes] = useState(() => loadStore());
  const [retryTick, setRetryTick] = useState(0);
  const pendingRef = useRef(new Set());
  const attemptsRef = useRef(new Map());

  const wanted = enabled ? (gaps || []).map((g) => ({ key: gapKey(g), gap: g })) : [];
  const wantedKey = wanted.map((w) => w.key).join('|');

  useEffect(() => {
    if (!enabled || !token || !wanted.length) return undefined;
    let cancelled = false;

    const needsFetch = (key) => {
      if (pendingRef.current.has(key)) return false;
      const have = routes[key];
      if (!have) return true;
      // Una estimación no es respuesta final: reintentar unas veces.
      return have.estimated && (attemptsRef.current.get(key) || 0) < MAX_ATTEMPTS;
    };

    const missing = wanted.filter((w) => needsFetch(w.key));
    if (!missing.length) return undefined;

    missing.forEach((w) => pendingRef.current.add(w.key));

    let retryTimer = 0;
    (async () => {
      for (const { key, gap } of missing) {
        attemptsRef.current.set(key, (attemptsRef.current.get(key) || 0) + 1);
        try {
          const data = await fetchTrackGapRoute(token, {
            from: [gap.from.lat, gap.from.lng],
            to: [gap.to.lat, gap.to.lng],
          });
          if (cancelled) return;
          const value = {
            points: data.points || [],
            estimated: Boolean(data.estimated),
            source: data.source,
            distanceM: data.distanceM,
            durationS: data.durationS,
            reason: data.reason,
          };
          setRoutes((prev) => {
            const next = { ...prev, [key]: value };
            // Solo se persiste la ruta real: la estimación debe reintentarse.
            if (!value.estimated) saveStore(next);
            return next;
          });
        } catch {
          /* sin ruta: el mapa mantiene la estimación punteada */
        } finally {
          pendingRef.current.delete(key);
        }
      }
      if (cancelled) return;
      const retryable = missing.some(
        ({ key }) => (attemptsRef.current.get(key) || 0) < MAX_ATTEMPTS
      );
      if (retryable) {
        retryTimer = window.setTimeout(() => setRetryTick((n) => n + 1), RETRY_MS);
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wantedKey resume los huecos
  }, [token, wantedKey, enabled, retryTick]);

  return routes;
}
