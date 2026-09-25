/**
 * Recuerda la última pestaña (ruta) de un módulo con sub-rutas.
 * Sirve para F5 y para volver al módulo desde el rail sin caer siempre en la 1ª pestaña.
 */

export function rememberModuleTabKey(moduleId) {
  return `tacticalptx_last_tab_${moduleId}`;
}

/** @param {string} moduleId @param {string[]} allowedPaths @param {string} fallback */
export function readRememberedTab(moduleId, allowedPaths, fallback) {
  const allowed = Array.isArray(allowedPaths) ? allowedPaths : [];
  try {
    const v = localStorage.getItem(rememberModuleTabKey(moduleId));
    if (v && allowed.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return fallback || allowed[0] || '';
}

/** @param {string} moduleId @param {string} path */
export function writeRememberedTab(moduleId, path) {
  if (!moduleId || !path) return;
  try {
    localStorage.setItem(rememberModuleTabKey(moduleId), path);
  } catch {
    /* ignore */
  }
}

/**
 * Si `pathname` coincide con una pestaña conocida, la guarda.
 * @param {string} pathname
 * @param {{ to: string }[]} tabs
 */
export function matchTabPath(pathname, tabs) {
  const list = Array.isArray(tabs) ? tabs : [];
  const exact = list.find((t) => t.to === pathname);
  if (exact) return exact.to;
  // Prefijo más largo (p. ej. sub-rutas futuras)
  let best = '';
  for (const t of list) {
    if (pathname === t.to || pathname.startsWith(`${t.to}/`)) {
      if (t.to.length > best.length) best = t.to;
    }
  }
  return best || '';
}
