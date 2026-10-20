/**
 * Globo de operador en mapa:
 * L1 Grado Apellido (root sin grado: «Administrador»)
 * L2 unidad|zona|región (root: «Administrador»)
 * L3 distintivo: B.O.Mvl. "Castillo" (catálogo + nombre libre entre comillas), seguido de
 *    municipio, estado donde está el servicio (guardado o por su posición)
 *    y debajo una flecha que despliega efectivos por grupo (Personal, Armamento, Vehs., Otros)
 * L4 teléfono
 * Cada línea se omite si está vacía; luego fecha, coords, acciones — sin texto de presencia.
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { ensureFreshSession, geoAdminAt } from '../api';
import { MapCoordsLink } from './MapCoordsLink.jsx';
import {
  featureContainsLatLng,
  loadIvRmMunicipios,
  loadedIvRmMunicipios,
} from './mxMunicipiosGeo.js';

/** Distintivo: «B.O.Mvl. "Castillo"»; solo uno de los dos si falta el otro. */
export function formatDistintivo(tipo, nombre) {
  const t = String(tipo || '').trim();
  const n = String(nombre || '')
    .trim()
    .replace(/^["“”«»']+|["“”«»']+$/g, '')
    .trim();
  const quoted = n ? `"${n}"` : '';
  return [t, quoted].filter(Boolean).join(' ');
}

export function mapOperatorDistintivo(loc) {
  return formatDistintivo(loc?.cargo, loc?.serviceNombre);
}

/** Globo compacto; el ancho real lo ajusta OperatorPopupZoomFit según el zoom. */
export const OPERATOR_POPUP_OPTS = {
  className: 'cc-op-leaflet-pop',
  maxWidth: 300,
  minWidth: 252,
  autoPanPadding: [36, 36],
};

function scaleForMapZoom(z) {
  if (z <= 8) return 0.86;
  if (z <= 10) return 0.9;
  if (z <= 12) return 0.94;
  if (z <= 14) return 0.97;
  return 1;
}

function refreshOpenOperatorPopups(map, scale) {
  const s = scale ?? scaleForMapZoom(map.getZoom());
  const maxW = Math.round(300 * s);
  const minW = Math.min(252, maxW);
  const visit = (layer) => {
    const p = layer.getPopup?.();
    if (p?.isOpen?.() && p.getElement?.()?.classList?.contains('cc-op-leaflet-pop')) {
      p.options.maxWidth = maxW;
      p.options.minWidth = minW;
      p.update();
    }
    if (typeof layer.eachLayer === 'function') layer.eachLayer(visit);
  };
  map.eachLayer(visit);
}

/** Achica la ficha al alejar el mapa (si no, el globo queda en píxeles fijos y se ve gigante). */
export function OperatorPopupZoomFit() {
  const map = useMap();
  useLayoutEffect(() => {
    const apply = () => {
      const s = scaleForMapZoom(map.getZoom());
      map.getContainer().style.setProperty('--cc-op-pop-scale', String(s));
      refreshOpenOperatorPopups(map, s);
    };
    apply();
    map.on('zoom', apply);
    map.on('zoomend', apply);
    return () => {
      map.off('zoom', apply);
      map.off('zoomend', apply);
    };
  }, [map]);
  return null;
}

export function affiliationLabelFromLoc(loc) {
  const fromOrg =
    String(loc?.unitName || '').trim() ||
    String(loc?.zoneName || '').trim() ||
    String(loc?.regionName || '').trim() ||
    String(loc?.affiliationLabel || '').trim();
  if (fromOrg) return fromOrg;
  const role = String(loc?.role || '').trim().toLowerCase();
  return role === 'root' ? 'Administrador' : '';
}

export function mapPopupTitleLine(loc) {
  const fromDisplay = String(loc?.displayName || '').trim();
  const role = String(loc?.role || '').trim().toLowerCase();
  if (role === 'root' && !String(loc?.grade || '').trim()) return 'Administrador';
  // display_name = «Grado Apellido[, pertenencia]»; la pertenencia va en su propia línea.
  const base = (fromDisplay.split(',')[0] || '').trim();
  return base || 'Operador';
}

export function mapPopupServiceLine(loc) {
  return mapOperatorDistintivo(loc);
}

export function mapPopupAffiliationLine(loc) {
  const aff = affiliationLabelFromLoc(loc);
  return aff && aff !== mapPopupTitleLine(loc) ? aff : '';
}

export function mapPopupPlaceLine(loc) {
  return [loc?.serviceGeoMunicipio, abreviarEstado(loc?.serviceGeoEstado)]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(', ');
}

const placeCache = new Map();

const ESTADO_ABREV = [
  ['aguascalientes', 'Ags.'],
  ['baja california sur', 'B.C.S.'],
  ['baja california', 'B.C.'],
  ['campeche', 'Camp.'],
  ['chiapas', 'Chis.'],
  ['chihuahua', 'Chih.'],
  ['ciudad de mexico', 'CDMX'],
  ['distrito federal', 'CDMX'],
  ['coahuila', 'Coah.'],
  ['colima', 'Col.'],
  ['durango', 'Dgo.'],
  ['guanajuato', 'Gto.'],
  ['guerrero', 'Gro.'],
  ['hidalgo', 'Hgo.'],
  ['jalisco', 'Jal.'],
  ['estado de mexico', 'Edo. Méx.'],
  ['mexico', 'Edo. Méx.'],
  ['michoacan', 'Mich.'],
  ['morelos', 'Mor.'],
  ['nayarit', 'Nay.'],
  ['nuevo leon', 'N.L.'],
  ['oaxaca', 'Oax.'],
  ['puebla', 'Pue.'],
  ['queretaro', 'Qro.'],
  ['quintana roo', 'Q. Roo'],
  ['san luis', 'S.L.P.'],
  ['sinaloa', 'Sin.'],
  ['sonora', 'Son.'],
  ['tabasco', 'Tab.'],
  ['tamaulipas', 'Tamps.'],
  ['tlaxcala', 'Tlax.'],
  ['veracruz', 'Ver.'],
  ['yucatan', 'Yuc.'],
  ['zacatecas', 'Zac.'],
];

/** «Tamaulipas» → «Tamps.»; acepta nombres largos («Coahuila de Zaragoza»). Sin match: tal cual. */
export function abreviarEstado(estado) {
  const raw = String(estado || '').trim();
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const hit = ESTADO_ABREV.find(([name]) => key === name || key.startsWith(`${name} `));
  return hit ? hit[1] : raw;
}

function joinPlace(municipio, estado) {
  return [municipio, abreviarEstado(estado)]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(', ');
}

function placeFromTerritory(features, lat, lng) {
  const f = (features || []).find((x) => featureContainsLatLng(x, lat, lng));
  return f ? joinPlace(f.properties?.municipio || f.properties?.shapeName, f.properties?.estado) : '';
}

/**
 * «Municipio, Estado» donde está el servicio: el guardado en el usuario o, si no hay,
 * el de su posición (municipios IV R.M. en el navegador; fuera de ellos, /api/geo/admin-at).
 */
export function useOperatorPlace(loc) {
  const saved = mapPopupPlaceLine(loc);
  const lat = Number(loc?.latitude);
  const lng = Number(loc?.longitude);
  const key =
    Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(3)},${lng.toFixed(3)}` : '';
  const [place, setPlace] = useState(() => saved || (key && placeCache.get(key)) || '');

  useEffect(() => {
    if (saved || !key) {
      setPlace(saved);
      return undefined;
    }
    if (placeCache.has(key)) {
      setPlace(placeCache.get(key));
      return undefined;
    }
    let alive = true;
    const ctrl = new AbortController();
    (async () => {
      const features = loadedIvRmMunicipios() || (await loadIvRmMunicipios());
      let found = placeFromTerritory(features, lat, lng);
      if (!found) {
        try {
          const s = await ensureFreshSession();
          const r = await geoAdminAt(s?.token, lat, lng, ctrl.signal);
          found = joinPlace(r?.municipio, r?.estado);
        } catch {
          return;
        }
      }
      placeCache.set(key, found);
      if (alive) setPlace(found);
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [saved, key]);

  return place;
}

export function mapPopupPhoneLine(loc) {
  return String(loc?.phone || '').trim();
}

/** Texto indexable para búsqueda de operadores en mapa. */
export function mapOperatorSearchBlob(loc) {
  return [
    loc?.displayName,
    loc?.grade,
    mapOperatorDistintivo(loc),
    loc?.phone,
    loc?.unitName,
    loc?.zoneName,
    loc?.regionName,
    loc?.serviceGeoMunicipio,
    loc?.serviceGeoEstado,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const POPUP_ICONS = {
  place: 'M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone:
    'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  time: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4.5l3 2',
  coords: 'M12 3v3m0 12v3M3 12h3m12 0h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
};

function PopupIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={POPUP_ICONS[name]} />
    </svg>
  );
}

function popupInitial(title) {
  const words = String(title || '').trim().split(/\s+/);
  const last = words[words.length - 1] || '';
  return (last.replace(/[^\p{L}]/gu, '')[0] || '?').toLocaleUpperCase('es');
}

/** Cada concepto va junto (p. ej. «2 Adit. L.G.»); el salto de línea es entre conceptos. */
function EfectivosRowItems({ items }) {
  return items.map((s, i) => {
    const last = i === items.length - 1;
    const text = String(s);
    return (
      <span key={`${i}-${text}`} className="cc-op-pop-efectivo">
        {last ? (text.endsWith('.') ? text : `${text}.`) : `${text},`}
      </span>
    );
  });
}

/** Ficha del operador en el globo; `children` = acciones (botones). */
export function OperatorMapPopupBody({ loc, recordedLabel, children }) {
  const map = useMap();
  const [efectivosOpen, setEfectivosOpen] = useState(false);
  const title = mapPopupTitleLine(loc);
  const distintivo = mapPopupServiceLine(loc);
  const affiliation = mapPopupAffiliationLine(loc);
  const place = useOperatorPlace(loc);
  const phone = mapPopupPhoneLine(loc);
  const efectivos = Array.isArray(loc?.efectivos)
    ? loc.efectivos.filter((g) => g?.label && Array.isArray(g.items) && g.items.length)
    : [];
  useLayoutEffect(() => {
    refreshOpenOperatorPopups(map);
  }, [map, efectivosOpen]);
  const hasCoords = Number.isFinite(Number(loc?.latitude)) && Number.isFinite(Number(loc?.longitude));
  const rows = [
    phone
      ? {
          icon: 'phone',
          body: (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="cc-op-pop-tel">
              {phone}
            </a>
          ),
        }
      : null,
    recordedLabel ? { icon: 'time', body: recordedLabel } : null,
    hasCoords
      ? { icon: 'coords', body: <MapCoordsLink lat={loc.latitude} lng={loc.longitude} /> }
      : null,
  ].filter(Boolean);
  return (
    <div className="cc-op-pop">
      <div className="cc-op-pop-head">
        <span className="cc-op-pop-avatar" aria-hidden="true">
          {popupInitial(title)}
        </span>
        <div className="cc-op-pop-id">
          <strong className="cc-op-pop-title">{title}</strong>
          {affiliation ? <span className="cc-op-pop-aff">{affiliation}</span> : null}
        </div>
      </div>
      {distintivo || place ? (
        <div className="cc-op-pop-service">
          {distintivo ? <span className="cc-op-pop-chip">{distintivo}</span> : null}
          {place ? (
            <span className="cc-op-pop-place">
              <PopupIcon name="place" />
              {place}
            </span>
          ) : null}
        </div>
      ) : null}
      {efectivos.length ? (
        <div className={`cc-op-pop-efectivos-wrap${efectivosOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="cc-op-pop-efectivos-toggle"
            aria-expanded={efectivosOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEfectivosOpen((v) => !v);
            }}
          >
            <span>Efectivos</span>
            <svg className="cc-op-pop-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {efectivosOpen ? (
            <dl className="cc-op-pop-efectivos" lang="es">
              {efectivos.map((g) => (
                <div key={g.key} className="cc-op-pop-efectivos-row">
                  <dt>{g.label}</dt>
                  <dd>
                    <EfectivosRowItems items={g.items} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
      {rows.length ? (
        <ul className="cc-op-pop-rows">
          {rows.map((r) => (
            <li key={r.icon}>
              <PopupIcon name={r.icon} />
              <span>{r.body}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {children ? <div className="cc-op-pop-actions">{children}</div> : null}
    </div>
  );
}
