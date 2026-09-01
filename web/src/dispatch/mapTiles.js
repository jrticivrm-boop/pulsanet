/**
 * Capas base Leaflet sin API key.
 * CARTO raster (voyager) ahora exige ?key= y marca agua "API KEY REQUIRED".
 */
export const MAP_TILE_LAYERS = {
  natural: {
    label: 'Natural',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; fuentes OSM y partners',
  },
  satelite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  claro: {
    label: 'Claro',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

/** Capa por defecto del centro de mando (una sola TileLayer). */
export const DEFAULT_MAP_TILE = MAP_TILE_LAYERS.natural;
