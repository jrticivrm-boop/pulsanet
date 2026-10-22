import { useMemo } from 'react';
import {
  IV_RM_ZONAS,
  listTerritoryUnidades,
} from './ivRmTerritoryConfig.js';
import MapCheckSelect from './MapCheckSelect.jsx';

function featureUnidades(f) {
  const p = f?.properties || {};
  if (Array.isArray(p.unidades) && p.unidades.length) {
    return p.unidades.map((u) => String(u).trim()).filter(Boolean);
  }
  return String(p.unidad || '')
    .split(' / ')
    .map((u) => u.trim())
    .filter(Boolean);
}

function featureEstado(f) {
  return String(f?.properties?.estado || '').trim();
}

function uniqueEstados(features) {
  const seen = new Set();
  const out = [];
  for (const f of features || []) {
    const e = featureEstado(f);
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

function featuresForZonaUnidad(municipios, zonaSet, unidadSet) {
  let list = municipios || [];
  if (zonaSet.size) list = list.filter((f) => zonaSet.has(String(f.properties?.zonaId || '')));
  if (unidadSet.size) {
    list = list.filter((f) => featureUnidades(f).some((u) => unidadSet.has(u)));
  }
  return list;
}

/**
 * Barra de filtros territoriales (pestaña Consola → Territorio).
 * Multi-check como Operadores → Grupos (sin «Todos»).
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
  onReset,
}) {
  const zonaIds = useMemo(() => (filter?.zonaIds || []).map(String), [filter?.zonaIds]);
  const unidadIds = useMemo(() => (filter?.unidadIds || []).map(String), [filter?.unidadIds]);
  const estadoIds = useMemo(() => (filter?.estadoIds || []).map(String), [filter?.estadoIds]);
  const municipioIds = useMemo(
    () => (filter?.municipioIds || []).map(String),
    [filter?.municipioIds]
  );
  const zonaSet = useMemo(() => new Set(zonaIds), [zonaIds]);
  const unidadSet = useMemo(() => new Set(unidadIds), [unidadIds]);
  const estadoSet = useMemo(() => new Set(estadoIds), [estadoIds]);

  const zonaItems = useMemo(
    () =>
      IV_RM_ZONAS.map((z) => ({
        id: String(z.id),
        label: `${z.short} · ${z.estado}`,
      })),
    []
  );

  const allUnidades = useMemo(() => {
    const fromCatalog = listTerritoryUnidades();
    const extra = [];
    const seen = new Set(fromCatalog.map((u) => u.unidad));
    for (const f of municipios || []) {
      const zonaId = String(f.properties?.zonaId || '');
      for (const u of featureUnidades(f)) {
        if (!u || seen.has(u)) continue;
        seen.add(u);
        extra.push({ unidad: u, zonaId });
      }
    }
    return extra.length ? [...fromCatalog, ...extra] : fromCatalog;
  }, [municipios]);

  const unidadItems = useMemo(() => {
    const list = zonaSet.size ? allUnidades.filter((u) => zonaSet.has(String(u.zonaId))) : [];
    return list.map((u) => ({ id: u.unidad, label: u.unidad }));
  }, [allUnidades, zonaSet]);

  const scopedFeatures = useMemo(
    () => featuresForZonaUnidad(municipios, zonaSet, unidadSet),
    [municipios, zonaSet, unidadSet]
  );

  const estadoItems = useMemo(
    () => uniqueEstados(scopedFeatures).map((e) => ({ id: e, label: e })),
    [scopedFeatures]
  );

  const muniFeatures = useMemo(() => {
    if (!estadoSet.size) return [];
    return scopedFeatures.filter((f) => estadoSet.has(featureEstado(f)));
  }, [scopedFeatures, estadoSet]);

  const municipioItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const f of muniFeatures) {
      const id = String(f.properties?.shapeID || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        label: String(f.properties?.municipio || f.properties?.shapeName || id),
        group: featureEstado(f),
      });
    }
    return items;
  }, [muniFeatures]);

  function patch(partial) {
    onChange({
      zonaIds,
      unidadIds,
      estadoIds,
      municipioIds,
      ...(filter || {}),
      ...partial,
    });
  }

  function pruneAndFillMunicipios(
    nextZonaSet,
    nextUnidadSet,
    nextEstadoIds,
    addedEstadoNames,
    addedZonaIds,
    addedUnidadNames
  ) {
    const scoped = featuresForZonaUnidad(municipios, nextZonaSet, nextUnidadSet);
    const estadoNextSet = new Set(nextEstadoIds.map(String));
    const muniKeep = municipioIds.filter((id) => {
      const f = (municipios || []).find((x) => String(x.properties?.shapeID) === String(id));
      if (!f) return false;
      if (nextZonaSet.size && !nextZonaSet.has(String(f.properties?.zonaId || ''))) return false;
      if (nextUnidadSet.size && !featureUnidades(f).some((u) => nextUnidadSet.has(u))) return false;
      return estadoNextSet.has(featureEstado(f));
    });
    let nextMuni = [...muniKeep];
    const fillEstados = new Set((addedEstadoNames || []).map(String));
    const fillZonas = new Set((addedZonaIds || []).map(String));
    const fillUnits = new Set((addedUnidadNames || []).map(String));
    for (const f of scoped) {
      const est = featureEstado(f);
      if (!estadoNextSet.has(est)) continue;
      const zid = String(f.properties?.zonaId || '');
      const fromAddedEstado = fillEstados.has(est);
      const fromAddedZona = fillZonas.size && fillZonas.has(zid);
      const fromAddedUnit =
        fillUnits.size && featureUnidades(f).some((u) => fillUnits.has(u));
      if (!fromAddedEstado && !fromAddedZona && !fromAddedUnit) continue;
      const id = String(f.properties?.shapeID || '');
      if (id && !nextMuni.includes(id)) nextMuni.push(id);
    }
    return nextMuni;
  }

  function onZonaChange(nextZonaIds) {
    const nextSet = new Set(nextZonaIds.map(String));
    const prevSet = zonaSet;
    const added = nextZonaIds.filter((id) => !prevSet.has(String(id)));
    const unidadKeep = unidadIds.filter((u) => {
      const row = allUnidades.find((x) => x.unidad === u);
      return row && nextSet.has(String(row.zonaId));
    });
    let nextUnidad = [...unidadKeep];
    const addedUnidades = [];
    for (const z of added) {
      for (const u of allUnidades) {
        if (String(u.zonaId) === String(z) && !nextUnidad.includes(u.unidad)) {
          nextUnidad.push(u.unidad);
          addedUnidades.push(u.unidad);
        }
      }
    }
    const unidadNextSet = new Set(nextUnidad);
    const scoped = featuresForZonaUnidad(municipios, nextSet, unidadNextSet);
    const estadosInScope = uniqueEstados(scoped);
    const estadoKeep = estadoIds.filter((e) => estadosInScope.includes(e));
    let nextEstados = [...estadoKeep];
    const addedEstados = uniqueEstados(
      featuresForZonaUnidad(
        (municipios || []).filter((f) => added.some((z) => String(f.properties?.zonaId || '') === String(z))),
        nextSet,
        unidadNextSet
      )
    );
    for (const e of addedEstados) {
      if (!nextEstados.includes(e)) nextEstados.push(e);
    }
    patch({
      zonaIds: nextZonaIds.map(String),
      unidadIds: nextUnidad,
      estadoIds: nextEstados,
      municipioIds: pruneAndFillMunicipios(
        nextSet,
        unidadNextSet,
        nextEstados,
        addedEstados,
        added,
        addedUnidades
      ),
    });
  }

  function onUnidadChange(nextUnidadIds) {
    const nextSet = new Set(nextUnidadIds.map(String));
    const prevSet = unidadSet;
    const added = nextUnidadIds.filter((id) => !prevSet.has(String(id)));
    const scoped = featuresForZonaUnidad(municipios, zonaSet, nextSet);
    const estadosInScope = uniqueEstados(scoped);
    const estadoKeep = estadoIds.filter((e) => estadosInScope.includes(e));
    let nextEstados = [...estadoKeep];
    const addedEstados = uniqueEstados(
      (municipios || []).filter((f) => {
        if (zonaSet.size && !zonaSet.has(String(f.properties?.zonaId || ''))) return false;
        return featureUnidades(f).some((u) => added.includes(u));
      })
    );
    for (const e of addedEstados) {
      if (!nextEstados.includes(e)) nextEstados.push(e);
    }
    patch({
      unidadIds: nextUnidadIds.map(String),
      estadoIds: nextEstados,
      municipioIds: pruneAndFillMunicipios(zonaSet, nextSet, nextEstados, addedEstados, [], added),
    });
  }

  function onEstadoChange(nextEstadoIds) {
    const prevSet = estadoSet;
    const added = nextEstadoIds.filter((id) => !prevSet.has(String(id)));
    patch({
      estadoIds: nextEstadoIds.map(String),
      municipioIds: pruneAndFillMunicipios(zonaSet, unidadSet, nextEstadoIds, added, []),
    });
  }

  return (
    <div className="map-ops-panel map-ops-panel--row map-ops-panel--territorio">
      <label className="map-field map-field--ops-primary">
        <span className="map-field-label-row">
          Región
          <span
            className="cc-ms-hint map-ops-field-hint"
            title="IV R.M. = Nuevo León, Tamaulipas y San Luis Potosí (todas las Z.M.). Más regiones se agregan en Catálogos → Dependencias."
          >
            ?
          </span>
        </span>
        <select value="ivrm" disabled aria-label="Región militar">
          <option value="ivrm">IV R.M.</option>
        </select>
      </label>

      <MapCheckSelect
        fieldLabel="Zona"
        items={zonaItems}
        selectedIds={zonaIds}
        onChange={onZonaChange}
        allWord="Todas"
        emptyMessage="Sin zonas"
        hintTitle="Ascendente/Descendente ordena. Marcar/Desmarcar alterna las zonas visibles. Sin «Todas»: vacío no muestra territorio."
        searchPlaceholder="Buscar zona…"
      />

      <MapCheckSelect
        fieldLabel="Unidad"
        items={unidadItems}
        selectedIds={unidadIds}
        onChange={onUnidadChange}
        allWord="Todas"
        emptyMessage={zonaIds.length ? 'Sin unidades' : 'Marca una zona'}
        hintTitle="Ascendente/Descendente ordena. Marcar/Desmarcar alterna las unidades de las zonas marcadas."
        searchPlaceholder="Buscar unidad…"
      />

      <MapCheckSelect
        fieldLabel="Estado"
        items={estadoItems}
        selectedIds={estadoIds}
        onChange={onEstadoChange}
        allWord="Todos"
        emptyMessage={unidadIds.length ? 'Sin estados' : 'Marca una unidad'}
        hintTitle="Solo estados de la selección Zona/Unidad. Marcar un estado muestra sus municipios abajo."
        searchPlaceholder="Buscar estado…"
      />

      <MapCheckSelect
        fieldLabel="Municipio"
        items={municipioItems}
        selectedIds={municipioIds}
        onChange={(ids) => patch({ municipioIds: ids.map(String) })}
        allWord="Todos"
        emptyMessage={estadoIds.length ? 'Sin municipios' : 'Marca un estado'}
        hintTitle="El estado se pliega con sus municipios. El check del estado marca todos. Ascendente/Descendente ordena municipios; los estados quedan A–Z."
        searchPlaceholder="Buscar municipio o estado…"
      />

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
        <button type="button" className="cc-btn ghost map-ops-fit-btn" onClick={onReset}>
          Limpiar
        </button>
      </div>
    </div>
  );
}
