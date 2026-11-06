import { useMemo } from 'react';
import MapCheckSelect from './MapCheckSelect.jsx';
import MapTreeCheckSelect from './MapTreeCheckSelect.jsx';

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

function flattenTreeUnits(nodes) {
  const out = [];
  for (const region of nodes || []) {
    for (const zone of region.children || []) {
      for (const unit of zone.children || []) {
        out.push({
          unidad: String(unit.id),
          zonaId: String(zone.id),
          regionId: String(region.id),
        });
      }
    }
  }
  return out;
}

function flattenTreeZonas(nodes) {
  const out = [];
  for (const region of nodes || []) {
    for (const zone of region.children || []) {
      out.push({ id: String(zone.id), regionId: String(region.id) });
    }
  }
  return out;
}

/**
 * Barra de filtros Territorio: 2 selects en cascada
 * (Región→Zona→Unidad | Estado→Municipio) + colores.
 */
export default function TerritoryOpsPanel({
  filter,
  onChange,
  showColors,
  onShowColors,
  municipios = [],
  regions = [],
  onHoverPreview = null,
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

  const allUnidades = useMemo(() => flattenTreeUnits(regions), [regions]);
  const allZonas = useMemo(() => flattenTreeZonas(regions), [regions]);

  const scopedFeatures = useMemo(
    () => featuresForZonaUnidad(municipios, zonaSet, unidadSet),
    [municipios, zonaSet, unidadSet]
  );

  const municipioItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const f of scopedFeatures) {
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
  }, [scopedFeatures]);

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

  function estadosFromMunicipios(muniIds, scoped) {
    const set = new Set();
    for (const id of muniIds) {
      const f = (scoped || municipios || []).find(
        (x) => String(x.properties?.shapeID) === String(id)
      );
      const e = featureEstado(f);
      if (e) set.add(e);
    }
    return [...set];
  }

  function onAdscripcionChange({ zonaIds: nextZonaIds, unidadIds: nextUnidadIds }) {
    const nextZonaSet = new Set((nextZonaIds || []).map(String));
    const nextUnidadSet = new Set((nextUnidadIds || []).map(String));
    const prevZona = zonaSet;
    const prevUnidad = unidadSet;
    const addedZonas = (nextZonaIds || []).filter((id) => !prevZona.has(String(id)));
    const addedUnidades = (nextUnidadIds || []).filter((id) => !prevUnidad.has(String(id)));

    const scoped = featuresForZonaUnidad(municipios, nextZonaSet, nextUnidadSet);
    const estadosInScope = uniqueEstados(scoped);
    const estadoKeep = estadoIds.filter((e) => estadosInScope.includes(e));
    let nextEstados = [...estadoKeep];
    const addedEstados = uniqueEstados(
      (municipios || []).filter((f) => {
        const zid = String(f.properties?.zonaId || '');
        if (addedZonas.some((z) => String(z) === zid)) return true;
        return featureUnidades(f).some((u) => addedUnidades.includes(u));
      })
    );
    for (const e of addedEstados) {
      if (estadosInScope.includes(e) && !nextEstados.includes(e)) nextEstados.push(e);
    }
    // Si no había estados y se acaba de marcar adscripción, rellenar todos los del alcance.
    if (!estadoIds.length && nextEstados.length === 0 && estadosInScope.length) {
      nextEstados = [...estadosInScope];
    }

    patch({
      zonaIds: (nextZonaIds || []).map(String),
      unidadIds: (nextUnidadIds || []).map(String),
      estadoIds: nextEstados,
      municipioIds: pruneAndFillMunicipios(
        nextZonaSet,
        nextUnidadSet,
        nextEstados,
        addedEstados.length ? addedEstados : nextEstados.filter((e) => !estadoIds.includes(e)),
        addedZonas,
        addedUnidades
      ),
    });
  }

  function onMunicipioChange(nextMuniIds) {
    const ids = nextMuniIds.map(String);
    const scoped = featuresForZonaUnidad(municipios, zonaSet, unidadSet);
    patch({
      municipioIds: ids,
      estadoIds: estadosFromMunicipios(ids, scoped),
    });
  }

  return (
    <div className="map-ops-panel map-ops-panel--row map-ops-panel--territorio">
      <MapTreeCheckSelect
        fieldLabel="Región / Zona / Unidad"
        nodes={regions}
        zonaIds={zonaIds}
        unidadIds={unidadIds}
        onChange={onAdscripcionChange}
        onHoverPreview={onHoverPreview}
        emptyMessage={
          allZonas.length || allUnidades.length
            ? 'Sin coincidencias'
            : 'Sin regiones con cobertura. Configure Catálogos → Territorio.'
        }
        hintTitle="Bolita = color del mapa. Al pasar el mouse se resaltan esos municipios. Solo regiones con cobertura en Catálogos → Territorio."
        searchPlaceholder="Buscar región, zona o unidad…"
      />

      <MapCheckSelect
        fieldLabel="Estado / Municipio"
        items={municipioItems}
        selectedIds={municipioIds}
        onChange={onMunicipioChange}
        allWord="Todos"
        emptyMessage={
          unidadIds.length || zonaIds.length
            ? 'Sin municipios en la selección'
            : 'Marque región, zona o unidad'
        }
        hintTitle="Estado se pliega con sus municipios. El check del estado marca el grupo. Ascendente/Descendente ordena municipios; estados A–Z."
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
    </div>
  );
}
