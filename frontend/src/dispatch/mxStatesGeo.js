/**
 * Geometrías de los 32 estados para la capa de delimitación.
 *
 * **Fuente única** para los 32: geoBoundaries gbOpen MEX ADM1 (origen INEGI,
 * CC BY 3.0 IGO), simplificada con mapshaper a ~100 m preservando topología.
 * Los dos archivos salen de la MISMA corrida, así que los límites entre
 * estados vecinos son arcos con vértices idénticos.
 *
 * - `data/ivRmStates.json`: subconjunto NL/TM/SLP, empaquetado en el bundle
 *   para que la IV R.M. y el FitBounds pinten sin esperar red.
 * - `public/geo/mxEstados.json`: los 32, bajo demanda (solo si se habilita
 *   algún estado fuera de la IV R.M.).
 *
 * No mezclar nunca fuentes distintas aquí: mezclar deja rendijas y solapes en
 * cada frontera compartida (ver bitácora 2026-09-12).
 *
 * Renderer: L.svg (ver IvRmStatesLayer). L.canvas fallaba el fill en densos.
 */
import ivRmStates from './data/ivRmStates.json';

/** Cache-bust: obliga a soltar el mxEstados anterior (mexicoHigh, desalineado). */
const EXTRA_URL = '/geo/mxEstados.json?v=inegi-20260912';

export const BUNDLED_STATE_IDS = new Set(
  (ivRmStates.features || []).map((f) => f?.properties?.id).filter(Boolean)
);

let extraCache = null;
let extraPending = null;

/** Features ya descargadas (o null si aún no). Sin efectos secundarios. */
export function loadedExtraStates() {
  return extraCache;
}

/** Descarga (una sola vez por sesión) el FeatureCollection de 32 estados. */
export function loadExtraStates() {
  if (extraCache) return Promise.resolve(extraCache);
  if (extraPending) return extraPending;
  extraPending = fetch(EXTRA_URL, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((fc) => {
      const features = Array.isArray(fc?.features) ? fc.features : [];
      if (!features.length) return null;
      extraCache = features;
      return extraCache;
    })
    .catch(() => null)
    .finally(() => {
      extraPending = null;
    });
  return extraPending;
}

/**
 * Features para dibujar, deduplicadas por `properties.id`.
 * Orden: mxEstados primero; luego el subconjunto del bundle **gana**. Ambos
 * vienen de la misma corrida, así que el ganador es indistinto para NL/TM/SLP.
 */
export function availableStateFeatures(extraFeatures) {
  const byId = new Map();
  for (const f of extraFeatures || []) {
    const id = f?.properties?.id;
    if (id) byId.set(id, f);
  }
  for (const f of ivRmStates.features || []) {
    const id = f?.properties?.id;
    if (id) byId.set(id, f); /* detallado IV R.M. gana */
  }
  return [...byId.values()];
}

export { ivRmStates };
