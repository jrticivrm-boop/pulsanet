import { useMemo } from 'react';
import {
  IV_RM_ZONAS,
  listTerritoryUnidades,
} from './ivRmTerritoryConfig.js';

/**
 * Barra de filtros territoriales (pestaña Consola → Territorio).
 * Misma fila compacta que Sitios / Operadores.
 */
export default function TerritoryOpsPanel({
  filter,
  onChange,
  showColors,
  onShowColors,
  filterUsers,
  onFilterUsers,
  municipios = [],
  onFit,
}) {
  const unidades = useMemo(() => {
    const all = listTerritoryUnidades();
    if (!filter?.zonaId) return all;
    return all.filter((u) => u.zonaId === filter.zonaId);
  }, [filter?.zonaId]);

  const muniOptions = useMemo(() => {
    let list = municipios || [];
    if (filter?.zonaId) list = list.filter((f) => f.properties?.zonaId === filter.zonaId);
    if (filter?.unidad) {
      const u = filter.unidad;
      list = list.filter((f) => {
        const units = f.properties?.unidades || [f.properties?.unidad];
        return (units || []).includes(u) || f.properties?.unidad === u;
      });
    }
    return [...list].sort((a, b) =>
      String(a.properties?.municipio || '').localeCompare(
        String(b.properties?.municipio || ''),
        'es'
      )
    );
  }, [municipios, filter?.zonaId, filter?.unidad]);

  function patch(partial) {
    onChange({ ...(filter || {}), ...partial });
  }

  return (
    <div className="map-ops-panel map-ops-panel--row map-ops-panel--territorio">
      <label className="map-field map-field--ops-primary">
        <span className="map-field-label-row">
          Región
          <span
            className="cc-ms-hint map-ops-field-hint"
            title="IV R.M. = Nuevo León, Tamaulipas y San Luis Potosí (todas las Z.M.)."
          >
            ?
          </span>
        </span>
        <select
          value="ivrm"
          disabled
          aria-label="Región militar"
        >
          <option value="ivrm">IV R.M.</option>
        </select>
      </label>

      <label className="map-field">
        <span className="map-field-label-row">Zona</span>
        <select
          value={filter?.zonaId || ''}
          onChange={(e) => {
            const zonaId = e.target.value || null;
            patch({ zonaId, unidad: null, municipioId: null });
          }}
          aria-label="Zona Militar"
        >
          <option value="">Todas</option>
          {IV_RM_ZONAS.map((z) => (
            <option key={z.id} value={z.id}>
              {z.short} · {z.estado}
            </option>
          ))}
        </select>
      </label>

      <label className="map-field">
        <span className="map-field-label-row">Unidad</span>
        <select
          value={filter?.unidad || ''}
          onChange={(e) => {
            const unidad = e.target.value || null;
            patch({ unidad, municipioId: null });
          }}
          aria-label="Unidad militar"
        >
          <option value="">Todas</option>
          {unidades.map((u) => (
            <option key={u.unidad} value={u.unidad}>
              {u.unidad}
            </option>
          ))}
        </select>
      </label>

      <label className="map-field">
        <span className="map-field-label-row">Municipio</span>
        <select
          value={filter?.municipioId || ''}
          onChange={(e) => patch({ municipioId: e.target.value || null })}
          aria-label="Municipio"
        >
          <option value="">Todos</option>
          {muniOptions.map((f) => (
            <option key={f.properties.shapeID} value={f.properties.shapeID}>
              {f.properties.municipio}
            </option>
          ))}
        </select>
      </label>

      <label className="map-field map-field--check">
        <span className="map-field-label-row">Colores</span>
        <label className="map-ops-check">
          <input
            type="checkbox"
            checked={showColors}
            onChange={(e) => onShowColors(e.target.checked)}
          />
          <span>Relleno por unidad</span>
        </label>
      </label>

      <label className="map-field map-field--check">
        <span className="map-field-label-row">Usuarios</span>
        <label className="map-ops-check">
          <input
            type="checkbox"
            checked={filterUsers}
            onChange={(e) => onFilterUsers(e.target.checked)}
          />
          <span>Solo en selección</span>
        </label>
      </label>

      <div className="map-field map-field--actions">
        <button type="button" className="cc-btn ghost map-ops-fit-btn" onClick={onFit}>
          Encuadrar
        </button>
        <button
          type="button"
          className="cc-btn ghost map-ops-fit-btn"
          onClick={() => onChange({ zonaId: null, unidad: null, municipioId: null })}
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
