/**
 * Capas base Leaflet sin API key.
 * CARTO raster (voyager) ahora exige ?key= y marca agua "API KEY REQUIRED".
 */

/** Zoom máximo del mapa (overzoom estira tiles más allá del nativo). */
export const MAP_MAX_ZOOM = 22;
/**
 * Zoom mínimo absoluto (piso). El efectivo lo sube MapWorldFillMinZoom
 * para que el planeta cubra el viewport sin franja gris.
 */
export const MAP_MIN_ZOOM = 0;
/** Zoom nativo típico de Esri/OSM; por encima se escala la imagen. */
export const MAP_NATIVE_ZOOM = 19;
/** Al enfocar un operador / grupo, no quedar tan lejos. */
export const MAP_FOCUS_MAX_ZOOM = 20;
export const MAP_FIT_PEOPLE_MAX_ZOOM = 18;

/** Un solo planeta (sin réplicas horizontales al hacer zoom out). */
export const MAP_WORLD_BOUNDS = [
  [-85.05112878, -180],
  [85.05112878, 180],
];

/** Props de MapContainer para bloquear wrap del mundo. */
export function mapWorldProps() {
  return {
    minZoom: MAP_MIN_ZOOM,
    maxBounds: MAP_WORLD_BOUNDS,
    maxBoundsViscosity: 1,
    worldCopyJump: false,
    attributionControl: false,
    zoomControl: false, // se añade ZoomControl bottomright en cada mapa
  };
}

export const MAP_TILE_LAYERS = {
  natural: {
    label: 'Natural',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; fuentes OSM y partners',
    maxNativeZoom: 19,
    maxZoom: MAP_MAX_ZOOM,
  },
  satelite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    // Esri Imagery suele servir hasta ~19; overzoom hasta MAP_MAX_ZOOM.
    maxNativeZoom: 19,
    maxZoom: MAP_MAX_ZOOM,
  },
  claro: {
    label: 'Claro',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
    maxZoom: MAP_MAX_ZOOM,
  },
};

/** Props comunes para <TileLayer /> según la capa activa. */
export function tileLayerProps(tile) {
  return {
    attribution: tile.attribution,
    url: tile.url,
    maxZoom: tile.maxZoom ?? MAP_MAX_ZOOM,
    maxNativeZoom: tile.maxNativeZoom ?? MAP_NATIVE_ZOOM,
    noWrap: true,
    bounds: MAP_WORLD_BOUNDS,
  };
}

/** Capa por defecto del centro de mando (una sola TileLayer). */
export const DEFAULT_MAP_TILE = MAP_TILE_LAYERS.natural;

/** Preferencia global de estilo de mapa (Consola / Seguimiento / Centro). */
export const MAP_LAYER_STORAGE_KEY = 'tacticalptx_map_layer';

/** Lee la última capa válida guardada; si no hay, usa `fallback` (por defecto natural). */
export function loadStoredMapLayer(fallback = 'natural') {
  try {
    const v = localStorage.getItem(MAP_LAYER_STORAGE_KEY);
    if (v && MAP_TILE_LAYERS[v]) return v;
  } catch {
    /* ignore */
  }
  return MAP_TILE_LAYERS[fallback] ? fallback : 'natural';
}

/** Persiste la capa elegida (solo si es clave de MAP_TILE_LAYERS). */
export function storeMapLayer(key) {
  try {
    if (key && MAP_TILE_LAYERS[key]) {
      localStorage.setItem(MAP_LAYER_STORAGE_KEY, key);
    }
  } catch {
    /* ignore */
  }
}
