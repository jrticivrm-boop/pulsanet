import { useCallback, useEffect, useState } from 'react';
import {
  fetchDependencias,
  createDependenciaRegion,
  createDependenciaZona,
  createDependenciaUnidad,
  patchDependencia,
  deleteDependencia,
  isAdminUser,
} from '../api';
import AppDialog from '../AppDialog.jsx';

/** Fila colapsable (misma idea que catNestedRowShell de ParqueVehicular). */
function NestedRow({ title, count, actions, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`cc-dep-row${open ? '' : ' is-collapsed'}`}>
      <header className="cc-dep-row-head">
        <button type="button" className="cc-dep-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '▾' : '▸'}
        </button>
        <div className="cc-dep-row-main">
          <span className="cc-dep-nombre">{title}</span>
          {count != null ? <span className="cc-cat-section-count">{count}</span> : null}
        </div>
        <div className="cc-dep-row-actions" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      </header>
      {open ? <div className="cc-dep-row-body">{children}</div> : null}
    </div>
  );
}

export default function DispatchDependencias({ session }) {
  const canEdit = isAdminUser(session.user);
  const [tree, setTree] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [regionName, setRegionName] = useState('');
  const [zoneDraft, setZoneDraft] = useState({});
  const [orgDraft, setOrgDraft] = useState({});
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDependencias(session.token);
      setTree(data.tree || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar el catálogo de dependencias.');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRegion() {
    const name = regionName.trim();
    if (!name) {
      setDialog({ title: 'Dependencias', message: 'Escriba el nombre de la región', alertOnly: true });
      return;
    }
    setBusy(true);
    try {
      await createDependenciaRegion(session.token, { name });
      setRegionName('');
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function addZone(regionId) {
    const name = (zoneDraft[regionId] || '').trim();
    if (!name) {
      setDialog({ title: 'Dependencias', message: 'Escriba el nombre de la zona', alertOnly: true });
      return;
    }
    setBusy(true);
    try {
      await createDependenciaZona(session.token, regionId, { name, zoneType: 'zm' });
      setZoneDraft((d) => ({ ...d, [regionId]: '' }));
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function addOrganismo(zoneId) {
    const name = (orgDraft[zoneId] || '').trim();
    if (!name) {
      setDialog({ title: 'Dependencias', message: 'Escriba el nombre del organismo', alertOnly: true });
      return;
    }
    setBusy(true);
    try {
      await createDependenciaUnidad(session.token, zoneId, { name });
      setOrgDraft((d) => ({ ...d, [zoneId]: '' }));
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function renameNode(node, label) {
    setDialog({
      title: `Renombrar ${label}`,
      message: `Escriba el nuevo nombre para «${node.name}».`,
      promptDefault: node.name,
      promptLabel: 'Nombre',
      confirmLabel: 'Guardar',
      onConfirm: async (raw) => {
        const name = String(raw || '').trim();
        if (!name || name === node.name) {
          setDialog(null);
          return;
        }
        setBusy(true);
        try {
          await patchDependencia(session.token, node.id, { name });
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

  function removeNode(node, label) {
    setDialog({
      title: `Eliminar ${label}`,
      message: `¿Eliminar «${node.name}»? Solo si no está en uso ni tiene elementos hijos.`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteDependencia(session.token, node.id);
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

  if (loading) return <p className="cc-hint">Cargando dependencias…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  const totalZonas = tree.reduce((n, r) => n + (r.children || []).length, 0);
  const totalOrgs = tree.reduce(
    (n, r) => n + (r.children || []).reduce((m, z) => m + (z.children || []).length, 0),
    0
  );

  return (
    <div className="cc-dependencias cc-cat-compact">
      <header className="cc-units-head cc-cat-compact-head">
        <div>
          <h2>🏛 Dependencias militares</h2>
          <p className="cc-hint cc-dep-hint">
            Estructura jerárquica: <strong>Región Militar (RR.MM.)</strong> →{' '}
            <strong>Zona Militar (ZZ.MM.)</strong> → <strong>Organismos</strong>.
            <br />
            Solo se pueden eliminar entradas que <strong>no estén en uso</strong> ni tengan elementos hijos.
          </p>
        </div>
        <p className="cc-units-summary">
          {tree.length} región(es) · {totalZonas} zona(s) · {totalOrgs} organismo(s)
        </p>
      </header>

      {canEdit && (
        <div className="cc-cat-toolbar cc-dep-root-toolbar">
          <input
            className="cc-cat-input"
            style={{ width: 220, maxWidth: '100%', flex: '0 1 220px' }}
            placeholder="Nueva región militar…"
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRegion()}
          />
          <button type="button" className="cc-btn cc-dep-add-btn" disabled={busy} onClick={addRegion}>
            + Región
          </button>
        </div>
      )}

      {tree.length === 0 ? (
        <p className="cc-hint">Sin regiones registradas.</p>
      ) : (
        <div className="cc-dep-lista">
          {tree.map((region) => (
            <NestedRow
              key={region.id}
              title={`🗺 ${region.name}`}
              count={(region.children || []).length}
              actions={
                canEdit ? (
                  <>
                    <button
                      type="button"
                      className="cc-cat-edit"
                      title="Renombrar región"
                      onClick={() => renameNode(region, 'región')}
                    >
                      ✎
                    </button>
                    <input
                      className="cc-cat-input cc-cat-input--sm"
                      placeholder="Nueva zona militar…"
                      value={zoneDraft[region.id] || ''}
                      onChange={(e) => setZoneDraft((d) => ({ ...d, [region.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addZone(region.id)}
                    />
                    <button
                      type="button"
                      className="cc-btn cc-dep-action-btn"
                      disabled={busy}
                      onClick={() => addZone(region.id)}
                    >
                      + Zona
                    </button>
                    {region.inUse ? (
                      <span className="cc-cat-lock" title="En uso">
                        🔒
                      </span>
                    ) : (
                      <button type="button" className="cc-cat-rm" title="Eliminar" onClick={() => removeNode(region, 'región')}>
                        ×
                      </button>
                    )}
                  </>
                ) : null
              }
            >
              {(region.children || []).length === 0 ? (
                <span className="cc-dep-empty">Sin zonas registradas</span>
              ) : (
                <div className="cc-dep-zonas-wrap">
                  {(region.children || []).map((zone) => (
                    <NestedRow
                      key={zone.id}
                      title={`📍 ${zone.name}`}
                      count={(zone.children || []).length}
                      actions={
                        canEdit ? (
                          <>
                            <button
                              type="button"
                              className="cc-cat-edit"
                              title="Renombrar zona"
                              onClick={() => renameNode(zone, 'zona')}
                            >
                              ✎
                            </button>
                            <input
                              className="cc-cat-input cc-cat-input--sm"
                              placeholder="Nuevo organismo…"
                              value={orgDraft[zone.id] || ''}
                              onChange={(e) => setOrgDraft((d) => ({ ...d, [zone.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && addOrganismo(zone.id)}
                            />
                            <button
                              type="button"
                              className="cc-btn cc-dep-action-btn"
                              disabled={busy}
                              onClick={() => addOrganismo(zone.id)}
                            >
                              + Organismo
                            </button>
                            {zone.inUse ? (
                              <span className="cc-cat-lock" title="En uso">
                                🔒
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="cc-cat-rm"
                                title="Eliminar"
                                onClick={() => removeNode(zone, 'zona')}
                              >
                                ×
                              </button>
                            )}
                          </>
                        ) : null
                      }
                    >
                      {(zone.children || []).length === 0 ? (
                        <span className="cc-dep-empty">Sin organismos registrados</span>
                      ) : (
                        <div className="cc-dep-org-chips">
                          {(zone.children || []).map((org) => (
                            <div
                              key={org.id}
                              className={`cc-dep-org-chip${org.linked ? ' cc-dep-org-chip--linked' : ''}`}
                              title={
                                org.linked
                                  ? 'Vínculo de alcance: se ve como organismo de esta zona (sigue existiendo como zona propia)'
                                  : undefined
                              }
                            >
                              <span>
                                {org.name}
                                {org.linked ? (
                                  <span className="cc-dep-linked-tag"> · vínculo</span>
                                ) : null}
                              </span>
                              {canEdit && !org.linked && (
                                <button
                                  type="button"
                                  className="cc-cat-edit"
                                  title="Renombrar"
                                  onClick={() => renameNode(org, 'organismo')}
                                >
                                  ✎
                                </button>
                              )}
                              {org.linked ? (
                                <span className="cc-cat-lock" title="Vínculo de alcance">
                                  ↗
                                </span>
                              ) : org.inUse ? (
                                <span className="cc-cat-lock" title="En uso">
                                  🔒
                                </span>
                              ) : (
                                canEdit && (
                                  <button
                                    type="button"
                                    className="cc-cat-rm"
                                    title="Eliminar"
                                    onClick={() => removeNode(org, 'organismo')}
                                  >
                                    ×
                                  </button>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </NestedRow>
                  ))}
                </div>
              )}
            </NestedRow>
          ))}
        </div>
      )}

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
