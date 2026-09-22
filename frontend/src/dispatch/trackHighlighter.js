/**
 * Geometría del trazo «marcatextos» de la ruta histórica.
 *
 * Dos cosas que la Polyline única no podía hacer:
 *  1) Intensidad acumulativa: un tramo repasado varias veces se ve más opaco.
 *     Se cuentan PASADAS por tramo (no puntos), snapeando a una celda de ~44 m,
 *     y la cuenta se mapea a opacidad/grosor por capas.
 *  2) Cortar en los huecos de señal: antes el salto Tampico→Reynosa se pintaba
 *     como una recta verde, indistinguible de un recorrido real.
 */

/** Celda de agrupación de tramos (grados). ~44 m: alineado al ancho del trazo. */
export const DEFAULT_CELL_DEG = 0.0004;
/** Dos usos del mismo tramo separados por menos de esto son la misma pasada. */
export const DEFAULT_PASS_SEPARATION_S = 120;

/**
 * Capas del marcatextos: más pasadas = más opaco y ligeramente más grueso.
 * El techo se queda en 0.66: un marcatextos nunca llega a tapar del todo.
 */
export const HIGHLIGHTER_TIERS = [
  { minPasses: 1, opacity: 0.26, weight: 12 },
  { minPasses: 2, opacity: 0.36, weight: 13 },
  { minPasses: 3, opacity: 0.46, weight: 14 },
  { minPasses: 4, opacity: 0.56, weight: 15 },
  { minPasses: 5, opacity: 0.66, weight: 16 },
];

/** Umbrales de hueco de señal (celular apagado / sin cobertura). */
export const DEFAULT_GAP_OPTS = {
  /** Silencio mínimo: el latido GPS es de 5 s, 2 min son ~24 latidos perdidos. */
  minSeconds: 120,
  /** Por debajo es deriva de GPS o un túnel: interpolar no aporta nada. */
  minMeters: 300,
  /** Desplazamiento así de grande es hueco aunque los timestamps estén cerca. */
  jumpMeters: 700,
};

const EARTH_R = 6371000;

export function haversineM(aLat, aLng, bLat, bLng) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function atMs(value) {
  if (value == null) return 0;
  if (value instanceof Date) return value.getTime();
  let s = String(value).trim();
  // pg sin zona ("YYYY-MM-DD HH:MM:SS") se interpreta como UTC, igual que liveTiming.
  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)
  ) {
    s = `${s.replace(' ', 'T')}Z`;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Acepta `{ latitude, longitude, recordedAt }` (API) o `[lat, lng]` (rastro en vivo).
 * @returns {{ lat: number, lng: number, t: number }[]}
 */
export function normalizeTrackPoints(points) {
  const out = [];
  for (const p of points || []) {
    if (Array.isArray(p)) {
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng, t: 0 });
      continue;
    }
    if (!p) continue;
    const lat = Number(p.latitude ?? p.lat);
    const lng = Number(p.longitude ?? p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const point = { lat, lng, t: atMs(p.recordedAt ?? p.t) };
    if (p.gapBefore) {
      point.gapBefore = true;
      point.gapMeters = Number(p.gapMeters) || 0;
      point.gapSeconds = Number(p.gapSeconds) || 0;
    }
    out.push(point);
  }
  return out;
}

/**
 * Rumbo inicial (grados 0–360) del tramo previo al hueco, si hay ≥2 fixes.
 * Sirve para la estimación por dead-reckoning cuando OSRM no responde.
 */
export function approachBearingDeg(pts, gapIndex) {
  if (!pts || gapIndex < 1) return null;
  const to = pts[gapIndex - 1];
  const from = gapIndex >= 2 ? pts[gapIndex - 2] : null;
  if (!from || !to) return null;
  const d = haversineM(from.lat, from.lng, to.lat, to.lng);
  if (d < 25) return null;
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Huecos de señal entre fixes consecutivos.
 *
 * Prioriza marcas del servidor (`gapBefore`). Además, en trazas ya marcadas
 * también corta saltos espaciales grandes sin marca (cuerdas verdes post-RDP
 * que el backend no remarcó). El heurístico temporal completo queda para
 * trazas sin marcas (rastro en vivo, pares [lat,lng]).
 *
 * @returns {{ index: number, from: object, to: object, meters: number, seconds: number, server: boolean, bearingDeg?: number|null }[]}
 */
export function detectTrackGaps(pts, opts = {}) {
  const { minSeconds, minMeters, jumpMeters } = { ...DEFAULT_GAP_OPTS, ...opts };
  const gaps = [];
  const seen = new Set();
  const serverMarked = pts.some((p) => p.gapBefore);

  if (serverMarked) {
    for (let i = 1; i < pts.length; i += 1) {
      if (!pts[i].gapBefore) continue;
      seen.add(i);
      gaps.push({
        index: i,
        from: pts[i - 1],
        to: pts[i],
        meters: pts[i].gapMeters || haversineM(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng),
        seconds: pts[i].gapSeconds || 0,
        server: true,
        bearingDeg: approachBearingDeg(pts, i),
      });
    }
    // Cuerdas post-simplificar sin gapBefore: solo salto espacial (no tiempo).
    for (let i = 1; i < pts.length; i += 1) {
      if (seen.has(i)) continue;
      const a = pts[i - 1];
      const b = pts[i];
      const meters = haversineM(a.lat, a.lng, b.lat, b.lng);
      if (meters > jumpMeters) {
        gaps.push({
          index: i,
          from: a,
          to: b,
          meters,
          seconds: a.t && b.t ? (b.t - a.t) / 1000 : 0,
          server: false,
          bearingDeg: approachBearingDeg(pts, i),
        });
      }
    }
    return gaps;
  }

  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const meters = haversineM(a.lat, a.lng, b.lat, b.lng);
    const seconds = a.t && b.t ? (b.t - a.t) / 1000 : 0;
    if (meters > minMeters && (seconds > minSeconds || meters > jumpMeters)) {
      gaps.push({
        index: i,
        from: a,
        to: b,
        meters,
        seconds,
        server: false,
        bearingDeg: approachBearingDeg(pts, i),
      });
    }
  }
  return gaps;
}

function cellOf(p, cellDeg) {
  return `${Math.round(p.lat / cellDeg)}:${Math.round(p.lng / cellDeg)}`;
}

function tierIndexFor(passes) {
  let idx = 0;
  for (let i = 0; i < HIGHLIGHTER_TIERS.length; i += 1) {
    if (passes >= HIGHLIGHTER_TIERS[i].minPasses) idx = i;
  }
  return idx;
}

/**
 * Convierte la traza en capas de marcatextos + los huecos a predecir.
 *
 * @param {Array} points puntos de la API o pares [lat,lng]
 * @param {{ cellDeg?: number, passSeparationS?: number, gap?: object, detectGaps?: boolean }} [opts]
 * @returns {{ layers: {tierIndex:number, opacity:number, weight:number, maxPasses:number, lines:[number,number][][]}[], gaps: Array, pointCount: number, repeatedPasses: number }}
 */
export function buildHighlighterLayers(points, opts = {}) {
  const {
    cellDeg = DEFAULT_CELL_DEG,
    passSeparationS = DEFAULT_PASS_SEPARATION_S,
    gap = {},
    detectGaps = true,
  } = opts;

  const pts = normalizeTrackPoints(points);
  if (pts.length < 2) {
    return { layers: [], gaps: [], pointCount: pts.length, repeatedPasses: 0 };
  }

  const gaps = detectGaps ? detectTrackGaps(pts, gap) : [];
  const gapAt = new Set(gaps.map((g) => g.index));

  // --- 1) Pasadas por tramo -------------------------------------------------
  // Clave no dirigida: ir y volver por la misma calle cuenta como repaso.
  const cells = pts.map((p) => cellOf(p, cellDeg));
  /** @type {Map<string, { passes: number, lastT: number, lastIndex: number }>} */
  const seen = new Map();
  const segPasses = new Array(pts.length - 1).fill(0);

  for (let i = 0; i < pts.length - 1; i += 1) {
    if (gapAt.has(i + 1)) continue; // el hueco no es tramo recorrido
    const a = cells[i];
    const b = cells[i + 1];
    const key = a === b ? `s|${a}` : a < b ? `${a}|${b}` : `${b}|${a}`;
    const t = pts[i + 1].t || pts[i].t;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, { passes: 1, lastT: t, lastIndex: i });
    } else {
      const contiguous =
        i - prev.lastIndex <= 2 ||
        (t && prev.lastT && (t - prev.lastT) / 1000 < passSeparationS);
      if (!contiguous) prev.passes += 1;
      prev.lastT = t;
      prev.lastIndex = i;
    }
  }

  // Segunda vuelta: cada tramo toma el total de pasadas de su clave.
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (gapAt.has(i + 1)) {
      segPasses[i] = 0;
      continue;
    }
    const a = cells[i];
    const b = cells[i + 1];
    const key = a === b ? `s|${a}` : a < b ? `${a}|${b}` : `${b}|${a}`;
    segPasses[i] = seen.get(key)?.passes || 1;
  }

  // --- 2) Unir tramos contiguos de la misma capa en polilíneas -------------
  /** @type {Map<number, [number,number][][]>} */
  const linesByTier = new Map();
  const maxPassesByTier = new Map();
  let run = null;
  let runTier = -1;

  const flush = () => {
    if (run && run.length > 1) {
      if (!linesByTier.has(runTier)) linesByTier.set(runTier, []);
      linesByTier.get(runTier).push(run);
    }
    run = null;
    runTier = -1;
  };

  for (let i = 0; i < pts.length - 1; i += 1) {
    if (segPasses[i] === 0) {
      flush(); // corta en el hueco: el tramo predictivo lo dibuja aparte
      continue;
    }
    const tier = tierIndexFor(segPasses[i]);
    maxPassesByTier.set(tier, Math.max(maxPassesByTier.get(tier) || 0, segPasses[i]));
    if (tier !== runTier) {
      flush();
      runTier = tier;
      run = [[pts[i].lat, pts[i].lng]];
    }
    run.push([pts[i + 1].lat, pts[i + 1].lng]);
  }
  flush();

  // Capas ascendentes: las más repasadas se dibujan encima.
  const layers = [...linesByTier.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tierIndex, lines]) => ({
      tierIndex,
      opacity: HIGHLIGHTER_TIERS[tierIndex].opacity,
      weight: HIGHLIGHTER_TIERS[tierIndex].weight,
      maxPasses: maxPassesByTier.get(tierIndex) || 1,
      lines,
    }));

  let repeatedPasses = 0;
  for (const v of seen.values()) {
    if (v.passes > repeatedPasses) repeatedPasses = v.passes;
  }

  return { layers, gaps, pointCount: pts.length, repeatedPasses };
}

/** Clave estable de un hueco (para caché de rutas y React keys). */
export function gapKey(gap) {
  const r = (n) => n.toFixed(4);
  return `${r(gap.from.lat)},${r(gap.from.lng)}>${r(gap.to.lat)},${r(gap.to.lng)}`;
}
