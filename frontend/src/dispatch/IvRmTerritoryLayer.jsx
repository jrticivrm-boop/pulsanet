import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  isTerritorySurfaceEnabled,
  isZonaEnabled,
  loadIvRmTerritoryConfig,
  primaryUnidad,
  unidadColor,
  useIvRmTerritoryConfig,
} from './ivRmTerritoryConfig.js';
import {
  applyTerritoryCoverage,
  filterTerritoryFeatures,
  loadIvRmMunicipios,
  loadedIvRmMunicipios,
} from './mxMunicipiosGeo.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function territoryUnidades(p) {
  if (Array.isArray(p.unidades) && p.unidades.length) {
    return p.unidades.map((u) => String(u).trim()).filter(Boolean);
  }
  return String(p.unidad || '')
    .split(' / ')
    .map((u) => u.trim())
    .filter(Boolean);
}

/** Globo: municipio + estado arriba; Zona y Unidad(es) con su color abajo. */
function territoryTooltipHtml(props) {
  const p = props || {};
  const name = p.municipio || p.shapeName || 'Municipio';
  const zonaLabel = p.zona
    ? (String(p.zona).includes('Z.M.') ? String(p.zona) : `${p.zona} Z.M.`)
    : null;
  const unidades = territoryUnidades(p);
  const accent = unidadColor(primaryUnidad(p));
  const unitChips = unidades
    .map(
      (u) =>
        `<span class="ivrm-tip-unit"><i style="background:${escapeHtml(unidadColor(u))}"></i>${escapeHtml(u)}</span>`
    )
    .join('');
  const rows =
    (zonaLabel
      ? `<div class="ivrm-tip-row"><span class="ivrm-tip-key">Zona</span><span class="ivrm-tip-val">${escapeHtml(zonaLabel)}</span></div>`
      : '') +
    (unitChips
      ? `<div class="ivrm-tip-row"><span class="ivrm-tip-key">${unidades.length > 1 ? 'Unidades' : 'Unidad'}</span><span class="ivrm-tip-val ivrm-tip-units">${unitChips}</span></div>`
      : '');
  return (
    `<div class="ivrm-tip" style="--ivrm-accent:${escapeHtml(accent)}">` +
    `<div class="ivrm-tip-head">` +
    `<div class="ivrm-tip-name">${escapeHtml(name)}</div>` +
    (p.estado ? `<div class="ivrm-tip-estado">${escapeHtml(p.estado)}</div>` : '') +
    `</div>` +
    (rows ? `<div class="ivrm-tip-rows">${rows}</div>` : '') +
    `</div>`
  );
}

const TIP_GAP = 8;
const TIP_EDGE = 6;

function clampTo(v, lo, hi) {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

/**
 * Coloca el globo fuera del recuadro del municipio (derecha → izquierda → abajo → arriba),
 * en el primer lado con espacio. Si el municipio llena el mapa, sigue al cursor.
 * @returns {'side'|'cursor'}
 */
function placeTerritoryTip(map, tip, lyr, cursorLatLng) {
  const el = tip.getElement();
  const tw = el?.offsetWidth || 170;
  const th = el?.offsetHeight || 100;
  const size = map.getSize();
  const bounds = lyr.getBounds();
  const nw = map.latLngToContainerPoint(bounds.getNorthWest());
  const se = map.latLngToContainerPoint(bounds.getSouthEast());
  const midY = clampTo(
    (Math.max(0, nw.y) + Math.min(size.y, se.y)) / 2,
    th / 2 + TIP_EDGE,
    size.y - th / 2 - TIP_EDGE
  );
  const midX = clampTo(
    (Math.max(0, nw.x) + Math.min(size.x, se.x)) / 2,
    tw / 2 + TIP_EDGE,
    size.x - tw / 2 - TIP_EDGE
  );
  const sides = [
    { dir: 'right', room: size.x - se.x, need: tw, pt: [se.x, midY], offset: [TIP_GAP, 0] },
    { dir: 'left', room: nw.x, need: tw, pt: [nw.x, midY], offset: [-TIP_GAP, 0] },
    { dir: 'bottom', room: size.y - se.y, need: th, pt: [midX, se.y], offset: [0, TIP_GAP] },
    { dir: 'top', room: nw.y, need: th, pt: [midX, nw.y], offset: [0, -TIP_GAP] },
  ];
  const side = sides.find((s) => s.room >= s.need + TIP_GAP + TIP_EDGE * 2);
  if (side) {
    tip.options.direction = side.dir;
    tip.options.offset = L.point(side.offset);
    tip.setLatLng(map.containerPointToLatLng(side.pt));
    return 'side';
  }
  const cursor = map.latLngToContainerPoint(cursorLatLng);
  const toLeft = cursor.x + tw + 24 > size.x;
  tip.options.direction = toLeft ? 'left' : 'right';
  tip.options.offset = L.point(toLeft ? -18 : 18, 0);
  tip.setLatLng(cursorLatLng);
  return 'cursor';
}

/** Mezcla un #rrggbb hacia negro (`amount` 0–1). */
function darkenHex(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

function styleForFeature(feature, showColors) {
  const unit = primaryUnidad(feature?.properties);
  const fill = unidadColor(unit);
  return {
    // Borde más oscuro que el relleno: delimita municipios vecinos de la misma unidad.
    color: showColors ? darkenHex(fill, 0.35) : fill,
    weight: showColors ? 1.35 : 1.0,
    opacity: showColors ? 0.85 : 0.4,
    fillColor: fill,
    fillOpacity: showColors ? 0.46 : 0.04,
    fillRule: 'nonzero',
    lineJoin: 'round',
    lineCap: 'round',
    stroke: true,
    fill: true,
  };
}

/**
 * Municipios IV R.M. coloreados por Unidad (tonos tenues).
 * Hover: resalta la porción y muestra globo al lado del municipio, sin taparlo.
 */
export default function IvRmTerritoryLayer({
  surface = 'consola',
  filter = null,
  showColors: showColorsProp = null,
  onFeaturesReady = null,
  coverageRows = null,
}) {
  const map = useMap();
  const [config] = useIvRmTerritoryConfig();
  const surfaceOn = isTerritorySurfaceEnabled(config, surface);
  const layerOn = config.layerEnabled !== false && surfaceOn;
  const showColors =
    showColorsProp == null ? config.showColors !== false : Boolean(showColorsProp);
  const configKey = JSON.stringify(config);
  const filterKey = JSON.stringify(filter || {});
  const [features, setFeatures] = useState(() => loadedIvRmMunicipios());
  const layerRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!layerOn || features != null) return undefined;
    let alive = true;
    loadIvRmMunicipios().then((list) => {
      if (!alive) return;
      setFeatures(list?.length ? list : []);
    });
    return () => {
      alive = false;
    };
  }, [layerOn, features]);

  const coverageKey = JSON.stringify(
    (coverageRows || []).map((r) => [
      r.unidadName || r.unidad_name,
      r.estado,
      r.municipio,
      r.zonaKey || r.zona_key,
    ])
  );

  const visible = useMemo(() => {
    if (!features?.length) return [];
    const cfg = config || loadIvRmTerritoryConfig();
    const overlaid = applyTerritoryCoverage(features, coverageRows);
    let list = overlaid.filter((f) => isZonaEnabled(cfg, f.properties?.zonaId));
    if (filter) list = filterTerritoryFeatures(list, filter);
    return list;
  }, [features, configKey, filterKey, coverageKey]);

  useEffect(() => {
    if (typeof onFeaturesReady === 'function') onFeaturesReady(visible);
  }, [visible, onFeaturesReady]);

  useEffect(() => {
    if (!layerOn) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return undefined;
    }

    if (!map.getPane('ivRmTerritoryPane')) {
      const pane = map.createPane('ivRmTerritoryPane');
      pane.style.zIndex = 360;
    }
    if (!rendererRef.current) {
      rendererRef.current = L.svg({ padding: 0.5, pane: 'ivRmTerritoryPane' });
    }

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!visible.length) return undefined;

    const tip = L.tooltip({ className: 'ivrm-territory-tip', opacity: 1, interactive: false });
    let tipMode = 'side';

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: visible },
      {
        pane: 'ivRmTerritoryPane',
        renderer: rendererRef.current,
        interactive: true,
        style: (feature) => styleForFeature(feature, showColors),
        onEachFeature: (feature, lyr) => {
          lyr.on('mouseover', (e) => {
            tip.setContent(territoryTooltipHtml(feature?.properties));
            if (!map.hasLayer(tip)) map.openTooltip(tip, e.latlng);
            tipMode = placeTerritoryTip(map, tip, lyr, e.latlng);
            const base = styleForFeature(feature, showColors);
            lyr.setStyle({
              ...base,
              weight: 2.4,
              opacity: 0.95,
              fillOpacity: showColors ? 0.62 : 0.16,
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              lyr.bringToFront();
            }
          });
          lyr.on('mousemove', (e) => {
            if (tipMode === 'cursor' && map.hasLayer(tip)) {
              tipMode = placeTerritoryTip(map, tip, lyr, e.latlng);
            }
          });
          lyr.on('mouseout', () => {
            map.closeTooltip(tip);
            layer.resetStyle(lyr);
          });
        },
      }
    );
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      map.closeTooltip(tip);
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, configKey, filterKey, layerOn, showColors, visible]);

  return null;
}
