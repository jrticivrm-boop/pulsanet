import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IV_RM_STATE_DEFS,
  applyEstadoMapa,
  defaultSurfaces,
  getEstadoMapaView,
  isSurfaceEnabled,
  stateColor,
  useIvRmStatesConfig,
} from './ivRmStatesConfig.js';
import MapCheckSelect from './MapCheckSelect.jsx';
import { fetchDependencias, fetchRegionStates, patchUiPrefs, putRegionState } from '../api';
import { canModuleAction, canViewTab } from './modulePermissions.js';
import { syncEstadoMapa } from './estadoMapaSync.js';
import AppDialog from '../AppDialog.jsx';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const SEARCH_INDEX = new Map(
  IV_RM_STATE_DEFS.map((d) => [d.id, `${normalizeText(d.name)} ${normalizeText(d.id)}`])
);

/**
 * Configuración → Estados: qué estados tiene cada región (compartido)
 * y, por usuario, el color y en qué mapas se dibuja.
 */
export default function ConfigStates({ session }) {
  const canEdit =
    canViewTab(session?.user, 'configuracion', 'estados') &&
    canModuleAction(session?.user, 'configuracion', 'editar');
  const [config] = useIvRmStatesConfig();
  const colorInputRef = useRef(null);
  const editingIdRef = useRef('');
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [states, setStates] = useState([]);
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session?.token) return undefined;
    let alive = true;
    Promise.all([
      fetchDependencias(session.token).catch(() => ({ tree: [] })),
      syncEstadoMapa(session.token),
      fetchRegionStates(session.token).catch(() => ({ states: [] })),
    ]).then(([deps, synced]) => {
      if (!alive) return;
      const list = (deps.tree || []).map((r) => ({ id: r.id, name: r.name || r.label || 'Región' }));
      setRegions(list);
      setStates(synced?.states || []);
      setRegionId((prev) => prev || list[0]?.id || '');
    });
    return () => {
      alive = false;
    };
  }, [session?.token]);

  const visible = useMemo(() => {
    const needle = normalizeText(query);
    const list = needle
      ? IV_RM_STATE_DEFS.filter((d) => SEARCH_INDEX.get(d.id)?.includes(needle))
      : [...IV_RM_STATE_DEFS];
    list.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [query, sortDir]);

  const ownedIds = useMemo(() => {
    const set = new Set();
    for (const row of states) {
      if (String(row.regionId) === String(regionId)) set.add(row.estadoId);
    }
    return set;
  }, [states, regionId]);

  const holderById = useMemo(() => {
    const map = new Map();
    for (const row of states) {
      if (String(row.regionId) === String(regionId)) continue;
      map.set(row.estadoId, row.regionName || 'otra región');
    }
    return map;
  }, [states, regionId]);

  const regionCounts = useMemo(() => {
    const map = new Map();
    for (const row of states) {
      const id = String(row.regionId);
      map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  }, [states]);

  async function savePersonal(partial) {
    const current = getEstadoMapaView();
    const colors = {};
    for (const d of IV_RM_STATE_DEFS) colors[d.id] = stateColor(current, d.id);
    if (partial.colorId && partial.color) colors[partial.colorId] = partial.color;
    const surfaces = partial.surfaces || current.surfaces || defaultSurfaces();
    const patch = {
      estadoMapaColors: colors,
      estadoMapaSurfaces: surfaces,
    };
    if (partial.visible) patch.estadoMapaVisible = partial.visible;
    const saved = await patchUiPrefs(session.token, patch);
    const prefs = saved?.prefs || {};
    applyEstadoMapa({
      colors: prefs.estadoMapaColors || colors,
      surfaces: prefs.estadoMapaSurfaces || surfaces,
      visible: prefs.estadoMapaVisible || partial.visible || null,
    });
  }

  async function applyAssign(estadoId, assign, transfer) {
    setBusy(true);
    setErr('');
    try {
      const data = await putRegionState(session.token, {
        regionId,
        estadoId,
        assign,
        transfer,
      });
      if (data.conflict) {
        const who = data.holderName || 'otra región';
        const name = data.estado || estadoId;
        setDialog({
          title: 'Sustituir estado',
          message: `${name} está en ${who}. ¿Sustituirlo? ${who} se queda sin este estado.`,
          confirmLabel: 'Sustituir',
          onConfirm: () => applyAssign(estadoId, true, true),
        });
        return;
      }
      const next = data.states || [];
      setStates(next);
      applyEstadoMapa({ assignedIds: next.map((s) => s.estadoId) });
    } catch (e) {
      setErr(e.message || 'No se pudo guardar el estado.');
    } finally {
      setBusy(false);
    }
  }

  function toggleState(def) {
    if (!canEdit || !regionId || busy) return;
    const on = ownedIds.has(def.id);
    if (on) {
      applyAssign(def.id, false, false);
      return;
    }
    if (holderById.has(def.id)) {
      const who = holderById.get(def.id);
      setDialog({
        title: 'Sustituir estado',
        message: `${def.name} está en ${who}. ¿Sustituirlo? ${who} se queda sin este estado.`,
        confirmLabel: 'Sustituir',
        onConfirm: () => applyAssign(def.id, true, true),
      });
      return;
    }
    applyAssign(def.id, true, false);
  }

  function setSurface(id, enabled) {
    const surfaces = {
      ...defaultSurfaces(),
      ...(config?.surfaces || {}),
      [id]: Boolean(enabled),
    };
    savePersonal({ surfaces }).catch((e) => setErr(e.message || 'No se pudo guardar.'));
  }

  function openColorPicker(id) {
    editingIdRef.current = id;
    const input = colorInputRef.current;
    if (!input) return;
    input.value = stateColor(config, id);
    input.click();
  }

  function onNativeColor(e) {
    const id = editingIdRef.current;
    if (!id) return;
    const color = String(e.target.value || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) return;
    savePersonal({ colorId: id, color }).catch((err) => setErr(err.message || 'No se pudo guardar el color.'));
  }

  const mapItems = useMemo(
    () =>
      states.map((row) => ({
        id: row.estadoId,
        label: row.name || row.estadoId,
        group: row.regionName || 'Región',
      })),
    [states]
  );

  const shownIds = useMemo(
    () =>
      states
        .filter((row) => {
          const flag = config?.visible?.[row.estadoId];
          return typeof flag === 'boolean' ? flag : true;
        })
        .map((row) => row.estadoId),
    [states, config]
  );

  function setVisibleIds(ids) {
    const chosen = new Set((ids || []).map(String));
    const visible = {};
    for (const row of states) visible[row.estadoId] = chosen.has(String(row.estadoId));
    savePersonal({ visible }).catch((e) => setErr(e.message || 'No se pudo guardar.'));
  }

  const consoleOn = isSurfaceEnabled(config, 'consola');

  return (
    <div className="cc-states-cfg">
      <header className="cc-units-head cc-cat-compact-head">
        <div>
          <h2>Estados</h2>
          <p className="cc-hint">
            Elija la región y marque sus estados. Un estado solo puede estar en una región. El
            color y qué estados se pintan en el mapa son de su cuenta.
          </p>
        </div>
      </header>

      <section className="cc-card cc-states-cfg-card">
        <input
          ref={colorInputRef}
          type="color"
          className="cc-tactical-color-native"
          aria-hidden
          tabIndex={-1}
          onInput={onNativeColor}
          onChange={onNativeColor}
        />

        <label className="cc-territorio-estado">
          Región
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            aria-label="Región"
          >
            {regions.length === 0 ? <option value="">Sin regiones</option> : null}
            {regions.map((r) => {
              const n = regionCounts.get(String(r.id)) || 0;
              return (
                <option key={r.id} value={r.id}>
                  {n > 0 ? `${r.name} · ${n}` : r.name}
                </option>
              );
            })}
          </select>
        </label>

        {err ? <p className="cc-hint">{err}</p> : null}

        <div className="cc-states-map-row">
          <label className={`cc-states-console-check${consoleOn ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={consoleOn}
              onChange={() => setSurface('consola', !consoleOn)}
            />
            <span className="cc-states-console-text">
              <span className="cc-states-surface-name">Consola</span>
              <span className="cc-states-surface-hint">Mapa de Operaciones</span>
            </span>
          </label>
          <MapCheckSelect
            fieldLabel="Estados en el mapa"
            items={mapItems}
            selectedIds={shownIds}
            onChange={setVisibleIds}
            emptyMessage="Ninguna región tiene estados."
            allWord="Todos"
            searchPlaceholder="Buscar región o estado…"
            hintTitle="Elige qué estados se pintan en tu mapa. No cambia de región. Con la región marcada entran todos sus estados. La misma selección vale en Seguimiento."
          />
        </div>

        <div className="channel-col cc-states-col">
          <div className="channel-col-tools">
            <div className="channel-col-tools-row channel-col-tools-main">
              <button
                type="button"
                className="channel-col-tool-link"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              >
                {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
              </button>
              <span className="channel-col-count">
                {ownedIds.size} de esta región
                {query.trim() ? ` · ${visible.length} visibles` : ''}
              </span>
              <span
                className="channel-col-help"
                title="El check asigna el estado a la región. Si ya es de otra, pregunta si se sustituye. El círculo es el color de su cuenta. Qué estados se pintan se elige arriba."
              >
                ?
              </span>
            </div>
            <input
              type="search"
              className="channel-col-search"
              placeholder="Buscar estado o sigla…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar estado"
              autoComplete="off"
            />
          </div>

          <ul className="channel-dual-list cc-states-list" aria-label="Estados de México">
            {visible.map((d) => {
              const on = ownedIds.has(d.id);
              const taken = !on && holderById.has(d.id);
              const color = stateColor(config, d.id);
              return (
                <li
                  key={d.id}
                  className={`channel-dual-row cc-states-row${on ? ' on' : ''}${taken ? ' is-taken' : ''}`}
                >
                  <div className="channel-dual-item">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!canEdit || !regionId || busy}
                      aria-label={d.name}
                      onChange={() => toggleState(d)}
                    />
                    <span className="channel-dual-text">
                      <span className="channel-dual-name">{d.name}</span>
                      <span className="channel-dual-meta">
                        {taken ? holderById.get(d.id) : d.id}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="cc-states-swatch"
                    style={{ background: color }}
                    title={`${color} — color de su cuenta para ${d.name}`}
                    aria-label={`Color de ${d.name}`}
                    onClick={() => openColorPicker(d.id)}
                  />
                </li>
              );
            })}
            {!visible.length ? (
              <li className="channel-dual-row none">
                <span className="channel-dual-item muted">Sin coincidencias</span>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel || 'Aceptar'}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          const run = dialog?.onConfirm;
          setDialog(null);
          if (typeof run === 'function') run();
        }}
      />
    </div>
  );
}
