import { useEffect, useRef, useState } from 'react';
import { fetchTrackGapRoute } from '../api';
import { gapKey } from './trackHighlighter.js';

/**
 * Resuelve la ruta por calles de cada hueco de señal.
 *
 * Se pide una sola vez por hueco y se cachea en sessionStorage: el mapa repolla
 * la traza cada pocos segundos y el tramo entre dos coordenadas fijas no cambia.
 * Mientras no haya geometría OSRM válida el mapa NO dibuja recta (evita atajos
 * por campo). Se reintenta con backoff hasta obtener `estimated: false`.
 *
 * Importante: al cancelar el efecto (Strict Mode, cambio de huecos, unmount)
 * hay que soltar las claves de `pendingRef`. Si se marcan todas al inicio y el
 * bucle se aborta a mitad, las restantes quedarían “pending” para siempre y el
 * naranja nunca aparecería (caso Orión con ~37 huecos en 48 h).
 */

const STORE_KEY = 'tacticalptx_gap_routes_v2';
/** Tope de entradas en sessionStorage (rutas largas pesan). */
const STORE_MAX = 120;
/** Reintentos: el demo OSRM público a veces falla en frío / rate-limit. */
const MAX_ATTEMPTS = 8;
const RETRY_MS = 4_000;
/** Peticiones en vuelo hacia la API (cada una llama OSRM en el Host). */
const CONCURRENCY = 6;

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
    const trimmed =
      keys.length > STORE_MAX
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
 * @returns {Record<string, { points: [number,number][], estimated: boolean, source?: string, distanceM?: number, durationS?: number, pending?: boolean }>}
 */
export function useGapRoutes(token, gaps, { enabled = true } = {}) {
  const [routes, setRoutes] = useState(() => loadStore());
  const [retryTick, setRetryTick] = useState(0);
  const pendingRef = useRef(new Set());
  const attemptsRef = useRef(new Map());
  const routesRef = useRef(routes);
  routesRef.current = routes;

  const wanted = enabled ? (gaps || []).map((g) => ({ key: gapKey(g), gap: g })) : [];
  // Huecos largos primero: son los que el operador nota (autopista sin naranja).
  const wantedSorted = [...wanted].sort(
    (a, b) => (Number(b.gap.meters) || 0) - (Number(a.gap.meters) || 0)
  );
  const wantedKey = wantedSorted.map((w) => w.key).join('|');

  useEffect(() => {
    if (!enabled || !token || !wantedSorted.length) return undefined;
    let cancelled = false;
    /** Claves que este efecto marcó; al cleanup se liberan sí o sí. */
    const owned = new Set();

    const needsFetch = (key) => {
      if (pendingRef.current.has(key)) return false;
      const have = routesRef.current[key];
      if (!have) return true;
      if (!have.estimated && Array.isArray(have.points) && have.points.length > 1) {
        return false;
      }
      return (attemptsRef.current.get(key) || 0) < MAX_ATTEMPTS;
    };

    const missing = wantedSorted.filter((w) => needsFetch(w.key));
    if (!missing.length) return undefined;

    missing.forEach((w) => {
      pendingRef.current.add(w.key);
      owned.add(w.key);
    });

    // Estado “pendiente” sin geometría: el mapa puede mostrar indicador sin recta.
    setRoutes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { key } of missing) {
        const have = next[key];
        if (have && !have.estimated && have.points?.length > 1) continue;
        if (have?.pending) continue;
        next[key] = {
          points: [],
          estimated: true,
          pending: true,
          source: have?.source || 'pending',
          distanceM: have?.distanceM ?? null,
          durationS: have?.durationS ?? null,
        };
        changed = true;
      }
      return changed ? next : prev;
    });

    let retryTimer = 0;

    const fetchOne = async ({ key, gap }) => {
      const attempt = (attemptsRef.current.get(key) || 0) + 1;
      attemptsRef.current.set(key, attempt);
      let gotRoad = false;
      try {
        const data = await fetchTrackGapRoute(token, {
          from: [gap.from.lat, gap.from.lng],
          to: [gap.to.lat, gap.to.lng],
        });
        if (cancelled) return false;
        const points = Array.isArray(data.points) ? data.points : [];
        const estimated =
          Boolean(data.estimated) || points.length < 2 || data.source !== 'osrm';
        gotRoad = !estimated;
        const value = {
          points,
          estimated,
          pending: estimated && attempt < MAX_ATTEMPTS,
          source: data.source,
          distanceM: data.distanceM,
          durationS: data.durationS,
          reason: data.reason,
        };
        setRoutes((prev) => {
          const next = { ...prev, [key]: value };
          if (!value.estimated) saveStore(next);
          return next;
        });
      } catch {
        /* sin ruta: no se dibuja recta; el efecto reintenta */
        if (!cancelled) {
          setRoutes((prev) => ({
            ...prev,
            [key]: {
              points: [],
              estimated: true,
              pending: attempt < MAX_ATTEMPTS,
              source: 'pending',
              distanceM: null,
              durationS: null,
              reason: 'error',
            },
          }));
        }
      } finally {
        pendingRef.current.delete(key);
        owned.delete(key);
      }
      return gotRoad;
    };

    (async () => {
      let anyStillPending = false;
      for (let i = 0; i < missing.length; i += CONCURRENCY) {
        if (cancelled) return;
        const batch = missing.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map((w) => fetchOne(w)));
        if (cancelled) return;
        results.forEach((gotRoad, idx) => {
          const key = batch[idx].key;
          if (!gotRoad && (attemptsRef.current.get(key) || 0) < MAX_ATTEMPTS) {
            anyStillPending = true;
          }
        });
      }
      if (cancelled) return;
      if (anyStillPending) {
        retryTimer = window.setTimeout(() => setRetryTick((n) => n + 1), RETRY_MS);
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      // Liberar claves de este efecto: sin esto el naranja se “congela” ausente.
      owned.forEach((k) => pendingRef.current.delete(k));
      owned.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wantedKey resume los huecos
  }, [token, wantedKey, enabled, retryTick]);

  return routes;
}
