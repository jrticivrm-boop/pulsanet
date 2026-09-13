import { useMemo, useRef, useState } from 'react';
import {
  IV_RM_IDS,
  IV_RM_STATE_DEFS,
  IV_RM_SURFACES,
  defaultIvRmStatesConfig,
  defaultSurfaces,
  isStateEnabled,
  isSurfaceEnabled,
  stateColor,
  useIvRmStatesConfig,
} from './ivRmStatesConfig.js';

/** Búsqueda insensible a acentos y mayúsculas ("michoacan" → Michoacán). */
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
 * Configuración → Estados: qué delimitaciones estatales se muestran en mapas
 * (Consola / Seguimiento / Radio) y con qué color.
 * Mismo patrón de lista + buscador que Configuración → Canales (Escuchar / Hablar).
 */
export default function ConfigStates() {
  const [config, update] = useIvRmStatesConfig();
  const colorInputRef = useRef(null);
  const editingIdRef = useRef('');
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState('asc');

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

  const selectedCount = useMemo(
    () => IV_RM_STATE_DEFS.filter((d) => isStateEnabled(config, d.id)).length,
    [config]
  );

  function setEnabled(ids, enabled) {
    const wanted = new Set(ids);
    update((prev) => {
      const next = { ...prev };
      for (const d of IV_RM_STATE_DEFS) {
        if (!wanted.has(d.id)) continue;
        next[d.id] = {
          enabled,
          color: stateColor(prev, d.id),
        };
      }
      return next;
    });
  }

  function toggleEnabled(id) {
    setEnabled([id], !isStateEnabled(config, id));
  }

  /** Marca / desmarca lo que se está viendo (respeta el filtro activo). */
  function toggleMarkVisible() {
    const ids = visible.map((d) => d.id);
    if (!ids.length) return;
    const allOn = ids.every((id) => isStateEnabled(config, id));
    setEnabled(ids, !allOn);
  }

  function onlyIvRm() {
    update((prev) => {
      const next = { ...prev };
      for (const d of IV_RM_STATE_DEFS) {
        next[d.id] = {
          enabled: IV_RM_IDS.includes(d.id),
          color: stateColor(prev, d.id),
        };
      }
      return next;
    });
  }

  function setColor(id, hex) {
    const color = String(hex || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) return;
    update((prev) => ({
      ...prev,
      [id]: {
        enabled: isStateEnabled(prev, id),
        color,
      },
    }));
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
    setColor(id, e.target.value);
  }

  function resetDefaults() {
    update(defaultIvRmStatesConfig());
    setQuery('');
  }

  function setSurface(id, enabled) {
    update((prev) => ({
      ...prev,
      surfaces: {
        ...defaultSurfaces(),
        ...(prev?.surfaces && typeof prev.surfaces === 'object' ? prev.surfaces : {}),
        [id]: Boolean(enabled),
      },
    }));
  }

  const allVisibleOn =
    visible.length > 0 && visible.every((d) => isStateEnabled(config, d.id));
  const filtering = Boolean(query.trim());
  const surfacesOn = IV_RM_SURFACES.filter((s) => isSurfaceEnabled(config, s.id)).length;

  return (
    <div className="cc-states-cfg">
      <header className="cc-units-head cc-cat-compact-head">
        <div>
          <h2>Estados en mapa</h2>
          <p className="cc-hint">
            Marca los estados y el color de cada delimitación. Con los checks de abajo eliges en
            qué mapas se dibujan: Consola, Seguimiento y/o Radio. Se aplica de inmediato en este
            navegador.
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

        <div
          className="cc-states-surfaces"
          role="group"
          aria-label="Mapas donde aplicar las delimitaciones"
        >
          <div className="cc-states-surfaces-head">
            <span className="cc-states-surfaces-title">Mostrar en mapas</span>
            <span className="cc-states-surfaces-count">
              {surfacesOn} de {IV_RM_SURFACES.length}
            </span>
          </div>
          <div className="cc-states-surfaces-checks">
            {IV_RM_SURFACES.map((s) => {
              const on = isSurfaceEnabled(config, s.id);
              return (
                <label
                  key={s.id}
                  className={`cc-states-surface-item${on ? ' on' : ''}`}
                  title={s.hint}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setSurface(s.id, !on)}
                  />
                  <span className="cc-states-surface-text">
                    <span className="cc-states-surface-name">{s.label}</span>
                    <span className="cc-states-surface-hint">{s.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
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
              <button
                type="button"
                className="channel-col-tool-link"
                onClick={toggleMarkVisible}
                disabled={!visible.length}
              >
                {allVisibleOn ? 'Desmarcar' : 'Marcar'}
              </button>
              <button type="button" className="channel-col-tool-link" onClick={onlyIvRm}>
                Solo IV R.M.
              </button>
              <span className="channel-col-count">
                {selectedCount} de {IV_RM_STATE_DEFS.length} seleccionados
                {filtering && visible.length !== IV_RM_STATE_DEFS.length
                  ? ` · ${visible.length} visibles`
                  : ''}
              </span>
              <span
                className="channel-col-help"
                title="Ascendente/Descendente ordena la lista. Marcar/Desmarcar alterna los estados visibles. Solo IV R.M. deja Nuevo León, Tamaulipas y San Luis Potosí. El círculo abre el selector de color. Los checks de mapas definen dónde se dibuja."
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
              const enabled = isStateEnabled(config, d.id);
              const color = stateColor(config, d.id);
              return (
                <li
                  key={d.id}
                  className={`channel-dual-row cc-states-row${enabled ? ' on' : ''}`}
                >
                  <label className="channel-dual-item">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleEnabled(d.id)}
                    />
                    <span className="channel-dual-text">
                      <span className="channel-dual-name">{d.name}</span>
                      <span className="channel-dual-meta">{d.id}</span>
                    </span>
                  </label>
                  {d.ivRm ? <span className="channel-multi-badge listen">IV R.M.</span> : null}
                  <button
                    type="button"
                    className="cc-states-swatch"
                    style={{ background: color }}
                    title={`${color} — clic para cambiar el color de ${d.name}`}
                    aria-label={`Color de ${d.name}`}
                    disabled={!enabled}
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

        <div className="cc-states-actions">
          <button type="button" className="cc-btn ghost" onClick={resetDefaults}>
            Restaurar valores por defecto
          </button>
        </div>
      </section>
    </div>
  );
}
