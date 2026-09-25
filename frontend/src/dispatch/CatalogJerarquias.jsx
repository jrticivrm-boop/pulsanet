import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCatalogJerarquias,
  createCatalogJerarquia,
  patchCatalogJerarquia,
  deleteCatalogJerarquia,
  reorderCatalogJerarquias,
} from '../api';
import { canModuleAction } from './modulePermissions.js';
import AppDialog from '../AppDialog.jsx';
import { CatItem, CatSection } from './catalogUi.jsx';

export default function CatalogJerarquias({ session }) {
  const canEdit = canModuleAction(session.user, 'catalogos', 'editar');
  const canAdd = canModuleAction(session.user, 'catalogos', 'agregar');
  const canDelete = canModuleAction(session.user, 'catalogos', 'eliminar');
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragIdRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCatalogJerarquias(session.token);
      setItems(data.jerarquias || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar jerarquías');
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

  async function persistOrder(next) {
    const prev = itemsRef.current;
    setItems(next);
    setBusy(true);
    try {
      const data = await reorderCatalogJerarquias(
        session.token,
        next.map((j) => j.id)
      );
      setItems(data.jerarquias || next);
    } catch (e) {
      setItems(prev);
      setDialog({ title: 'Error', message: e.message || 'No se pudo guardar el orden', alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function reorderLocal(fromId, toId) {
    if (!fromId || !toId || String(fromId) === String(toId)) return;
    const current = itemsRef.current;
    const next = [...current];
    const from = next.findIndex((j) => String(j.id) === String(fromId));
    const to = next.findIndex((j) => String(j.id) === String(toId));
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  }

  function onDragStart(e, id) {
    if (!canEdit || busy) {
      e.preventDefault();
      return;
    }
    dragIdRef.current = id;
    setDragId(id);
    document.documentElement.classList.add('cc-cat-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(id));
      e.dataTransfer.setData('application/x-tacticalptx-jerarquia', String(id));
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

  function onDrop(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const from =
      e.dataTransfer.getData('application/x-tacticalptx-jerarquia') ||
      e.dataTransfer.getData('text/plain') ||
      dragIdRef.current ||
      dragId;
    reorderLocal(from, id);
    dragIdRef.current = null;
    setDragId(null);
    setOverId(null);
    document.documentElement.classList.remove('cc-cat-dragging');
  }

  function onDragEnd() {
    dragIdRef.current = null;
    setDragId(null);
    setOverId(null);
    document.documentElement.classList.remove('cc-cat-dragging');
  }

  async function addItem() {
    const name = input.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createCatalogJerarquia(session.token, { name });
      setInput('');
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function askRename(j) {
    setDialog({
      title: 'Renombrar jerarquía',
      message: `Nuevo nombre para «${j.name}» (también actualiza los grados de esta jerarquía)`,
      promptDefault: j.name,
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
          await patchCatalogJerarquia(session.token, j.id, { name });
          setDialog(null);
          await load();
        } catch (e) {
          setDialog({ title: 'Error', message: e.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function askDelete(j) {
    setDialog({
      title: 'Eliminar jerarquía',
      message: `¿Eliminar «${j.name}»?`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteCatalogJerarquia(session.token, j.id);
          setDialog(null);
          await load();
        } catch (e) {
          setDialog({ title: 'Error', message: e.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  if (loading) return <p className="cc-hint">Cargando jerarquías…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  return (
    <div className="cc-cat-grades-wrap">
      <CatSection
        title="🏛 Jerarquías"
        count={items.length}
        hint="Agrupan los grados (Generales, Jefes, Oficiales, Tropa…)."
        toolbar={
          canAdd ? (
            <div className="cc-cat-toolbar" onClick={(e) => e.stopPropagation()}>
              <input
                className="cc-cat-input"
                placeholder="Nueva jerarquía…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
              />
              <button type="button" className="cc-btn cc-cat-add-btn" disabled={busy} onClick={addItem}>
                + Agregar
              </button>
            </div>
          ) : null
        }
      >
        {items.length === 0 ? (
          <span className="cc-hint">Sin jerarquías</span>
        ) : (
          <div className="cc-cat-chips">
            {items.map((j) => {
              const id = String(j.id);
              const cls = [
                canEdit ? 'is-draggable' : '',
                dragId === id ? 'is-dragging' : '',
                overId === id && dragId && overId !== dragId ? 'is-drag-over' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <CatItem
                  key={j.id}
                  label={j.name}
                  inUse={j.inUse}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  className={cls}
                  title={canEdit ? 'Arrastra para reordenar' : undefined}
                  draggable={canEdit && !busy}
                  onDragStart={(e) => onDragStart(e, id)}
                  onDragOver={(e) => onDragOver(e, id)}
                  onDrop={(e) => onDrop(e, id)}
                  onDragEnd={onDragEnd}
                  onRename={() => askRename(j)}
                  onDelete={() => askDelete(j)}
                />
              );
            })}
          </div>
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
