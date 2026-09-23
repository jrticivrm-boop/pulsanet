import L from 'leaflet';
import {
  PRESENCE_CLUSTER_COLORS,
  PRESENCE_CLUSTER_SLICE_ORDER,
} from './presenceStatus.js';

/**
 * Agrupa puntos cercanos en píxeles a un zoom (estilo Google Maps cluster).
 * @param {Array<{lat:number,lng:number,id?:string}>} points
 * @param {number} zoom
 * @param {{ pixelRadius?: number, maxClusterZoom?: number, keepSeparateIds?: Set<string>|string[] }} [opts]
 */
export function clusterMapPoints(points, zoom, opts = {}) {
  const pixelRadius = opts.pixelRadius ?? 55;
  const maxClusterZoom = opts.maxClusterZoom ?? 16.5;
  const keep = opts.keepSeparateIds
    ? opts.keepSeparateIds instanceof Set
      ? opts.keepSeparateIds
      : new Set(opts.keepSeparateIds)
    : null;

  const list = Array.isArray(points)
    ? points.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    : [];
  if (!list.length) return [];

  if (zoom >= maxClusterZoom) {
    return list.map((p) => ({
      type: 'point',
      point: p,
      lat: p.lat,
      lng: p.lng,
      count: 1,
      members: [p],
    }));
  }

  const remaining = [...list];
  const out = [];

  while (remaining.length) {
    const seed = remaining.shift();
    const sid = seed.id != null ? String(seed.id) : null;
    if (sid && keep?.has(sid)) {
      out.push({
        type: 'point',
        point: seed,
        lat: seed.lat,
        lng: seed.lng,
        count: 1,
        members: [seed],
      });
      continue;
    }
    const sx = lngToX(seed.lng, zoom);
    const sy = latToY(seed.lat, zoom);
    const members = [seed];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const p = remaining[i];
      const pid = p.id != null ? String(p.id) : null;
      if (pid && keep?.has(pid)) continue;
      const dx = lngToX(p.lng, zoom) - sx;
      const dy = latToY(p.lat, zoom) - sy;
      if (dx * dx + dy * dy <= pixelRadius * pixelRadius) {
        members.push(p);
        remaining.splice(i, 1);
      }
    }
    if (members.length === 1) {
      out.push({
        type: 'point',
        point: members[0],
        lat: members[0].lat,
        lng: members[0].lng,
        count: 1,
        members,
      });
    } else {
      let lat = 0;
      let lng = 0;
      for (const m of members) {
        lat += m.lat;
        lng += m.lng;
      }
      lat /= members.length;
      lng /= members.length;
      out.push({
        type: 'cluster',
        point: null,
        lat,
        lng,
        count: members.length,
        members,
      });
    }
  }
  return out;
}

function lngToX(lng, z) {
  return ((lng + 180) / 360) * 2 ** z * 256;
}

function latToY(lat, z) {
  const s = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.min(0.9999, Math.max(-0.9999, s));
  return (
    (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) *
    2 ** z *
    256
  );
}

/**
 * Construye conic-gradient a partir de conteos por clave de estado.
 * @param {Record<string, number>|Map<string,number>|Array<{key?:string,color?:string,count:number}>} [slices]
 * @returns {{ gradient: string, ringColor: string, dominant: string }}
 */
export function buildClusterPieStyle(slices) {
  const counts = new Map();
  if (slices instanceof Map) {
    for (const [k, v] of slices) {
      const n = Number(v) || 0;
      if (n > 0) counts.set(String(k), n);
    }
  } else if (Array.isArray(slices)) {
    for (const s of slices) {
      const key = s?.key || s?.color;
      const n = Number(s?.count) || 0;
      if (!key || n <= 0) continue;
      counts.set(String(key), (counts.get(String(key)) || 0) + n);
    }
  } else if (slices && typeof slices === 'object') {
    for (const [k, v] of Object.entries(slices)) {
      const n = Number(v) || 0;
      if (n > 0) counts.set(String(k), n);
    }
  }

  const ordered = [];
  for (const key of PRESENCE_CLUSTER_SLICE_ORDER) {
    if (counts.has(key)) {
      ordered.push({
        key,
        color: PRESENCE_CLUSTER_COLORS[key] || '#6b7280',
        count: counts.get(key),
      });
      counts.delete(key);
    }
  }
  for (const [key, count] of counts) {
    ordered.push({
      key,
      color: PRESENCE_CLUSTER_COLORS[key] || (key.startsWith('#') ? key : '#6b7280'),
      count,
    });
  }

  const total = ordered.reduce((s, x) => s + x.count, 0);
  if (!total) {
    const fallback = PRESENCE_CLUSTER_COLORS.online;
    return {
      gradient: fallback,
      ringColor: fallback,
      dominant: fallback,
      ordered: [],
      total: 0,
    };
  }

  let acc = 0;
  const parts = [];
  let dominant = ordered[0].color;
  let dominantCount = 0;
  for (const sl of ordered) {
    if (sl.count > dominantCount) {
      dominantCount = sl.count;
      dominant = sl.color;
    }
    const start = (acc / total) * 360;
    acc += sl.count;
    const end = (acc / total) * 360;
    parts.push(`${sl.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
  }

  return {
    gradient: `conic-gradient(${parts.join(', ')})`,
    ringColor: dominant,
    dominant,
    ordered,
    total,
  };
}

/**
 * Icono de cluster: pastel por presencia/pánico + cifras por color + anillos.
 * Con 2+ colores: solo cifras en cada porción (nunca total + porción a la vez).
 * @param {number} count
 * @param {{ slices?: Record<string, number>|Map<string,number> }} [opts]
 */
export function mapClusterIcon(count, opts = {}) {
  const n = Number(count) || 0;
  const size = n >= 100 ? 52 : n >= 10 ? 48 : 44;
  const pie = buildClusterPieStyle(opts.slices);
  const { gradient, ringColor, ordered = [], total = n } = pie;
  const multi = ordered.length >= 2;
  const sliceLabels = multi ? buildClusterSliceLabelHtml(ordered, total) : { html: '' };
  // Solo ocultar el total si hay cifras por porción (evita círculo vacío).
  const slicesOnly = multi && !!sliceLabels.html;
  const totalLabel = n > 99 ? '99+' : String(n);
  const aria = slicesOnly
    ? ordered.map((s) => `${s.count} ${sliceAriaLabel(s.key)}`).join(', ')
    : `${totalLabel} en mapa`;
  const ariaEsc = String(aria).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const html = `
    <div class="lt-cluster" style="--lt-cluster-size:${size}px;--lt-cluster-pie:${gradient};--lt-cluster-ring:${ringColor}">
      <span class="lt-cluster-ring lt-cluster-ring--a" aria-hidden="true"></span>
      <span class="lt-cluster-ring lt-cluster-ring--b" aria-hidden="true"></span>
      <span class="lt-cluster-ring lt-cluster-ring--c" aria-hidden="true"></span>
      <span class="lt-cluster-face" aria-label="${ariaEsc}">
        <span class="lt-cluster-pie" aria-hidden="true"></span>
        <span class="lt-cluster-rim" aria-hidden="true"></span>
        ${sliceLabels.html}
        ${slicesOnly ? '' : `<span class="lt-cluster-total">${totalLabel}</span>`}
      </span>
    </div>
  `;
  return L.divIcon({
    className: 'lt-div-icon lt-cluster-icon',
    html,
    iconSize: [size + 36, size + 36],
    iconAnchor: [(size + 36) / 2, (size + 36) / 2],
  });
}

function sliceAriaLabel(key) {
  switch (key) {
    case 'online':
      return 'en línea';
    case 'away':
      return 'ausente';
    case 'offline':
      return 'desconectado';
    case 'stale':
      return 'fuera de línea';
    case 'panic':
      return 'alerta';
    default:
      return key || '';
  }
}

/**
 * Cifra en cada porción (también cuñas finas).
 * @param {Array<{key:string,color:string,count:number}>} ordered
 * @param {number} total
 */
function buildClusterSliceLabelHtml(ordered, total) {
  if (!ordered?.length || !total) return { html: '' };
  let acc = 0;
  const labels = [];
  const many = ordered.length >= 4;
  for (const sl of ordered) {
    const start = (acc / total) * 360;
    acc += sl.count;
    const end = (acc / total) * 360;
    const sweep = end - start;
    if (sl.count <= 0) continue;
    const mid = start + sweep / 2;
    const text = sl.count > 99 ? '99+' : String(sl.count);
    // Cuña fina → número más hacia el borde.
    const radius = sweep < 45 ? 0.38 : 0.28;
    const cls = many ? 'lt-cluster-slice-n lt-cluster-slice-n--sm' : 'lt-cluster-slice-n';
    labels.push(
      `<span class="${cls}" style="--slice-mid:${mid.toFixed(1)}deg;--slice-r:${radius}" aria-hidden="true">${text}</span>`
    );
  }
  return { html: labels.join('') };
}
