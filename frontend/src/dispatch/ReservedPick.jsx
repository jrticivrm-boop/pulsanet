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

  const canGrade = options.some((o) => Number.isFinite(o.gradeSortOrder));
  const modes = canGrade ? ['asc', 'desc', 'gradeAsc', 'gradeDesc'] : ['asc', 'desc'];

  useEffect(() => {
    if (!canGrade) {
      setSortDir((d) => (d === 'gradeAsc' || d === 'gradeDesc' ? 'asc' : d));
    }
  }, [canGrade]);

  const visible = useMemo(() => {
    const needle = fold(q.trim());
    const rows = options.filter((o) => !needle || fold(o.label).includes(needle));
    const byName = (a, b) => fold(a.label).localeCompare(fold(b.label), 'es');
    rows.sort((a, b) => {
      if (sortDir === 'gradeAsc' || sortDir === 'gradeDesc') {
        const aHas = Number.isFinite(a.gradeSortOrder);
        const bHas = Number.isFinite(b.gradeSortOrder);
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas && a.gradeSortOrder !== b.gradeSortOrder) {
          return sortDir === 'gradeAsc'
            ? b.gradeSortOrder - a.gradeSortOrder
            : a.gradeSortOrder - b.gradeSortOrder;
        }
        return byName(a, b);
      }
      const name = byName(a, b);
      return sortDir === 'desc' ? -name : name;
    });
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
    menuRef.current?.querySelector('.cc-tactical-ms-option.is-active')?.scrollIntoView({ block: 'nearest' });
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

  const total = options.length;
  const count =
    total === 0
      ? 'Sin opciones'
      : value
        ? `1 de ${total} seleccionado`
        : `Selecciona 1 de ${total}`;
  const visibleNote = q.trim() && visible.length !== total ? ` · ${visible.length} visibles` : '';

  const menu =
    open && box
      ? createPortal(
          <div
            ref={menuRef}
            className="cc-tactical-ms-panel cc-ms-panel cc-rsv-ms"
            role="listbox"
            id={listId}
            aria-label={label}
            style={{
              position: 'fixed',
              zIndex: 200200,
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
            }}
          >
            <div className="cc-ms-head">
              <div className="cc-ms-actions">
                <button
                  type="button"
                  className="cc-ms-link"
                  title={
                    sortDir === 'desc'
                      ? 'De la Z a la A. Otro clic ordena por grado, del soldado al más alto.'
                      : sortDir === 'gradeAsc'
                        ? 'Del soldado al grado más alto. Mismo grado, por nombre. Otro clic invierte la jerarquía.'
                        : sortDir === 'gradeDesc'
                          ? 'Del grado más alto al soldado. Mismo grado, por nombre. Otro clic vuelve al alfabeto.'
                          : canGrade
                            ? 'De la A a la Z. Otro clic invierte el alfabeto y luego ordena por grado.'
                            : 'De la A a la Z. Otro clic invierte el alfabeto.'
                  }
                  onClick={() =>
                    setSortDir((d) => {
                      const i = modes.indexOf(d);
                      return modes[(i + 1) % modes.length];
                    })
                  }
                >
                  {sortDir === 'desc'
                    ? 'Descendente'
                    : sortDir === 'gradeAsc'
                      ? 'Grado ascendente'
                      : sortDir === 'gradeDesc'
                        ? 'Grado descendente'
                        : 'Ascendente'}
                </button>
              </div>
              <div className="cc-ms-meta">
                <span className="cc-ms-count">
                  {count}
                  {visibleNote}
                </span>
                <span
                  className="cc-ms-hint"
                  title={
                    canGrade
                      ? 'Ascendente y Descendente ordenan el nombre. Grado ascendente va del soldado al más alto; Grado descendente, al revés. Quien no tiene grado queda al final. Un clic elige.'
                      : 'Ascendente o Descendente ordena la lista. Buscar filtra por nombre. Un clic elige.'
                  }
                >
                  ?
                </span>
              </div>
              <input
                ref={searchRef}
                type="search"
                className="cc-ms-search"
                value={q}
                placeholder="Buscar en lista…"
                aria-label={`Buscar en ${label}`}
                autoComplete="off"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </div>
            <div className="cc-ms-list">
              {visible.length === 0 ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                visible.map((o, i) => (
                  <div
                    key={o.id}
                    role="option"
                    aria-selected={String(o.id) === String(value)}
                    className={`cc-tactical-ms-option${
                      String(o.id) === String(value) ? ' is-on' : ''
                    }${i === active ? ' is-active' : ''}`}
                    title={o.label}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.id)}
                  >
                    <span className="cc-tactical-ms-name">{o.label}</span>
                  </div>
                ))
              )}
            </div>
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
