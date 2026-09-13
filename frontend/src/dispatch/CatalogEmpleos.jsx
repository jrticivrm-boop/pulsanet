import { useCallback, useEffect, useState } from 'react';
import {
  fetchGradesEmpleos,
  createCatalogEmpleo,
  patchCatalogEmpleo,
  deleteCatalogEmpleo,
  isAdminUser,
} from '../api';
import AppDialog from '../AppDialog.jsx';
import { CatItem, CatSection } from './catalogUi.jsx';

export default function CatalogEmpleos({ session }) {
  const canEdit = isAdminUser(session.user);
  const [empleos, setEmpleos] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [empleoInput, setEmpleoInput] = useState('');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGradesEmpleos(session.token);
      setEmpleos(data.empleos || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar empleos');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (loading) return <p className="cc-hint">Cargando empleos…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  return (
    <div className="cc-cat-grades-wrap">
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
