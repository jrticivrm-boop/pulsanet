/**
 * Ajuste de alto estilo Parque Vehicular (thFilterMultiFitMenuHeight):
 * cabezal fijo + lista; altura natural si cabe, si no tope preferido con scroll.
 */

function measureRowHeight(list) {
  const row = list.querySelector('.cc-tactical-ms-option');
  if (row) {
    const h = Math.ceil(row.getBoundingClientRect().height);
    if (h > 0) return h;
  }
  return 28;
}

/** Reaplica layout de lista al alto actual del panel (p. ej. tras resize:both). */
export function applyMsPanelListLayout(menuEl) {
  if (!menuEl) return;
  const head = menuEl.querySelector('.cc-ms-head');
  const list = menuEl.querySelector('.cc-ms-list');
  if (!head || !list) return;

  const footer = menuEl.querySelector('.cc-ms-footer');
  const footerH = footer ? footer.offsetHeight : 0;
  const borderChrome = 2;
  const rowH = measureRowHeight(list);
  const headH = head.offsetHeight;
  const listMin = rowH + 4;
  const listViewport = Math.max(
    listMin,
    menuEl.offsetHeight - headH - footerH - borderChrome
  );
  const savedScroll = list.scrollTop;

  list.style.minHeight = `${listMin}px`;
  list.style.overflowY = 'hidden';
  list.style.flex = '0 0 auto';
  list.style.maxHeight = 'none';

  const listNatural = list.scrollHeight;
  if (listNatural <= listViewport + 2) {
    if (savedScroll > 0) list.scrollTop = savedScroll;
    return;
  }

  list.style.flex = '1 1 auto';
  list.style.maxHeight = `${listViewport}px`;
  list.style.overflowY = 'auto';
  if (savedScroll > 0) list.scrollTop = savedScroll;
}

export function fitMsPanelHeight(menuEl, {
  preferred = 280,
  maxCap = 400,
  minRows = 1,
} = {}) {
  if (!menuEl) return;
  const head = menuEl.querySelector('.cc-ms-head');
  const list = menuEl.querySelector('.cc-ms-list');
  if (!head || !list) return;

  const footer = menuEl.querySelector('.cc-ms-footer');
  const footerH = footer ? footer.offsetHeight : 0;
  const maxH = Math.min(maxCap, window.innerHeight - 24);
  const openPreferred = Math.min(preferred, maxH);
  const borderChrome = 2;

  list.style.flex = '0 0 auto';
  list.style.overflowY = 'visible';
  list.style.maxHeight = 'none';
  list.style.minHeight = '0';
  menuEl.style.height = 'auto';

  const rowH = measureRowHeight(list);
  const headH = head.offsetHeight;
  const listNatural = list.scrollHeight;
  const naturalTotal = headH + listNatural + footerH + borderChrome;
  const minH = headH + rowH * Math.max(1, minRows) + 4 + footerH + borderChrome;

  menuEl.style.maxHeight = `${maxH}px`;
  menuEl.style.minHeight = `${minH}px`;

  const targetH =
    naturalTotal <= openPreferred
      ? Math.max(naturalTotal, minH)
      : Math.max(openPreferred, minH);
  menuEl.style.height = `${targetH}px`;

  applyMsPanelListLayout(menuEl);
}
