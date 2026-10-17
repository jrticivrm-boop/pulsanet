import { useRef } from 'react';
import {
  IV_RM_TERRITORY_SURFACES,
  IV_RM_ZONAS,
  defaultIvRmTerritoryConfig,
  defaultTerritorySurfaces,
  isTerritorySurfaceEnabled,
  isZonaEnabled,
  useIvRmTerritoryConfig,
  zonaColor,
} from './ivRmTerritoryConfig.js';

/**
 * Bloque de Configuración → Estados: Zonas Militares IV R.M.
 * Colores y visibilidad por Z.M.; mapas donde aplicar la capa municipal.
 */
export default function ConfigTerritory() {
  const [config, update] = useIvRmTerritoryConfig();
  const colorInputRef = useRef(null);
  const editingIdRef = useRef('');

  function setSurface(id, enabled) {
    update((prev) => ({
      ...prev,
      surfaces: {
        ...defaultTerritorySurfaces(),
        ...(prev?.surfaces && typeof prev.surfaces === 'object' ? prev.surfaces : {}),
        [id]: Boolean(enabled),
      },
    }));
  }

  function toggleZona(id) {
    update((prev) => ({
      ...prev,
      zonas: {
        ...prev.zonas,
        [id]: {
          enabled: !isZonaEnabled(prev, id),
          color: zonaColor(prev, id),
        },
      },
    }));
  }

  function setColor(id, hex) {
    const color = String(hex || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) return;
    update((prev) => ({
      ...prev,
      zonas: {
        ...prev.zonas,
        [id]: {
          enabled: isZonaEnabled(prev, id),
          color,
        },
      },
    }));
  }

  function openColorPicker(id) {
    editingIdRef.current = id;
    const input = colorInputRef.current;
    if (!input) return;
    input.value = zonaColor(config, id);
    input.click();
  }

  function onNativeColor(e) {
    const id = editingIdRef.current;
    if (!id) return;
    setColor(id, e.target.value);
  }

  const surfacesOn = IV_RM_TERRITORY_SURFACES.filter((s) =>
    isTerritorySurfaceEnabled(config, s.id)
  ).length;
  const zonasOn = IV_RM_ZONAS.filter((z) => isZonaEnabled(config, z.id)).length;

  return (
    <section className="cc-card cc-states-cfg-card cc-territory-cfg-card">
      <input
        ref={colorInputRef}
        type="color"
        className="cc-tactical-color-native"
        aria-hidden
        tabIndex={-1}
        onInput={onNativeColor}
        onChange={onNativeColor}
      />

      <div className="cc-territory-cfg-head">
        <h3 className="cc-territory-cfg-title">Zonas Militares · municipios</h3>
        <p className="cc-hint">
          División territorial de la IV R.M. por municipio, Zona Militar y unidad. En el mapa
          cada unidad lleva un color propio (municipios de la misma unidad = mismo tono).
        </p>
      </div>

      <div className="cc-states-surfaces" role="group" aria-label="Capa territorial">
        <div className="cc-states-surfaces-head">
          <span className="cc-states-surfaces-title">Capa municipal</span>
        </div>
        <div className="cc-states-surfaces-checks cc-territory-toggles">
          <label className={`cc-states-surface-item${config.layerEnabled !== false ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={config.layerEnabled !== false}
              onChange={() =>
                update((prev) => ({ ...prev, layerEnabled: prev.layerEnabled === false }))
              }
            />
            <span className="cc-states-surface-text">
              <span className="cc-states-surface-name">Mostrar municipios</span>
              <span className="cc-states-surface-hint">Polígonos por Z.M.</span>
            </span>
          </label>
          <label className={`cc-states-surface-item${config.showColors !== false ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={config.showColors !== false}
              onChange={() =>
                update((prev) => ({ ...prev, showColors: prev.showColors === false }))
              }
            />
            <span className="cc-states-surface-text">
              <span className="cc-states-surface-name">Colores de zona</span>
              <span className="cc-states-surface-hint">Sin color = solo bordes</span>
            </span>
          </label>
        </div>
      </div>

      <div
        className="cc-states-surfaces"
        role="group"
        aria-label="Mapas donde aplicar la capa territorial"
      >
        <div className="cc-states-surfaces-head">
          <span className="cc-states-surfaces-title">Mostrar en mapas</span>
          <span className="cc-states-surfaces-count">
            {surfacesOn} de {IV_RM_TERRITORY_SURFACES.length}
          </span>
        </div>
        <div className="cc-states-surfaces-checks">
          {IV_RM_TERRITORY_SURFACES.map((s) => {
            const on = isTerritorySurfaceEnabled(config, s.id);
            return (
              <label
                key={s.id}
                className={`cc-states-surface-item${on ? ' on' : ''}`}
                title={s.hint}
              >
                <input type="checkbox" checked={on} onChange={() => setSurface(s.id, !on)} />
                <span className="cc-states-surface-text">
                  <span className="cc-states-surface-name">{s.label}</span>
                  <span className="cc-states-surface-hint">{s.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <ul className="channel-dual-list cc-states-list" aria-label="Zonas Militares IV R.M.">
        {IV_RM_ZONAS.map((z) => {
          const enabled = isZonaEnabled(config, z.id);
          const color = zonaColor(config, z.id);
          return (
            <li
              key={z.id}
              className={`channel-dual-row cc-states-row${enabled ? ' on' : ''}`}
            >
              <label className="channel-dual-item">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleZona(z.id)}
                />
                <span className="channel-dual-text">
                  <span className="channel-dual-name">{z.label}</span>
                  <span className="channel-dual-meta">{z.estado}</span>
                </span>
              </label>
              <button
                type="button"
                className="cc-states-swatch"
                style={{ background: color }}
                title={`${color} — color de ${z.short}`}
                aria-label={`Color de ${z.label}`}
                disabled={!enabled}
                onClick={() => openColorPicker(z.id)}
              />
            </li>
          );
        })}
      </ul>

      <div className="cc-states-actions">
        <span className="cc-hint" style={{ marginRight: 'auto' }}>
          {zonasOn} de {IV_RM_ZONAS.length} zonas
        </span>
        <button
          type="button"
          className="cc-btn ghost"
          onClick={() => update(defaultIvRmTerritoryConfig())}
        >
          Restaurar zonas
        </button>
      </div>
    </section>
  );
}
