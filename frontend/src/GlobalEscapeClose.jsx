import { useEffect } from 'react';

/**
 * Esc cierra, en este orden:
 * 1) pantalla completa del navegador
 * 2) menús contextuales de chat + overlays marcados (en el mismo Esc)
 * 3) role=dialog aria-modal con botón de cierre conocido
 */
function closeTopOverlay() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return true;
  }

  let closed = false;

  // Menú de opciones del chat (puede quedar encima del lightbox).
  if (document.querySelector('.wa-context-menu')) {
    window.dispatchEvent(new CustomEvent('tacticalptx:close-context-menus'));
    closed = true;
  }

  const marked = [...document.querySelectorAll('[data-esc-close]')].filter(
    (el) =>
      el.getAttribute('data-esc-close') !== 'false' &&
      !el.classList.contains('wa-context-menu')
  );
  if (marked.length) {
    const top = marked[marked.length - 1];
    const btn = top.querySelector('[data-esc-close-btn]');
    if (btn instanceof HTMLElement) {
      btn.click();
      return true;
    }
    top.dispatchEvent(new CustomEvent('tacticalptx:esc-close', { bubbles: false }));
    return true;
  }

  if (closed) return true;

  const dialogs = [
    ...document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="dialog"].wa-call'),
  ];
  if (!dialogs.length) return false;
  const top = dialogs[dialogs.length - 1];
  const btn =
    top.querySelector('[data-esc-close-btn]') ||
    top.querySelector('.wa-lightbox-close') ||
    top.querySelector('.incoming-call-btn.reject') ||
    top.querySelector('.wa-call-circle.hangup') ||
    top.querySelector('[aria-label="Cerrar"]');
  if (btn instanceof HTMLElement) {
    btn.click();
    return true;
  }
  top.dispatchEvent(new CustomEvent('tacticalptx:esc-close', { bubbles: false }));
  return true;
}

/** Montar una vez en la app: Esc cierra maximizado / menús / modales / llamadas. */
export default function GlobalEscapeClose() {
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape' && e.code !== 'Escape') return;
      if (e.defaultPrevented) return;
      if (closeTopOverlay()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return null;
}
