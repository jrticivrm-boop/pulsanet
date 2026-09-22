/** Un solo panel multi-select abierto a la vez (mapa / toolbar). */

export const MS_PANEL_OPEN_EVENT = 'tacticalptx:ms-panel-open';

let seq = 0;

export function createMsPanelId(prefix = 'ms') {
  seq += 1;
  return `${prefix}-${seq}-${Date.now().toString(36)}`;
}

/** Avisa a los demás paneles que este se abrió (ellos deben cerrar). */
export function claimMsPanel(panelId) {
  if (typeof window === 'undefined' || !panelId) return;
  window.dispatchEvent(
    new CustomEvent(MS_PANEL_OPEN_EVENT, { detail: { id: String(panelId) } })
  );
}

/**
 * Escucha aperturas ajenas y cierra este panel.
 * @param {string} panelId
 * @param {() => void} onForeignOpen
 */
export function subscribeMsPanelExclusive(panelId, onForeignOpen) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => {
    const other = e?.detail?.id;
    if (!other || other === panelId) return;
    onForeignOpen();
  };
  window.addEventListener(MS_PANEL_OPEN_EVENT, handler);
  return () => window.removeEventListener(MS_PANEL_OPEN_EVENT, handler);
}

/**
 * Ancho inicial del panel: al menos el trigger, sin invadir el hermano a la derecha
 * (p. ej. Ruta + Horas en la misma fila).
 */
export function msPanelWidthFromTrigger(triggerEl, { minWidth = 200, preferMin = null } = {}) {
  if (!triggerEl) return minWidth;
  const r = triggerEl.getBoundingClientRect();
  let maxW = Math.max(8, window.innerWidth - r.left - 8);
  const host = triggerEl.closest('.map-field, .cc-tactical-ms') || triggerEl.parentElement;
  const sibling = host?.nextElementSibling;
  if (sibling && typeof sibling.getBoundingClientRect === 'function') {
    const sr = sibling.getBoundingClientRect();
    if (sr.left > r.left + 4) {
      maxW = Math.min(maxW, Math.max(r.width, sr.left - r.left - 8));
    }
  }
  const floor = preferMin != null ? Math.max(r.width, preferMin) : Math.max(r.width, minWidth);
  return Math.round(Math.min(floor, maxW));
}
