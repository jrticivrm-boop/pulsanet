import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchGradesEmpleos,
  createCatalogGrade,
  patchCatalogGrade,
  deleteCatalogGrade,
  createCatalogEmpleo,
  patchCatalogEmpleo,
  deleteCatalogEmpleo,
  isAdminUser,
} from '../api';
import AppDialog from '../AppDialog.jsx';

function CatSection({ title, hint, count, children, toolbar }) {
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

function CatItem({ label, abbr, inUse, canEdit, onRename, onDelete }) {
  return (
    <div className="cc-cat-item">
      {abbr ? <span className="cc-cat-item-abbr">{abbr}</span> : null}
      <span className="cc-cat-item-name">{label}</span>
      {canEdit && (
        <button type="button" className="cc-cat-edit" title="Renombrar" onClick={onRename}>
          ✎
        </button>
      )}
      {inUse ? (
        <span className="cc-cat-lock" title="En uso — no se puede eliminar" aria-label="En uso">
          🔒
        </span>
      ) : (
        canEdit && (
          <button type="button" className="cc-cat-rm" title="Eliminar" onClick={onDelete}>
            ×
          </button>
        )
      )}
    </div>
  );
}

export default function CatalogGradesEmpleos({ session }) {
  const canEdit = isAdminUser(session.user);
  const [grades, setGrades] = useState([]);
  const [empleos, setEmpleos] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [gradeInput, setGradeInput] = useState('');
  const [abbrInput, setAbbrInput] = useState('');
  const [empleoInput, setEmpleoInput] = useState('');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGradesEmpleos(session.token);
      setGrades(data.grades || []);
      setEmpleos(data.empleos || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  const gradeGroups = useMemo(() => {
    const map = new Map();
    for (const g of grades) {
      const key = g.category || 'Otros';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    }
    return [...map.entries()];
  }, [grades]);

  async function addGrade() {
    const name = gradeInput.trim();
    const abbreviation = abbrInput.trim() || name;
    if (!name) return;
    setBusy(true);
    try {
      await createCatalogGrade(session.token, { name, abbreviation });
      setGradeInput('');
      setAbbrInput('');
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function addEmpleo() {
    const name = empleoInput.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createCatalogEmpleo(session.token, { name });
      setEmpleoInput('');
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function askRenameGrade(g) {
    setDialog({
      title: 'Renombrar grado',
      message: 'Nuevo nombre del grado',
      promptDefault: g.name,
      promptLabel: 'Nombre',
      confirmLabel: 'Siguiente',
      onConfirm: (rawName) => {
        const name = String(rawName || '').trim();
        if (!name) {
          setDialog(null);
          return;
        }
        setDialog({
          title: 'Abreviatura',
          message: `Indicativo para «${name}»`,
          promptDefault: g.abbreviation,
          promptLabel: 'Abreviatura',
          confirmLabel: 'Guardar',
          onConfirm: async (rawAbbr) => {
            const abbreviation = String(rawAbbr || '').trim();
            if (!abbreviation) {
              setDialog(null);
              return;
            }
            setBusy(true);
            try {
              await patchCatalogGrade(session.token, g.id, {
                name,
                abbreviation,
                category: g.category,
              });
              setDialog(null);
              await load();
            } catch (e) {
              setDialog({ title: 'Error', message: e.message, alertOnly: true });
            } finally {
              setBusy(false);
            }
          },
        });
      },
    });
  }

  function askRenameEmpleo(e) {
    setDialog({
      title: 'Renombrar empleo',
      message: `Nuevo nombre para «${e.name}»`,
      promptDefault: e.name,
      promptLabel: 'Nombre',
      confirmLabel: 'Guardar',
      onConfirm: async (raw) => {
        const name = String(raw || '').trim();
        if (!name) {
          setDialog(null);
          return;
        }
        setBusy(true);
        try {
          await patchCatalogEmpleo(session.token, e.id, { name });
          setDialog(null);
          await load();
        } catch (err) {
          setDialog({ title: 'Error', message: err.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function askDeleteGrade(g) {
    setDialog({
      title: 'Eliminar grado',
      message: `¿Eliminar «${g.abbreviation} — ${g.name}»?`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteCatalogGrade(session.token, g.id);
          setDialog(null);
          await load();
        } catch (err) {
          setDialog({ title: 'Error', message: err.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function askDeleteEmpleo(e) {
    setDialog({
      title: 'Eliminar empleo',
      message: `¿Eliminar «${e.name}»?`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteCatalogEmpleo(session.token, e.id);
          setDialog(null);
          await load();
        } catch (err) {
          setDialog({ title: 'Error', message: err.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  if (loading) return <p className="cc-hint">Cargando catálogo…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  return (
    <div className="cc-cat-grades-wrap">
      <div className="cc-cat-grid cc-cat-grid--grades">
        <CatSection
          title="🎖 Grados"
          count={grades.length}
          hint="Abreviatura = indicativo al aire (users.grade). Lista inicial: Ejército Mexicano (LOEFAM)."
          toolbar={
            canEdit ? (
              <div className="cc-cat-toolbar" onClick={(e) => e.stopPropagation()}>
                <input
                  className="cc-cat-input"
                  placeholder="Nombre (ej. Capitán Primero)"
                  value={gradeInput}
                  onChange={(e) => setGradeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGrade()}
                />
                <input
                  className="cc-cat-input cc-cat-input--sm"
                  placeholder="Abrev. (Cap. 1/o.)"
                  value={abbrInput}
                  onChange={(e) => setAbbrInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGrade()}
                />
                <button type="button" className="cc-btn cc-cat-add-btn" disabled={busy} onClick={addGrade}>
                  + Agregar
                </button>
              </div>
            ) : null
          }
        >
          {gradeGroups.length === 0 ? (
            <span className="cc-hint">Sin grados</span>
          ) : (
            gradeGroups.map(([cat, items]) => (
              <div key={cat} className="cc-cat-subgroup">
                <p className="cc-cat-subgroup-label">{cat}</p>
                <div className="cc-cat-chips">
                  {items.map((g) => (
                    <CatItem
                      key={g.id}
                      abbr={g.abbreviation}
                      label={g.name}
                      inUse={g.inUse}
                      canEdit={canEdit}
                      onRename={() => askRenameGrade(g)}
                      onDelete={() => askDeleteGrade(g)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </CatSection>

        <CatSection
          title="💼 Empleos"
          count={empleos.length}
          hint="Se usan como especialidad al dar de alta usuarios (users.specialty)."
          toolbar={
            canEdit ? (
              <div className="cc-cat-toolbar" onClick={(e) => e.stopPropagation()}>
                <input
                  className="cc-cat-input"
                  placeholder="Nuevo empleo…"
                  value={empleoInput}
                  onChange={(e) => setEmpleoInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEmpleo()}
                />
                <button type="button" className="cc-btn cc-cat-add-btn" disabled={busy} onClick={addEmpleo}>
                  + Agregar
                </button>
              </div>
            ) : null
          }
        >
          {empleos.length === 0 ? (
            <span className="cc-hint">Sin empleos</span>
          ) : (
            <div className="cc-cat-chips">
              {empleos.map((e) => (
                <CatItem
                  key={e.id}
                  label={e.name}
                  inUse={e.inUse}
                  canEdit={canEdit}
                  onRename={() => askRenameEmpleo(e)}
                  onDelete={() => askDeleteEmpleo(e)}
                />
              ))}
            </div>
          )}
        </CatSection>
      </div>

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        danger={dialog?.danger}
        alertOnly={dialog?.alertOnly}
        confirmLabel={dialog?.confirmLabel || 'Aceptar'}
        promptDefault={dialog?.promptDefault}
        promptLabel={dialog?.promptLabel}
        promptPlaceholder={dialog?.promptPlaceholder}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={(value) => {
          if (dialog?.onConfirm) dialog.onConfirm(value);
          else setDialog(null);
        }}
      />
    </div>
  );
}
