import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * Lista de una sola elección: orden, conteo y búsqueda.
 * El menú va en el body para que el scroll de Grabaciones no lo recorte.
 */
export default function ReservedPick({
  label,
  title,
  placeholder,
  value,
  options,
  onChange,
}) {
  const listId = useId();
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [sortDir, setSortDir] = useState('asc');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [box, setBox] = useState(null);

  const chosen = options.find((o) => String(o.id) === String(value));
  const shown = chosen?.label || '';

  const visible = useMemo(() => {
    const needle = fold(q.trim());
    const rows = options.filter((o) => !needle || fold(o.label).includes(needle));
    rows.sort((a, b) => fold(a.label).localeCompare(fold(b.label), 'es'));
    if (sortDir === 'desc') rows.reverse();
    return rows;
  }, [options, q, sortDir]);

  function place() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 280), window.innerWidth - 16);
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
    if (left < 8) left = 8;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const openBelow = below >= 200 || below >= above;
    const height = Math.max(160, Math.min(320, openBelow ? below : above));
    const top = openBelow ? r.bottom + 4 : Math.max(8, r.top - 4 - height);
    setBox({ top, left, width, height });
  }

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onScroll = () => place();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const i = visible.findIndex((o) => String(o.id) === String(value));
    setActive(!q.trim() && i >= 0 ? i : 0);
  }, [q, sortDir, open, value, visible]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active, open, box]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(id) {
    onChange(id);
    setOpen(false);
    setQ('');
    btnRef.current?.focus();
  }

  function onSearchKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && visible[active]) {
      e.preventDefault();
      choose(visible[active].id);
    }
  }

  const count =
    options.length === 0
      ? 'Sin opciones'
      : visible.length === 0
        ? 'Sin coincidencias'
        : q.trim()
          ? `${visible.length} de ${options.length}`
          : `${options.length} en la lista`;

  const menu =
    open && box
      ? createPortal(
          <div
            ref={menuRef}
            className="cc-rsv-pick-menu"
            role="listbox"
            id={listId}
            aria-label={label}
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          >
            <div className="cc-rsv-pick-head">
              <button
                type="button"
                className="cc-rsv-pick-sort"
                title={
                  sortDir === 'desc'
                    ? 'Orden de la Z a la A. Otro clic lo invierte.'
                    : 'Orden de la A a la Z. Otro clic lo invierte.'
                }
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              >
                {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
              </button>
              <span className="cc-rsv-pick-count">{count}</span>
              <input
                ref={searchRef}
                type="text"
                value={q}
                placeholder="Buscar en lista…"
                aria-label={`Buscar en ${label}`}
                autoComplete="off"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </div>
            <ul className="cc-rsv-pick-list">
              {visible.length === 0 ? (
                <li className="cc-rsv-pick-empty">Sin coincidencias</li>
              ) : (
                visible.map((o, i) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={String(o.id) === String(value)}
                      className={i === active ? 'is-active' : ''}
                      title={o.label}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(o.id)}
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="cc-reserved-pick">
      <span>{label}</span>
      <button
        ref={btnRef}
        type="button"
        className="cc-reserved-pick-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={shown || title}
        onClick={() => setOpen((v) => !v)}
      >
        {shown || placeholder}
      </button>
      {menu}
    </div>
  );
}
