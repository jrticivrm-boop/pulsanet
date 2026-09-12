import { useEffect, useMemo, useState } from 'react';
import { Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapCoordsLink } from './MapCoordsLink.jsx';
import { cargoLabelFromText } from './mapLabelUtils.js';
import { useCargoLabelsVisible } from './mapLeafletUtils.jsx';

/** @deprecated use cargoLabelFromText */
export const cargoLabelFromSiteName = cargoLabelFromText;

/** Clic en mapa → { lat, lng } (modo alta de sitio). */
export function SitePickClick({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (!enabled || !onPick) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Etiqueta bajo el pin = solo Cargo.
 * Si el nombre viene como «Cap. 1/o. Luna, Jefe S.T.I.», se toma lo posterior a la coma.
 */

function siteIcon(blobUrl, color, label) {
  const labelHtml = label
    ? `<span class="cc-tactical-map-label">${escapeHtml(label)}</span>`
    : '';
  if (blobUrl) {
    return L.divIcon({
      className: 'cc-tactical-map-icon',
      html: `<div class="cc-tactical-map-pin">
        <img src="${blobUrl}" alt="" class="cc-tactical-map-pin-img" />
        ${labelHtml}
      </div>`,
      iconSize: [120, label ? 58 : 36],
      // Centro del círculo (36px), no de la etiqueta.
      iconAnchor: [60, 18],
      popupAnchor: [0, -20],
    });
  }
  const c = color || '#c4a35a';
  return L.divIcon({
    className: 'cc-tactical-map-icon',
    html: `<div class="cc-tactical-map-pin">
      <span class="cc-tactical-map-dot" style="background:${c}"></span>
      ${labelHtml}
    </div>`,
    iconSize: [120, label ? 40 : 16],
    iconAnchor: [60, 8],
    popupAnchor: [0, -12],
  });
}

/**
 * Capa de sitios tácticos en mapas de despacho.
 * @param {object[]} sites
 * @param {Set<string>|null} visibleGroupIds
 * @param {Record<string,string>} iconBlobs — groupId → blob URL
 */
export function TacticalSitesLayer({ sites = [], visibleGroupIds = null, iconBlobs = {} }) {
  const showCargo = useCargoLabelsVisible();
  const list = (sites || []).filter((s) => {
    if (!s || s.isActive === false) return false;
    if (visibleGroupIds == null) return true;
    return visibleGroupIds.has(String(s.groupId));
  });

  return (
    <>
      {list.map((s) => {
        const color = s.groupColor || '#c4a35a';
        const pos = [Number(s.latitude), Number(s.longitude)];
        const blob = iconBlobs[String(s.groupId)] || null;
        const label = showCargo ? cargoLabelFromText(s.name) : '';
        const icon = siteIcon(blob, color, label);
        return (
          <span key={s.id}>
            {s.radiusM != null && Number(s.radiusM) > 0 ? (
              <Circle
                center={pos}
                radius={Number(s.radiusM)}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: '4 4',
                }}
              />
            ) : null}
            <Marker position={pos} icon={icon}>
              <Popup>
                <strong>{s.name}</strong>
                {s.groupName ? (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{s.groupName}</div>
                ) : null}
                {s.locationText ? (
                  <div style={{ marginTop: 6, fontSize: 12 }}>{s.locationText}</div>
                ) : null}
                {s.notes ? (
                  <div style={{ marginTop: 6, fontSize: 12, whiteSpace: 'pre-wrap', opacity: 0.9 }}>
                    {s.notes}
                  </div>
                ) : null}
                <div style={{ marginTop: 6 }}>
                  <MapCoordsLink lat={s.latitude} lng={s.longitude} />
                </div>
              </Popup>
            </Marker>
          </span>
        );
      })}
    </>
  );
}

/** Carga iconos de agrupación autenticados a blob URLs (clave = groupId). */
export function useTacticalGroupIconBlobs(groups, token) {
  const [iconBlobs, setIconBlobs] = useState({});
  const key = useMemo(
    () =>
      (groups || [])
        .filter((g) => g.iconUrl)
        .map((g) => `${g.id}:${g.iconUrl}`)
        .join('|'),
    [groups]
  );

  useEffect(() => {
    let cancelled = false;
    const created = [];
    (async () => {
      const next = {};
      for (const g of groups || []) {
        if (!g.iconUrl || !token) continue;
        try {
          const res = await fetch(g.iconUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[String(g.id)] = url;
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setIconBlobs(next);
      else created.forEach((u) => URL.revokeObjectURL(u));
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [key, token]);

  return iconBlobs;
}

/** @deprecated alias — prefer useTacticalGroupIconBlobs */
export const useTacticalSiteIconBlobs = useTacticalGroupIconBlobs;

export const TACTICAL_SITE_COLORS = [
  '#c4a35a',
  '#3ecf9a',
  '#5b8def',
  '#e07a5f',
  '#9b59b6',
  '#1abc9c',
  '#f39c12',
];
