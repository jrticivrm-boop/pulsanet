import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchTacticalSiteGroups,
  createTacticalSiteGroup,
  patchTacticalSiteGroup,
  deleteTacticalSiteGroup,
  fetchTacticalSites,
  createTacticalSite,
  patchTacticalSite,
  deleteTacticalSite,
  uploadTacticalSiteGroupIcon,
  deleteTacticalSiteGroupIcon,
} from '../api';
import AppDialog from '../AppDialog.jsx';
import { TACTICAL_SITE_COLORS } from './TacticalSitesLayer.jsx';

const PALETTE_KEY = 'tacticalptx_tactical_site_palette';
/** Mapas (Consola / Seguimiento / Radio) reescuchan este bus tras mutar el catálogo. */
const TACTICAL_SITES_CHANGED = 'tacticalptx:tactical-sites-changed';

function notifyTacticalSitesChanged() {
  try {
    window.dispatchEvent(new CustomEvent(TACTICAL_SITES_CHANGED));
  } catch {
    /* ignore */
  }
}

function siteCountForGroup(sites, groupId) {
  const gid = String(groupId);
  return sites.reduce((n, s) => (String(s.groupId) === gid ? n + 1 : n), 0);
}

function normalizeHex(c) {
  const s = String(c || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return null;
}

function loadPalette() {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (!raw) return [...TACTICAL_SITE_COLORS];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...TACTICAL_SITE_COLORS];
    return TACTICAL_SITE_COLORS.map((def, i) => normalizeHex(arr[i]) || def);
  } catch {
    return [...TACTICAL_SITE_COLORS];
  }
}

function savePalette(colors) {
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(colors));
  } catch {
    /* ignore */
  }
}

const emptyForm = () => ({
  name: '',
  locationText: '',
  notes: '',
  latitude: '',
  longitude: '',
  radiusM: '',
});

export default function CatalogTacticalSites({ session }) {
  const [groups, setGroups] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [palette, setPalette] = useState(loadPalette);
  const [groupColor, setGroupColor] = useState(() => loadPalette()[0]);
  const [siteForm, setSiteForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [groupIconPreview, setGroupIconPreview] = useState('');
  const fileRef = useRef(null);
  const groupBlobRef = useRef('');
  const colorInputRef = useRef(null);
  const colorEditIndexRef = useRef(0);
  const colorPersistTimerRef = useRef(0);
  const colorPersistGroupIdRef = useRef('');

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [gData, sData] = await Promise.all([
        fetchTacticalSiteGroups(session.token),
        fetchTacticalSites(session.token),
      ]);
      const gs = gData.groups || [];
      setGroups(gs);
      setSites(sData.sites || []);
      setSelectedGroupId((prev) => {
        if (prev && gs.some((g) => String(g.id) === String(prev))) return prev;
        return gs[0]?.id || '';
      });
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar sitios');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  /** Tras POST/PATCH/DELETE: state local ya actualizado; re-fetch silencioso + avisar mapas. */
  const refreshAfterMutation = useCallback(async () => {
    notifyTacticalSitesChanged();
    await load({ quiet: true });
    notifyTacticalSitesChanged();
  }, [load]);

  useEffect(
    () => () => {
      if (groupBlobRef.current) URL.revokeObjectURL(groupBlobRef.current);
    },
    []
  );

  const sitesInGroup = useMemo(
    () => sites.filter((s) => String(s.groupId) === String(selectedGroupId)),
    [sites, selectedGroupId]
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => String(g.id) === String(selectedGroupId)) || null,
    [groups, selectedGroupId]
  );

  useEffect(() => {
    let cancelled = false;
    if (groupBlobRef.current) {
      URL.revokeObjectURL(groupBlobRef.current);
      groupBlobRef.current = '';
    }
    setGroupIconPreview('');
    const g = groups.find((x) => String(x.id) === String(selectedGroupId));
    if (!g?.iconUrl || !session.token) return undefined;
    fetch(g.iconUrl, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        groupBlobRef.current = url;
        setGroupIconPreview(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, groups, session.token]);

  function resetSiteForm() {
    setEditingId('');
    setSiteForm(emptyForm());
  }

  function startEdit(s) {
    setEditingId(s.id);
    setSelectedGroupId(s.groupId);
    setSiteForm({
      name: s.name || '',
      locationText: s.locationText || '',
      notes: s.notes || '',
      latitude: String(s.latitude ?? ''),
      longitude: String(s.longitude ?? ''),
      radiusM: s.radiusM != null ? String(s.radiusM) : '',
    });
  }

  async function addGroup() {
    const name = groupName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const data = await createTacticalSiteGroup(session.token, { name, color: groupColor });
      setGroupName('');
      if (data.group) {
        setGroups((prev) => {
          if (prev.some((g) => String(g.id) === String(data.group.id))) return prev;
          return [...prev, { ...data.group, siteCount: 0 }];
        });
        setSelectedGroupId(data.group.id);
      }
      await refreshAfterMutation();
      if (data.group?.id) setSelectedGroupId(data.group.id);
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function paintLiveColor(hex) {
    const color = normalizeHex(hex);
    if (!color) return null;
    const idx = colorEditIndexRef.current;
    setGroupColor(color);
    setPalette((prev) => {
      const next = [...prev];
      next[idx] = color;
      savePalette(next);
      return next;
    });
    const gid = selectedGroupId;
    if (gid) {
      setGroups((prev) =>
        prev.map((g) => (String(g.id) === String(gid) ? { ...g, color } : g))
      );
      setSites((prev) =>
        prev.map((s) =>
          String(s.groupId) === String(gid) ? { ...s, groupColor: color } : s
        )
      );
    }
    return color;
  }

  function schedulePersistGroupColor(hex) {
    const color = normalizeHex(hex);
    if (!color || !selectedGroupId) return;
    colorPersistGroupIdRef.current = String(selectedGroupId);
    window.clearTimeout(colorPersistTimerRef.current);
    colorPersistTimerRef.current = window.setTimeout(async () => {
      const gid = colorPersistGroupIdRef.current;
      if (!gid) return;
      try {
        await patchTacticalSiteGroup(session.token, gid, { color });
        notifyTacticalSitesChanged();
      } catch (e) {
        setDialog({ title: 'Error', message: e.message, alertOnly: true });
      }
    }, 350);
  }

  /** Doble clic en bolita → paleta nativa (sin cuadro intermedio). */
  function openColorPalette(index, hex) {
    colorEditIndexRef.current = index;
    setGroupColor(hex);
    const input = colorInputRef.current;
    if (!input) return;
    input.value = normalizeHex(hex) || TACTICAL_SITE_COLORS[0];
    try {
      input.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      /* fallback click */
    }
    try {
      input.click();
    } catch {
      /* ignore */
    }
  }

  /** Mientras arrastras el color en la paleta (evento input). */
  function onPaletteColorInput(e) {
    const color = paintLiveColor(e.target.value);
    if (color) schedulePersistGroupColor(color);
  }

  useEffect(
    () => () => {
      window.clearTimeout(colorPersistTimerRef.current);
    },
    []
  );

  function askRenameGroup() {
    const g = selectedGroup;
    if (!g) return;
    setDialog({
      title: 'Renombrar agrupación',
      message: `Nuevo nombre para «${g.name}»`,
      promptDefault: g.name,
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
          await patchTacticalSiteGroup(session.token, g.id, { name });
          setGroups((prev) =>
            prev.map((x) => (String(x.id) === String(g.id) ? { ...x, name } : x))
          );
          setDialog(null);
          await refreshAfterMutation();
        } catch (e) {
          setDialog({ title: 'Error', message: e.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function askDeleteGroup() {
    const g = selectedGroup;
    if (!g) return;
    setDialog({
      title: 'Eliminar agrupación',
      message: `¿Eliminar «${g.name}» y todos sus puntos?`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteTacticalSiteGroup(session.token, g.id);
          setDialog(null);
          setGroups((prev) => prev.filter((x) => String(x.id) !== String(g.id)));
          setSites((prev) => prev.filter((s) => String(s.groupId) !== String(g.id)));
          setSelectedGroupId('');
          resetSiteForm();
          await refreshAfterMutation();
        } catch (e) {
          setDialog({ title: 'Error', message: e.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function onGroupIconFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !selectedGroupId) return;
    setBusy(true);
    try {
      await uploadTacticalSiteGroupIcon(session.token, selectedGroupId, file);
      await refreshAfterMutation();
    } catch (err) {
      setDialog({ title: 'Error', message: err.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function removeGroupIcon() {
    if (!selectedGroupId) return;
    setBusy(true);
    try {
      await deleteTacticalSiteGroupIcon(session.token, selectedGroupId);
      await refreshAfterMutation();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function saveSite() {
    if (!selectedGroupId) {
      setDialog({
        title: 'Agrupación requerida',
        message: 'Selecciona o crea una agrupación primero.',
        alertOnly: true,
      });
      return;
    }
    const name = siteForm.name.trim();
    const latitude = Number(String(siteForm.latitude).replace(',', '.'));
    const longitude = Number(String(siteForm.longitude).replace(',', '.'));
    if (!name) {
      setDialog({ title: 'Cargo requerido', message: 'Escribe el cargo del punto (ej. Jefe S.T.I.).', alertOnly: true });
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setDialog({
        title: 'Coordenadas',
        message: 'Indica latitud y longitud válidas.',
        alertOnly: true,
      });
      return;
    }
    const body = {
      groupId: selectedGroupId,
      name,
      locationText: siteForm.locationText.trim() || null,
      notes: siteForm.notes.trim() || null,
      latitude,
      longitude,
      radiusM: siteForm.radiusM.trim() === '' ? null : Number(siteForm.radiusM),
    };
    setBusy(true);
    try {
      if (editingId) {
        await patchTacticalSite(session.token, editingId, body);
      } else {
        await createTacticalSite(session.token, body);
      }
      resetSiteForm();
      await refreshAfterMutation();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function askDeleteSite(s) {
    setDialog({
      title: 'Eliminar punto',
      message: `¿Eliminar «${s.name}»?`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteTacticalSite(session.token, s.id);
          setDialog(null);
          if (editingId === s.id) resetSiteForm();
          // Optimista: lista + contador del select salen del mismo array `sites`.
          setSites((prev) => prev.filter((x) => String(x.id) !== String(s.id)));
          setGroups((prev) =>
            prev.map((g) =>
              String(g.id) === String(s.groupId)
                ? { ...g, siteCount: Math.max(0, Number(g.siteCount || 0) - 1) }
                : g
            )
          );
          await refreshAfterMutation();
        } catch (e) {
          setDialog({ title: 'Error', message: e.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  if (loading) return <p className="cc-hint">Cargando sitios…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  const groupDot = selectedGroup?.color || groupColor;

  return (
    <div className="cc-tactical-sites cc-tactical-sites--simple">
      <p className="cc-cat-hint">
        Agrupaciones con icono compartido; puntos con nombre, coords, ubicación y datos. Se ven en
        Consola / Seguimiento. Aquí no hay mapa embebido.
      </p>

      <div className="cc-tactical-simple-grid">
        <section className="cc-tactical-panel">
          <h3>Agrupación</h3>
          <div className="cc-tactical-select-row">
            <select
              className="cc-cat-input"
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                resetSiteForm();
              }}
              aria-label="Agrupación"
            >
              <option value="" disabled>
                — Selecciona agrupación —
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({siteCountForGroup(sites, g.id)})
                </option>
              ))}
            </select>
            {selectedGroup ? (
              <>
                <button type="button" className="cc-btn ghost cc-btn-sm" onClick={askRenameGroup} disabled={busy}>
                  Renombrar
                </button>
                <button type="button" className="cc-btn ghost cc-btn-sm" onClick={askDeleteGroup} disabled={busy}>
                  Eliminar
                </button>
              </>
            ) : null}
          </div>

          {selectedGroup ? (
            <div className="cc-tactical-icon-card cc-tactical-icon-card--group">
              <div
                className={`cc-tactical-icon-preview-wrap${groupIconPreview ? ' has-icon' : ''}`}
                style={!groupIconPreview ? { '--cc-tactical-dot': groupDot } : undefined}
              >
                {groupIconPreview ? (
                  <img src={groupIconPreview} alt="" className="cc-tactical-icon-preview" />
                ) : (
                  <span className="cc-tactical-icon-placeholder" aria-hidden="true" />
                )}
              </div>
              <div className="cc-tactical-icon-actions">
                <span className="cc-tactical-icon-title">Icono de la agrupación</span>
                <p className="cc-hint">
                  Todos los puntos de «{selectedGroup.name}» usan este icono en Consola/Seguimiento
                  (en lugar del círculo de color)
                </p>
                <div className="cc-tactical-icon-btns">
                  <label className={`cc-btn primary cc-btn-sm${busy ? ' is-disabled' : ''}`}>
                    Subir icono PNG/JPG
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      hidden
                      disabled={busy}
                      onChange={onGroupIconFile}
                    />
                  </label>
                  {groupIconPreview ? (
                    <button
                      type="button"
                      className="cc-btn ghost cc-btn-sm"
                      onClick={removeGroupIcon}
                      disabled={busy}
                    >
                      Quitar icono
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="cc-tactical-new-group">
            <span className="cc-tactical-field-label">Nueva agrupación</span>
            <div className="cc-cat-toolbar">
              <input
                className="cc-cat-input"
                placeholder="Ej. Grupo táctico de Mier"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup()}
              />
              <div className="cc-tactical-colors" role="group" aria-label="Color en mapa">
                {palette.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`cc-tactical-color${groupColor === c ? ' is-active' : ''}`}
                    style={{ background: c }}
                    title={`${c} — clic elige · doble clic abre paleta`}
                    onClick={() => setGroupColor(c)}
                    onDoubleClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      openColorPalette(i, c);
                    }}
                  />
                ))}
                <input
                  ref={colorInputRef}
                  type="color"
                  className="cc-tactical-color-native"
                  aria-hidden="true"
                  tabIndex={-1}
                  defaultValue={groupColor}
                  onInput={onPaletteColorInput}
                  onChange={onPaletteColorInput}
                />
              </div>
              <button type="button" className="cc-btn cc-cat-add-btn" disabled={busy} onClick={addGroup}>
                + Agrupación
              </button>
            </div>
          </div>

          <h3 className="cc-tactical-list-title">Puntos en la agrupación</h3>
          <ul className="cc-tactical-site-list">
            {!selectedGroupId ? (
              <li className="cc-hint">Elige una agrupación</li>
            ) : sitesInGroup.length === 0 ? (
              <li className="cc-hint">Sin puntos aún</li>
            ) : (
              sitesInGroup.map((s) => (
                <li key={s.id} className={editingId === s.id ? 'is-editing' : ''}>
                  <button type="button" className="cc-tactical-site-pick" onClick={() => startEdit(s)}>
                    <strong>{s.name}</strong>
                    {s.locationText ? <small>{s.locationText}</small> : null}
                    <small>
                      {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
                    </small>
                  </button>
                  <button type="button" className="cc-cat-rm" title="Eliminar" onClick={() => askDeleteSite(s)}>
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="cc-tactical-panel">
          <h3>{editingId ? 'Editar punto' : 'Nuevo punto'}</h3>
          {editingId ? (
            <p className="cc-tactical-editing-banner">
              Editando «{siteForm.name || 'punto'}». Cambia los campos y pulsa Guardar cambios.
            </p>
          ) : null}

          <div className="cc-tactical-form">
            <label className="cc-tactical-field">
              <span>Cargo</span>
              <input
                className="cc-cat-input"
                placeholder='Ej. Jefe S.T.I.'
                value={siteForm.name}
                onChange={(e) => setSiteForm((f) => ({ ...f, name: e.target.value }))}
              />
              <small className="cc-tactical-field-hint">
                Texto bajo el icono en Consola / Seguimiento (solo el cargo).
              </small>
            </label>

            <div className="cc-tactical-coords" role="group" aria-label="Coordenadas">
              <label className="cc-tactical-field">
                <span>Latitud</span>
                <input
                  className="cc-cat-input cc-tactical-coord-input"
                  inputMode="decimal"
                  placeholder="26.3764950"
                  value={siteForm.latitude}
                  onChange={(e) => setSiteForm((f) => ({ ...f, latitude: e.target.value }))}
                />
              </label>
              <label className="cc-tactical-field">
                <span>Longitud</span>
                <input
                  className="cc-cat-input cc-tactical-coord-input"
                  inputMode="decimal"
                  placeholder="-99.0808790"
                  value={siteForm.longitude}
                  onChange={(e) => setSiteForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </label>
              <label className="cc-tactical-field">
                <span>Radio (m)</span>
                <input
                  className="cc-cat-input cc-tactical-coord-input"
                  inputMode="numeric"
                  placeholder="opc."
                  value={siteForm.radiusM}
                  onChange={(e) => setSiteForm((f) => ({ ...f, radiusM: e.target.value }))}
                />
              </label>
            </div>

            <label className="cc-tactical-field">
              <span>Ubicación (según coordenadas)</span>
              <textarea
                className="cc-cat-input cc-tactical-textarea"
                placeholder="Ej. Poblado los Guerra, Mun. Miguel Alemán, Tamaulipas"
                rows={2}
                value={siteForm.locationText}
                onChange={(e) => setSiteForm((f) => ({ ...f, locationText: e.target.value }))}
              />
            </label>

            <label className="cc-tactical-field">
              <span>Datos adicionales</span>
              <textarea
                className="cc-cat-input cc-tactical-textarea"
                placeholder="Observaciones, referencias, contacto…"
                rows={2}
                value={siteForm.notes}
                onChange={(e) => setSiteForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>

            <div className="cc-tactical-form-actions">
              <button type="button" className="cc-btn primary" disabled={busy || !selectedGroupId} onClick={saveSite}>
                {editingId ? 'Guardar cambios' : '+ Agregar punto'}
              </button>
              {editingId ? (
                <button type="button" className="cc-btn ghost" disabled={busy} onClick={resetSiteForm}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </section>
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
