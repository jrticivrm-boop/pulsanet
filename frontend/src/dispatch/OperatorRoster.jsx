import { useEffect, useState } from 'react';
import { openPeerSheet } from '../peerActions';
import { gpsStatusLine, isFresh } from './liveTiming.js';
import { PRESENCE_LABELS } from './presenceStatus.js';
import { MapCoordsLink } from './MapCoordsLink.jsx';

function statusPillClass(status) {
  if (status === 'online') return ' on';
  if (status === 'away') return ' away';
  if (status === 'stale') return ' stale';
  return ' off';
}

/**
 * Lista lateral de operadores con GPS + detalle del seleccionado (Seguir / Contactar).
 * Compartida por Consola de Operaciones y el mapa de Radio (LiveTrackMap).
 * `people` llega ya filtrado/ordenado; `statusOf(p, now)` resuelve la presencia.
 */
export default function OperatorRoster({
  title = 'Seguimiento en vivo',
  people,
  statusOf,
  listPhoto,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  follow,
  onFollowChange,
  open,
  onToggle,
  extraKpis = null,
  error = '',
  emptyText = 'Nadie comparte GPS aún. Abre la app móvil o Radio web con ubicación activa.',
  selectedTrailCount = 0,
  hint = '',
  now: nowProp,
  className = '',
}) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (nowProp != null) return undefined;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [nowProp]);
  const now = nowProp ?? tick;

  const liveCount = people.filter((p) => isFresh(p.recordedAt, now)).length;
  const selected = people.find((p) => p.userId === selectedId) || null;

  return (
    <aside
      className={`lt-sheet${open ? '' : ' is-collapsed'}${className ? ` ${className}` : ''}`}
      aria-label="Lista de operadores"
    >
      <header className="lt-sheet-head">
        <div className="lt-sheet-head-row">
          <h1>{title}</h1>
          <button
            type="button"
            className="lt-sheet-toggle"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls="lt-sheet-body"
            title={open ? 'Ocultar lista' : 'Mostrar lista'}
          >
            <span className="lt-sheet-toggle-ico" aria-hidden="true">
              {open ? '◂' : '▸'}
            </span>
            <span className="lt-sheet-toggle-label">{open ? 'Ocultar' : 'Lista'}</span>
          </button>
        </div>
        {open ? (
          <div className="lt-kpi-row" role="status" aria-live="polite">
            <span className={`lt-kpi${liveCount > 0 ? ' lt-kpi--live' : ''}`}>
              {liveCount} en vivo
            </span>
            <span className="lt-kpi">{people.length} con GPS</span>
            {extraKpis}
          </div>
        ) : (
          <div className="lt-sheet-collapsed-meta" role="status">
            <span className={`lt-kpi${liveCount > 0 ? ' lt-kpi--live' : ''}`}>
              {liveCount} en vivo
            </span>
            <span className="lt-kpi">{people.length} GPS</span>
          </div>
        )}
      </header>

      <div id="lt-sheet-body" className="lt-sheet-body" hidden={!open} aria-hidden={!open}>
        <div className="lt-tools">
          <input
            type="search"
            placeholder="Buscar operador…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Buscar operador"
          />
        </div>

        {error && <p className="lt-error">{error}</p>}

        <ul className="lt-people">
          {people.length === 0 && <li className="lt-empty">{emptyText}</li>}
          {people.map((p) => {
            const fresh = isFresh(p.recordedAt, now);
            const status = statusOf(p, now);
            const photo = listPhoto(p);
            return (
              <li key={p.userId}>
                <button
                  type="button"
                  className={`lt-person${selectedId === p.userId ? ' selected' : ''}`}
                  onClick={() => onSelect(p)}
                >
                  <span className={`lt-avatar${fresh ? ' live' : ''}`}>
                    {photo ? <img src={photo} alt="" /> : (p.displayName || '?').charAt(0).toUpperCase()}
                    {fresh ? <i className="lt-avatar-pulse" aria-hidden="true" /> : null}
                  </span>
                  <span className="lt-person-meta">
                    <strong>{p.displayName}</strong>
                    <em>
                      {gpsStatusLine(p.recordedAt, now)}
                      {` · ${PRESENCE_LABELS[status] || status}`}
                      {p.accuracyM != null ? ` · ±${Math.round(p.accuracyM)} m` : ''}
                    </em>
                  </span>
                  <span className={`lt-status-pill${statusPillClass(status)}`}>
                    {PRESENCE_LABELS[status] || status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected && (
          <div className="lt-detail">
            <div className="lt-detail-head">
              <strong>{selected.displayName}</strong>
              <label className="lt-follow">
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(e) => onFollowChange(e.target.checked)}
                />
                Seguir
              </label>
            </div>
            <p>
              <MapCoordsLink lat={selected.latitude} lng={selected.longitude} />
            </p>
            <p>
              {gpsStatusLine(selected.recordedAt, now)}
              {selectedTrailCount > 1 ? ` (${selectedTrailCount} puntos)` : ''}
            </p>
            <button
              type="button"
              className="cc-btn primary"
              style={{ marginTop: '0.65rem', width: '100%' }}
              onClick={() =>
                openPeerSheet({
                  id: selected.userId,
                  displayName: selected.displayName,
                })
              }
            >
              Contactar
            </button>
            {hint ? (
              <p className="lt-detail-hint" style={{ marginTop: '0.45rem', fontSize: '0.85rem' }}>
                {hint}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
