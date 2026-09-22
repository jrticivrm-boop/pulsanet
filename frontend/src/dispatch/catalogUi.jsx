import { useState } from 'react';

export function CatSection({ title, hint, count, children, toolbar }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className={`cc-cat-section${collapsed ? ' is-collapsed' : ''}`}>
      <header
        className="cc-cat-section-head"
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((v) => !v);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="cc-cat-section-main">
          <span className="cc-cat-section-chevron" aria-hidden>
            {collapsed ? '▸' : '▾'}
          </span>
          <h3>{title}</h3>
          {count != null ? <span className="cc-cat-section-count">{count}</span> : null}
        </div>
      </header>
      {!collapsed && (
        <div className="cc-cat-section-body">
          {hint ? <p className="cc-cat-hint">{hint}</p> : null}
          {toolbar}
          <div className="cc-cat-section-content">{children}</div>
        </div>
      )}
    </section>
  );
}

export function CatItem({
  label,
  abbr,
  inUse,
  canEdit,
  onRename,
  onDelete,
  className = '',
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  title,
}) {
  return (
    <div
      className={`cc-cat-item${className ? ` ${className}` : ''}`}
      title={title}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {abbr ? <span className="cc-cat-item-abbr">{abbr}</span> : null}
      <span className="cc-cat-item-name">{label}</span>
      {canEdit && (
        <button
          type="button"
          className="cc-cat-edit"
          title="Renombrar"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onRename}
        >
          ✎
        </button>
      )}
      {inUse ? (
        <span className="cc-cat-lock" title="En uso — no se puede eliminar" aria-label="En uso">
          🔒
        </span>
      ) : (
        canEdit && (
          <button
            type="button"
            className="cc-cat-rm"
            title="Eliminar"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDelete}
          >
            ×
          </button>
        )
      )}
    </div>
  );
}
