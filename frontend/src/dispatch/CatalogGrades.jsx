import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchGradesEmpleos,
  createCatalogGrade,
  patchCatalogGrade,
  deleteCatalogGrade,
  reorderCatalogGrades,
} from '../api';
import { canModuleAction } from './modulePermissions.js';
import AppDialog from '../AppDialog.jsx';
import { CatItem, CatSection } from './catalogUi.jsx';

export default function CatalogGrades({ session }) {
  const canEdit = canModuleAction(session.user, 'catalogos', 'editar');
  const canAdd = canModuleAction(session.user, 'catalogos', 'agregar');
  const canDelete = canModuleAction(session.user, 'catalogos', 'eliminar');
  const [grades, setGrades] = useState([]);
  const [jerarquias, setJerarquias] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [gradeInput, setGradeInput] = useState('');
  const [abbrInput, setAbbrInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragIdRef = useRef(null);
  const dragCatRef = useRef(null);
  const gradesRef = useRef(grades);
  const jerarquiasRef = useRef(jerarquias);
  gradesRef.current = grades;
  jerarquiasRef.current = jerarquias;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGradesEmpleos(session.token);
      setGrades(data.grades || []);
      const jars = data.jerarquias || [];
      setJerarquias(jars);
      setErr('');
      setCategoryInput((prev) => prev || jars[0]?.name || '');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar grados');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  /* No dejar cursor grabbing / clase html pegada si el DnD nativo no dispara dragend. */
  useEffect(() => {
    const clearCatDrag = () => {
      dragIdRef.current = null;
      dragCatRef.current = null;
      setDragId(null);
      setOverId(null);
      document.documentElement.classList.remove('cc-cat-dragging');
    };
    const onKey = (e) => {
      if (e.key === 'Escape') clearCatDrag();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') clearCatDrag();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('dragend', clearCatDrag, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('dragend', clearCatDrag, true);
      clearCatDrag();
    };
  }, []);

  const gradeGroups = useMemo(() => {
    const map = new Map();
    for (const g of grades) {
      const key = g.category || 'Sin jerarquía';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    }
    const order = new Map(jerarquias.map((j, i) => [j.name, i]));
    return [...map.entries()].sort((a, b) => {
      const ia = order.has(a[0]) ? order.get(a[0]) : 999;
      const ib = order.has(b[0]) ? order.get(b[0]) : 999;
      if (ia !== ib) return ia - ib;
      return a[0].localeCompare(b[0], 'es');
    });
  }, [grades, jerarquias]);

  function buildFlatIds(groups) {
    return groups.flatMap(([, items]) => items.map((g) => g.id));
  }

  function regroup(list, jars) {
    const map = new Map();
    for (const g of list) {
      const key = g.category || 'Sin jerarquía';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    }
    const order = new Map((jars || []).map((j, i) => [j.name, i]));
    return [...map.entries()].sort((a, b) => {
      const ia = order.has(a[0]) ? order.get(a[0]) : 999;
      const ib = order.has(b[0]) ? order.get(b[0]) : 999;
      if (ia !== ib) return ia - ib;
      return a[0].localeCompare(b[0], 'es');
    });
  }

  async function persistOrder(nextFlat) {
    const prev = gradesRef.current;
    setGrades(nextFlat);
    setBusy(true);
    try {
      const data = await reorderCatalogGrades(
        session.token,
        nextFlat.map((g) => g.id)
      );
      setGrades(data.grades || nextFlat);
    } catch (e) {
      setGrades(prev);
      setDialog({ title: 'Error', message: e.message || 'No se pudo guardar el orden', alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function reorderInCategory(category, fromId, toId) {
    if (!fromId || !toId || String(fromId) === String(toId)) return;
    const groups = regroup(gradesRef.current, jerarquiasRef.current).map(([cat, items]) => {
      if (cat !== category) return [cat, items];
      const next = [...items];
      const from = next.findIndex((g) => String(g.id) === String(fromId));
      const to = next.findIndex((g) => String(g.id) === String(toId));
      if (from < 0 || to < 0) return [cat, items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return [cat, next];
    });
    const flat = groups.flatMap(([, items]) => items);
    // Evita POST si no cambió nada
    const prevIds = buildFlatIds(regroup(gradesRef.current, jerarquiasRef.current)).map(String);
    const nextIds = flat.map((g) => String(g.id));
    if (prevIds.join('|') === nextIds.join('|')) return;
    persistOrder(flat);
  }

  function onDragStart(e, id, category) {
    if (!canEdit || busy) {
      e.preventDefault();
      return;
    }
    dragIdRef.current = id;
    dragCatRef.current = category;
    setDragId(id);
    document.documentElement.classList.add('cc-cat-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(id));
      e.dataTransfer.setData('application/x-tacticalptx-grade', String(id));
      e.dataTransfer.setData('application/x-tacticalptx-grade-cat', String(category));
    } catch {
      /* ignore */
    }
  }

  function onDragOver(e, id) {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  }

  function onDrop(e, id, category) {
    e.preventDefault();
    e.stopPropagation();
    const fromCat =
      e.dataTransfer.getData('application/x-tacticalptx-grade-cat') || dragCatRef.current;
    if (fromCat && String(fromCat) !== String(category)) {
      dragIdRef.current = null;
      dragCatRef.current = null;
      setDragId(null);
      setOverId(null);
      document.documentElement.classList.remove('cc-cat-dragging');
      return;
    }
    const from =
      e.dataTransfer.getData('application/x-tacticalptx-grade') ||
      e.dataTransfer.getData('text/plain') ||
      dragIdRef.current ||
      dragId;
    reorderInCategory(category, from, id);
    dragIdRef.current = null;
    dragCatRef.current = null;
    setDragId(null);
    setOverId(null);
    document.documentElement.classList.remove('cc-cat-dragging');
  }

  function onDragEnd() {
    dragIdRef.current = null;
    dragCatRef.current = null;
    setDragId(null);
    setOverId(null);
    document.documentElement.classList.remove('cc-cat-dragging');
  }

  async function addGrade() {
    const category = categoryInput.trim();
    const abbreviation = abbrInput.trim();
    const name = gradeInput.trim();
    if (!category) {
      setDialog({
        title: 'Jerarquía requerida',
        message: 'Selecciona primero la jerarquía.',
        alertOnly: true,
      });
      return;
    }
    if (!name) {
      setDialog({
        title: 'Grado requerido',
        message: 'Escribe el nombre del grado (ej. Capitán Primero).',
        alertOnly: true,
      });
      return;
    }
    if (!abbreviation) {
      setDialog({
        title: 'Abreviatura requerida',
        message: 'Escribe la abreviatura del grado (ej. Cap. 1/o.).',
        alertOnly: true,
      });
      return;
    }
    setBusy(true);
    try {
      await createCatalogGrade(session.token, { name, abbreviation, category });
      setGradeInput('');
      setAbbrInput('');
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
          message: `Abreviatura para «${name}»`,
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

  if (loading) return <p className="cc-hint">Cargando grados…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  return (
    <div className="cc-cat-grades-wrap">
      <CatSection
        title="🎖 Grados"
        count={grades.length}
        hint="Orden al agregar: 1) Jerarquía · 2) Grado · 3) Abreviatura. Arrastra dentro de cada jerarquía (izquierda = 1). Se refleja en altas."
        toolbar={
          canAdd ? (
            <div className="cc-cat-toolbar" onClick={(e) => e.stopPropagation()}>
              <select
                className="cc-cat-input"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                title="Jerarquía"
                aria-label="Jerarquía"
                required
              >
                <option value="" disabled>
                  1. Jerarquía…
                </option>
                {jerarquias.map((j) => (
                  <option key={j.id} value={j.name}>
                    {j.name}
                  </option>
                ))}
              </select>
              <input
                className="cc-cat-input"
                placeholder="2. Grado (Capitán Primero)"
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGrade()}
                aria-label="Grado"
              />
              <input
                className="cc-cat-input cc-cat-input--sm"
                placeholder="3. Abrev. (Cap. 1/o.)"
                value={abbrInput}
                onChange={(e) => setAbbrInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGrade()}
                aria-label="Abreviatura"
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
                {items.map((g) => {
                  const id = String(g.id);
                  const cls = [
                    canEdit ? 'is-draggable' : '',
                    dragId === id ? 'is-dragging' : '',
                    overId === id && dragId && overId !== dragId ? 'is-drag-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <CatItem
                      key={g.id}
                      abbr={g.abbreviation}
                      label={g.name}
                      inUse={g.inUse}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      className={cls}
                      title={canEdit ? 'Arrastra para reordenar' : undefined}
                      draggable={canEdit && !busy}
                      onDragStart={(e) => onDragStart(e, id, cat)}
                      onDragOver={(e) => onDragOver(e, id)}
                      onDrop={(e) => onDrop(e, id, cat)}
                      onDragEnd={onDragEnd}
                      onRename={() => askRenameGrade(g)}
                      onDelete={() => askDeleteGrade(g)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CatSection>

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        danger={dialog?.danger}
        alertOnly={dialog?.alertOnly}
        confirmLabel={dialog?.confirmLabel || 'Aceptar'}
        promptDefault={dialog?.promptDefault}
        promptLabel={dialog?.promptLabel}
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
