import { useCallback, useMemo, useState } from 'react';
import {
  enabledIvRmStates,
  isSurfaceEnabled,
  useIvRmStatesConfig,
} from './ivRmStatesConfig.js';

const STORAGE_KEY = 'tacticalptx_ivrm_legend_collapsed';

function loadCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Leyenda de estados IV R.M. (2 filas en grid alineado, colapsable a la derecha).
 * `surface`: consola | seguimiento | radio — respeta Config → Estados.
 */
export default function IvRmStatesLegend({ surface = 'seguimiento' }) {
  const [config] = useIvRmStatesConfig();
  const items = useMemo(() => {
    if (!isSurfaceEnabled(config, surface)) return [];
    return enabledIvRmStates(config);
  }, [config, surface]);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  if (!items.length) return null;

  const cols = Math.max(1, Math.ceil(items.length / 2));

  return (
    <div
      className={`lt-state-legend${collapsed ? ' lt-state-legend--collapsed' : ''}`}
      aria-label="Estados IV R.M."
    >
      <div className="lt-state-legend__panel">
        <div
          className="lt-state-legend__grid"
          style={{ '--lt-legend-cols': cols }}
          {...(collapsed ? { inert: true } : {})}
        >
          {items.map((s) => (
            <span key={s.id} className="lt-state-legend-item">
              <i style={{ background: s.color }} aria-hidden />
              <span className="lt-state-legend-item__name">{s.name}</span>
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="lt-state-legend__toggle"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={
          collapsed ? 'Mostrar leyenda de estados' : 'Ocultar leyenda de estados'
        }
        title={collapsed ? 'Mostrar estados' : 'Ocultar leyenda'}
      >
        {collapsed ? (
          <>
            <span className="lt-state-legend__toggle-label">Estados</span>
            <span className="lt-state-legend__chevron" aria-hidden>
              ‹
            </span>
          </>
        ) : (
          <span className="lt-state-legend__chevron" aria-hidden>
            ›
          </span>
        )}
      </button>
    </div>
  );
}
