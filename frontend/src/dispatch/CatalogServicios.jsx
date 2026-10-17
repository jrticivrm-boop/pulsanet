import { useCallback, useEffect, useState } from 'react';
import {
  fetchCatalogServicios,
  createCatalogServicio,
  patchCatalogServicio,
  deleteCatalogServicio,
} from '../api';
import { canModuleAction } from './modulePermissions.js';
import AppDialog from '../AppDialog.jsx';
import { CatItem, CatSection } from './catalogUi.jsx';

export default function CatalogServicios({ session }) {
  const canEdit = canModuleAction(session.user, 'catalogos', 'editar');
  const canAdd = canModuleAction(session.user, 'catalogos', 'agregar');
  const canDelete = canModuleAction(session.user, 'catalogos', 'eliminar');
  const [servicios, setServicios] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCatalogServicios(session.token);
      setServicios(data.servicios || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar servicios');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function addServicio() {
    const name = input.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createCatalogServicio(session.token, { name });
      setInput('');
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function askRename(s) {
    setDialog({
      title: 'Renombrar servicio',
      message: `Nuevo nombre para «${s.name}»`,
      promptDefault: s.name,
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
          await patchCatalogServicio(session.token, s.id, { name });
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

  function askDelete(s) {
    setDialog({
      title: 'Eliminar servicio',
      message: `¿Eliminar «${s.name}»?`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteCatalogServicio(session.token, s.id);
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

  if (loading) return <p className="cc-hint">Cargando servicios…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  return (
    <div className="cc-cat-grades-wrap">
      <CatSection
        title="🎖️ Servicios"
        count={servicios.length}
        hint="Puestos / servicios del indicativo (users.cargo). Se eligen al dar de alta o editar usuarios."
        toolbar={
          canAdd ? (
            <div className="cc-cat-toolbar" onClick={(e) => e.stopPropagation()}>
              <input
                className="cc-cat-input"
                placeholder="Nuevo servicio…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addServicio()}
              />
              <button type="button" className="cc-btn cc-cat-add-btn" disabled={busy} onClick={addServicio}>
                + Agregar
              </button>
            </div>
          ) : null
        }
      >
        {servicios.length === 0 ? (
          <span className="cc-hint">Sin servicios</span>
        ) : (
          <div className="cc-cat-chips">
            {servicios.map((s) => (
              <CatItem
                key={s.id}
                label={s.name}
                inUse={s.inUse}
                canEdit={canEdit}
                canDelete={canDelete}
                onRename={() => askRename(s)}
                onDelete={() => askDelete(s)}
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
