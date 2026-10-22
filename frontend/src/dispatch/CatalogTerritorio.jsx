import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCatalogTerritorio,
  fetchDependencias,
  fetchGeoEstados,
  fetchGeoMunicipios,
  putCatalogTerritorio,
} from '../api';
import { canModuleAction } from './modulePermissions.js';
import { IV_RM_COVERAGE_EVENT, IV_RM_ZONAS } from './ivRmTerritoryConfig.js';
import AppDialog from '../AppDialog.jsx';

function zonaMeta(zonaKey, zonaShort) {
  const z = IV_RM_ZONAS.find((row) => row.id === zonaKey);
  return {
    key: zonaKey || '',
    short: zonaShort || z?.short || zonaKey || '',
    label: z ? `${z.short} · ${z.estado}` : zonaShort || zonaKey || 'Zona',
  };
}

function unitKey(u) {
  return `${u.zonaKey || ''}|${u.unidadName || ''}`;
}

export default function CatalogTerritorio({ session }) {
  const canEdit = canModuleAction(session.user, 'catalogos', 'editar');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [rows, setRows] = useState([]);
  const [depTree, setDepTree] = useState([]);
  const [estados, setEstados] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [estado, setEstado] = useState('');
  const [municipios, setMunicipios] = useState([]);
  const [muniLoading, setMuniLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cov, deps, geo] = await Promise.all([
        fetchCatalogTerritorio(session.token),
        fetchDependencias(session.token).catch(() => ({ tree: [] })),
        fetchGeoEstados(session.token).catch(() => ({ estados: [] })),
      ]);
      setUnits(cov.units || []);
      setRows(cov.rows || []);
      setDepTree(deps.tree || []);
      setEstados(geo.estados || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar el territorio.');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  const mergedUnits = useMemo(() => {
    const list = [...units];
    const seen = new Set(list.map(unitKey));
    for (const region of depTree || []) {
      for (const zone of region.children || []) {
        const z = IV_RM_ZONAS.find(
          (row) =>
            String(zone.name || '').includes(row.short) ||
            String(zone.name || '').toLowerCase().includes(row.id)
        );
        const zonaKey = z?.id || '';
        const zonaShort = z?.short || zone.name;
        for (const org of zone.children || []) {
          const u = {
            unidadName: org.name,
            zonaKey,
            zonaShort,
            regionLabel: region.name || 'IV R.M.',
            regionId: region.id,
            zoneId: zone.id,
            unitId: org.id,
            municipioCount: 0,
            fromDependencias: true,
          };
          const k = unitKey(u);
          if (seen.has(k)) continue;
          const byName = list.find((x) => x.unidadName === org.name);
          if (byName) continue;
          seen.add(k);
          list.push(u);
        }
      }
    }
    return list;
  }, [units, depTree]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const u of mergedUnits) {
      const meta = zonaMeta(u.zonaKey, u.zonaShort);
      const key = meta.key || meta.short;
      if (!map.has(key)) map.set(key, { ...meta, units: [] });
      map.get(key).units.push(u);
    }
    return [...map.values()];
  }, [mergedUnits]);

  const selected = mergedUnits.find((u) => unitKey(u) === selectedKey) || null;

  const assignedNames = useMemo(() => {
    if (!selected || !estado) return [];
    const est = String(estado).toLowerCase();
    return rows
      .filter(
        (r) =>
          r.unidadName === selected.unidadName &&
          String(r.estado || '').toLowerCase() === est
      )
      .map((r) => r.municipio);
  }, [rows, selected, estado]);

  useEffect(() => {
    if (!selectedKey) return;
    const u = mergedUnits.find((x) => unitKey(x) === selectedKey);
    if (!u) return;
    const first = rows.find((r) => r.unidadName === u.unidadName)?.estado || '';
    if (first) setEstado(first);
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!estado) {
      setMunicipios([]);
      return undefined;
    }
    let alive = true;
    setMuniLoading(true);
    fetchGeoMunicipios(session.token, { estado })
      .then((data) => {
        if (!alive) return;
        setMunicipios(data.municipios || []);
      })
      .catch(() => {
        if (alive) setMunicipios([]);
      })
      .finally(() => {
        if (alive) setMuniLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [estado, session.token]);

  const q = query.trim().toLowerCase();
  const visibleMunis = useMemo(() => {
    const list = municipios || [];
    if (!q) return list;
    return list.filter((m) => String(m.name || '').toLowerCase().includes(q));
  }, [municipios, q]);

  async function saveMunicipios(nextNames) {
    if (!selected || !estado || !canEdit) return;
    setBusy(true);
    try {
      const zonaKey =
        selected.zonaKey ||
        IV_RM_ZONAS.find((z) => String(selected.zonaShort || '').includes(z.short))?.id ||
        selected.zonaShort;
      const data = await putCatalogTerritorio(session.token, {
        unidadName: selected.unidadName,
        zonaKey,
        zonaShort: selected.zonaShort || zonaKey,
        regionLabel: selected.regionLabel,
        regionId: selected.regionId,
        zoneId: selected.zoneId,
        unitId: selected.unitId,
        estado,
        municipios: nextNames,
      });
      setUnits(data.units || []);
      setRows(data.rows || []);
      setSelectedKey(`${zonaKey}|${selected.unidadName}`);
      window.dispatchEvent(new Event(IV_RM_COVERAGE_EVENT));
    } catch (e) {
      setDialog({ title: 'Error', message: e.message || 'No se pudo guardar', alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function toggleMuni(name) {
    const has = assignedNames.includes(name);
    const next = has ? assignedNames.filter((n) => n !== name) : [...assignedNames, name];
    saveMunicipios(next);
  }

  function markVisible(on) {
    const visibleNames = visibleMunis.map((m) => m.name);
    if (on) {
      const next = [...assignedNames];
      for (const n of visibleNames) {
        if (!next.includes(n)) next.push(n);
      }
      saveMunicipios(next);
      return;
    }
    const drop = new Set(visibleNames);
    saveMunicipios(assignedNames.filter((n) => !drop.has(n)));
  }

  const visibleAssigned = visibleMunis.filter((m) => assignedNames.includes(m.name)).length;
  const allVisibleOn = visibleMunis.length > 0 && visibleAssigned === visibleMunis.length;

  if (loading) return <p className="cc-hint">Cargando territorio…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  return (
    <div className="cc-cat-grades-wrap cc-territorio-cat">
      <p className="cc-cat-hint">
        Asigne unidades a municipios del registro nacional. No se dan de alta ni se borran estados
        ni municipios. Las unidades salen de Dependencias; para otra región, créela ahí y delimite
        igual que IV R.M.
      </p>
      <div className="cc-territorio-split">
        <aside className="cc-territorio-units" aria-label="Unidades">
          {grouped.length === 0 ? (
            <span className="cc-hint">Sin unidades. Revise Catálogos → Dependencias.</span>
          ) : (
            grouped.map((g) => (
              <section key={g.key || g.short} className="cc-territorio-zona">
                <h3>{g.label}</h3>
                <div className="cc-territorio-unit-list">
                  {g.units.map((u) => {
                    const k = unitKey(u);
                    const n = units.find((x) => x.unidadName === u.unidadName)?.municipioCount || 0;
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`cc-territorio-unit${k === selectedKey ? ' is-on' : ''}`}
                        onClick={() => {
                          setSelectedKey(k);
                          setQuery('');
                        }}
                      >
                        <span>{u.unidadName}</span>
                        <em>{n}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </aside>
        <section className="cc-territorio-assign">
          {!selected ? (
            <p className="cc-hint">Seleccione una unidad para asignar municipios.</p>
          ) : (
            <>
              <header className="cc-territorio-assign-head">
                <strong>{selected.unidadName}</strong>
                <span>
                  {selected.zonaShort} · {selected.regionLabel || 'IV R.M.'}
                </span>
              </header>
              <label className="cc-territorio-estado">
                Estado
                <select
                  value={estado}
                  onChange={(e) => {
                    setEstado(e.target.value);
                    setQuery('');
                  }}
                  aria-label="Estado"
                >
                  <option value="">Seleccione…</option>
                  {estados.map((e) => (
                    <option key={e.code || e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              {!estado ? (
                <p className="cc-hint">Elija un estado para ver sus municipios.</p>
              ) : muniLoading ? (
                <p className="cc-hint">Cargando municipios…</p>
              ) : (
                <>
                  <div className="cc-territorio-muni-tools">
                    <input
                      type="search"
                      className="cc-cat-input"
                      placeholder="Buscar municipio…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {canEdit ? (
                      <button
                        type="button"
                        className="cc-ms-link"
                        disabled={busy || !visibleMunis.length}
                        onClick={() => markVisible(!allVisibleOn)}
                      >
                        {allVisibleOn ? 'Desmarcar visibles' : 'Marcar visibles'}
                      </button>
                    ) : null}
                    <span className="cc-hint">
                      {assignedNames.length} asignados
                      {q ? ` · ${visibleMunis.length} visibles` : ''}
                    </span>
                  </div>
                  {visibleMunis.length === 0 ? (
                    <p className="cc-hint">Sin municipios en este estado.</p>
                  ) : (
                    <div className="cc-territorio-munis">
                      {visibleMunis.map((m) => {
                        const on = assignedNames.includes(m.name);
                        return (
                          <label key={m.code || m.name} className={on ? 'is-on' : ''}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!canEdit || busy}
                              onChange={() => toggleMuni(m.name)}
                            />
                            <span>{m.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        alertOnly={dialog?.alertOnly}
        confirmLabel="Aceptar"
        onCancel={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
      />
    </div>
  );
}
