import { query } from '../db.js';

/**
 * Historial de ruta de un operador.
 *
 * Problema que resuelve: el latido GPS móvil (LocationHeartbeat, 5 s) inserta un
 * punto cada 5 s incluso parado, así que 48 h de un operador son ~20 000–35 000
 * filas. La consulta anterior hacía `ORDER BY recorded_at ASC LIMIT 5000`, lo que
 * devolvía solo las PRIMERAS ~6 h de la ventana y cortaba en seco el resto del
 * recorrido (incluido el tramo más reciente).
 *
 * Ahora la reducción es consciente y cubre SIEMPRE la ventana completa:
 *  1) En SQL se colapsan las rachas de puntos quietos (misma celda ~11 m),
 *     preservando primer punto, último punto y los dos puntos que delimitan
 *     cada hueco de señal (necesarios para el tramo predictivo).
 *  2) En Node, si aún quedan demasiados puntos, se aplica Douglas–Peucker
 *     por tramo (sin cruzar huecos), que respeta la forma del recorrido.
 */

/** Celda de dedupe en SQL: 4 decimales ≈ 11 m. */
const DEDUPE_DECIMALS = 4;
/** Silencio que ya se considera hueco de señal (delimita tramos). */
const GAP_SECONDS = 90;
/**
 * Tras Douglas–Peucker, tramos consecutivos más largos que esto se remarcan
 * como hueco para pedir ruta por calles (evita cuerdas verdes sobre campo).
 * 700 m: en ciudad un salto mayor ya se lee como atajo absurdo; en carretera
 * OSRM suele devolver la misma vialidad que la cuerda.
 */
const POST_SIMPLIFY_JUMP_M = parseInt(process.env.TRACK_POST_SIMPLIFY_JUMP_M || '700', 10);
/** Tope duro de filas leídas de la BD (30 d densos; luego se simplifica). */
const DB_ROW_CAP = 200_000;
/** Objetivo de puntos entregados al mapa tras simplificar. */
const DEFAULT_MAX_POINTS = 6_000;
/** Tolerancia inicial de Douglas–Peucker (m). Por debajo del ruido típico de GPS. */
const DEFAULT_EPSILON_M = 6;

const METERS_PER_DEG_LAT = 110_540;
const METERS_PER_DEG_LNG = 111_320;

/**
 * Umbrales de «hueco de señal» (celular apagado / sin cobertura).
 *
 * Se calculan AQUÍ y se marcan punto por punto porque el mapa no puede
 * deducirlos de la traza ya simplificada: Douglas–Peucker borra puntos
 * intermedios, así que dos puntos entregados pueden quedar lejos en tiempo y
 * distancia sin que hubiera ningún corte de señal (autopista en línea recta).
 */
export const TRACK_GAP_DEFAULTS = {
  /** El latido GPS es de 5 s: 2 min de silencio son ~24 latidos perdidos. */
  minSeconds: parseInt(process.env.TRACK_GAP_MIN_SECONDS || '120', 10),
  /** Por debajo es deriva de GPS o una parada: interpolar no aporta nada. */
  minMeters: parseInt(process.env.TRACK_GAP_MIN_METERS || '300', 10),
  /** Un salto así es hueco aunque los timestamps queden cerca. */
  jumpMeters: parseInt(process.env.TRACK_GAP_JUMP_METERS || '1000', 10),
};

function haversineM(aLat, aLng, bLat, bLng) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Marca `gapBefore` en el primer fix tras cada hueco real.
 *
 * Se ejecuta sobre la traza deduplicada (antes de simplificar), donde los
 * deltas de tiempo sí son verdaderos: puntos consecutivos están a ~5 s si el
 * operador se mueve, o representan una parada (mismo sitio) o un hueco real.
 * Douglas–Peucker conserva después estos puntos porque corta por tiempo.
 */
function markGaps(points, opts = TRACK_GAP_DEFAULTS) {
  let count = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seconds = (atMs(b.recordedAt) - atMs(a.recordedAt)) / 1000;
    const meters = haversineM(a.latitude, a.longitude, b.latitude, b.longitude);
    if (meters > opts.minMeters && (seconds > opts.minSeconds || meters > opts.jumpMeters)) {
      b.gapBefore = true;
      b.gapMeters = Math.round(meters);
      b.gapSeconds = Math.round(seconds);
      count += 1;
    }
  }
  return count;
}

/**
 * Distancia perpendicular punto→segmento en metros.
 * Proyección equirectangular local: exacta a estas escalas y sin trigonometría por punto.
 */
function perpDistanceM(p, a, b) {
  const kx = Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180) * METERS_PER_DEG_LNG;
  const ky = METERS_PER_DEG_LAT;
  const ax = a.longitude * kx;
  const ay = a.latitude * ky;
  const bx = b.longitude * kx;
  const by = b.latitude * ky;
  const px = p.longitude * kx;
  const py = p.latitude * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas–Peucker iterativo (sin recursión: evita desbordar la pila con ~50k puntos). */
function rdpKeepMask(points, epsilonM) {
  const n = points.length;
  const keep = new Uint8Array(n);
  if (n === 0) return keep;
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j - i < 2) continue;
    let bestIdx = -1;
    let bestDist = -1;
    for (let k = i + 1; k < j; k += 1) {
      const d = perpDistanceM(points[k], points[i], points[j]);
      if (d > bestDist) {
        bestDist = d;
        bestIdx = k;
      }
    }
    if (bestDist > epsilonM && bestIdx > 0) {
      keep[bestIdx] = 1;
      stack.push([i, bestIdx], [bestIdx, j]);
    }
  }
  return keep;
}

function atMs(value) {
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Corta la traza en tramos continuos: Douglas–Peucker nunca debe cruzar un hueco.
 * Usa silencio temporal Y marcas `gapBefore` (saltos espaciales ya detectados).
 */
function splitOnGaps(points, gapSeconds = GAP_SECONDS) {
  const runs = [];
  let start = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dt = (atMs(points[i].recordedAt) - atMs(points[i - 1].recordedAt)) / 1000;
    if (dt > gapSeconds || points[i].gapBefore) {
      runs.push([start, i - 1]);
      start = i;
    }
  }
  if (points.length) runs.push([start, points.length - 1]);
  return runs;
}

/**
 * Simplifica preservando extremos de cada tramo continuo.
 * Si sigue por encima de `maxPoints`, sube la tolerancia (no trunca nunca).
 */
export function simplifyTrack(points, { maxPoints = DEFAULT_MAX_POINTS, epsilonM = DEFAULT_EPSILON_M } = {}) {
  if (!Array.isArray(points) || points.length <= 2) {
    return { points: points || [], epsilonM: 0 };
  }
  const runs = splitOnGaps(points);
  let eps = epsilonM;
  let out = points;
  for (let pass = 0; pass < 6; pass += 1) {
    if (out.length <= maxPoints && pass > 0) break;
    const kept = [];
    for (const [from, to] of runs) {
      const slice = points.slice(from, to + 1);
      if (slice.length <= 2) {
        kept.push(...slice);
        continue;
      }
      const mask = rdpKeepMask(slice, eps);
      for (let i = 0; i < slice.length; i += 1) {
        if (mask[i]) kept.push(slice[i]);
      }
    }
    out = kept;
    if (out.length <= maxPoints) break;
    eps *= 2.5;
  }
  return { points: out, epsilonM: eps };
}

/**
 * Lee el historial completo de la ventana y lo entrega reducido pero íntegro
 * (primer y último punto reales, extremos de cada hueco preservados).
 *
 * @param {{
 *   userId: string,
 *   hours?: number,
 *   from?: Date|string,
 *   to?: Date|string,
 *   maxPoints?: number,
 * }} opts
 * Preferir `from`+`to` (ISO/Date). Si faltan, usa `hours` hacia atrás desde ahora (máx. 31×24).
 */
export async function loadUserTrack({
  userId,
  hours,
  from,
  to,
  maxPoints = DEFAULT_MAX_POINTS,
}) {
  let fromDate;
  let toDate;
  if (from != null && to != null) {
    fromDate = from instanceof Date ? from : new Date(from);
    toDate = to instanceof Date ? to : new Date(to);
  } else {
    const h = Math.min(Math.max(Number(hours) || 8, 1), 31 * 24);
    toDate = new Date();
    fromDate = new Date(toDate.getTime() - h * 3600 * 1000);
  }
  if (
    !(fromDate instanceof Date) ||
    !(toDate instanceof Date) ||
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime()) ||
    fromDate >= toDate
  ) {
    return {
      points: [],
      meta: {
        pointsRaw: 0,
        pointsDedupped: 0,
        pointsReturned: 0,
        simplifiedEpsilonM: 0,
        gaps: 0,
        gapsBeforeSimplify: 0,
        windowComplete: true,
        from: null,
        to: null,
      },
    };
  }

  const { rows } = await query(
    `WITH raw AS (
       SELECT latitude, longitude, accuracy_m, recorded_at,
              row_number() OVER (ORDER BY recorded_at ASC) AS rn,
              count(*) OVER () AS total
         FROM locations
        WHERE user_id = $1
          AND recorded_at > $2
          AND recorded_at <= $3
     ),
     marked AS (
       SELECT raw.*,
              round(latitude::numeric, $4) AS lat_k,
              round(longitude::numeric, $4) AS lng_k,
              lag(round(latitude::numeric, $4)) OVER w AS prev_lat_k,
              lag(round(longitude::numeric, $4)) OVER w AS prev_lng_k,
              lead(round(latitude::numeric, $4)) OVER w AS next_lat_k,
              lead(round(longitude::numeric, $4)) OVER w AS next_lng_k,
              lag(recorded_at) OVER w AS prev_at,
              lead(recorded_at) OVER w AS next_at
         FROM raw
       WINDOW w AS (ORDER BY recorded_at ASC)
     )
     SELECT latitude, longitude, accuracy_m, recorded_at, total
       FROM marked
      WHERE prev_at IS NULL                                    -- primer fix de la ventana
         OR rn = total                                         -- último fix (tramo reciente)
         OR lat_k IS DISTINCT FROM prev_lat_k                  -- llegó a la celda (>~11 m)
         OR lng_k IS DISTINCT FROM prev_lng_k
         -- Salió de la celda: conservar también el ÚLTIMO fix de cada parada.
         -- Sin esto el colapso de rachas quietas inventaría huecos de señal
         -- (una parada de 1 h se vería como 1 h «sin reportar»).
         OR lat_k IS DISTINCT FROM next_lat_k
         OR lng_k IS DISTINCT FROM next_lng_k
         OR recorded_at - prev_at > make_interval(secs => $5)  -- primer fix al reconectar
         OR next_at - recorded_at > make_interval(secs => $5)  -- último fix antes del hueco
      ORDER BY recorded_at ASC
      LIMIT $6`,
    [userId, fromDate, toDate, DEDUPE_DECIMALS, GAP_SECONDS, DB_ROW_CAP]
  );

  const rawTotal = rows.length ? Number(rows[0].total) || rows.length : 0;
  const dedupped = rows.map((r) => ({
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    accuracyM: r.accuracy_m,
    recordedAt: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : r.recorded_at,
  }));

  const gapCountRaw = markGaps(dedupped);
  const { points, epsilonM } = simplifyTrack(dedupped, { maxPoints });
  // Tras RDP, dos puntos consecutivos pueden quedar a km sin `gapBefore`
  // (se borraron los fixes intermedios de la carretera). Remarcar para que el
  // mapa pida OSRM y no pinte una cuerda verde sobre campo/bases.
  const gapCount = markGaps(points, {
    ...TRACK_GAP_DEFAULTS,
    minMeters: Math.min(TRACK_GAP_DEFAULTS.minMeters, POST_SIMPLIFY_JUMP_M),
    jumpMeters: POST_SIMPLIFY_JUMP_M,
  });

  return {
    points,
    meta: {
      /** Fixes crudos en la ventana (antes de cualquier reducción). */
      pointsRaw: rawTotal,
      /** Tras colapsar rachas de puntos quietos en SQL. */
      pointsDedupped: dedupped.length,
      /** Entregados al mapa. */
      pointsReturned: points.length,
      /** Tolerancia Douglas–Peucker aplicada (0 = ninguna). */
      simplifiedEpsilonM: Math.round(epsilonM * 10) / 10,
      /** Huecos (señal + cuerdas post-simplificar) a resolver por calles. */
      gaps: gapCount,
      gapsBeforeSimplify: gapCountRaw,
      /** La ventana se leyó completa: sin truncado por LIMIT. */
      windowComplete: rawTotal < DB_ROW_CAP,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
  };
}
