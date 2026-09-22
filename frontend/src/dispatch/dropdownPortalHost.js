/**
 * Host for dropdown / float portals that must stay visible under browser
 * fullscreen (`requestFullscreen`) and CSS map maximize.
 *
 * Fullscreen only paints descendants of `document.fullscreenElement`; a panel
 * portaled to `.cc-shell` / `body` outside that subtree is invisible and inert.
 *
 * @param {Element | null | undefined} triggerEl element that opened the UI
 * @returns {Element | null}
 */
export function resolveDropdownPortalHost(triggerEl) {
  if (typeof document === 'undefined') return null;

  const fs = document.fullscreenElement;
  if (fs instanceof Element && triggerEl instanceof Element && fs.contains(triggerEl)) {
    return fs;
  }

  if (triggerEl instanceof Element) {
    const maximizedPage =
      triggerEl.closest('.map-page--maximized') || triggerEl.closest('.lt-page--maximized');
    if (maximizedPage) return maximizedPage;
  }

  if (fs instanceof Element) return fs;

  return document.querySelector('.cc-shell') || document.body;
}
