import { useEffect, useMemo, useState } from 'react';
import {
  createAccessProfile,
  deleteAccessProfile,
  fetchAccessProfiles,
  patchAccessProfile,
} from '../api';

const ROLE_LABEL = {
  root: 'Administrador',
  region_admin: 'Administrador de región',
  region_user: 'Usuario de región',
  zone_admin: 'Administrador de zona',
  zone_user: 'Usuario de zona',
  unit_admin: 'Administrador de unidad',
  unit_user: 'Usuario de unidad',
};

const ACTION_LABEL = {
  agregar: 'Agregar',
  editar: 'Editar',
  eliminar: 'Eliminar',
};

function ensureModuleEntry(def, raw) {
  const cur = raw && typeof raw === 'object' ? raw : {};
  const ver = Boolean(cur.ver);
  const entry = { ver };
  for (const act of def.actions || []) {
    if (act === 'ver') continue;
    entry[act] = ver ? Boolean(cur[act]) : false;
  }
  if (def.tabs?.length) {
    const prev = cur.tabs && typeof cur.tabs === 'object' ? cur.tabs : null;
    const tabs = {};
    for (const t of def.tabs) {
      if (!ver) tabs[t.key] = false;
      else if (prev && Object.prototype.hasOwnProperty.call(prev, t.key)) {
        tabs[t.key] = Boolean(prev[t.key]);
      } else tabs[t.key] = true;
    }
    if (ver && !Object.values(tabs).some(Boolean)) tabs[def.tabs[0].key] = true;
    entry.tabs = tabs;
  }
  return entry;
}

function normalizeEditingModules(catalog, modules) {
  const out = {};
  for (const def of catalog) {
    out[def.key] = ensureModuleEntry(def, modules?.[def.key]);
  }
  return out;
}

export default function DispatchProfiles({ session }) {
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modulesCatalog, setModulesCatalog] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [inner, setInner] = useState('modulos');
  const [name, setName] = useState('');
  const [basedOn, setBasedOn] = useState('unit_user');

  async function reload() {
    const data = await fetchAccessProfiles(session.token);
    setProfiles(data.profiles || []);
    setRoles(data.roles || []);
    setModulesCatalog(data.modules || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [session.token]);

  const groups = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const m of modulesCatalog) {
      const g = m.group || 'otros';
      if (!map.has(g)) {
        map.set(g, { key: g, label: m.groupLabel || g, items: [] });
        order.push(g);
      }
      map.get(g).items.push(m);
    }
    return order.map((k) => map.get(k));
  }, [modulesCatalog]);

  function open(p) {
    setEditing({
      ...p,
      modules: normalizeEditingModules(modulesCatalog, p.modules || {}),
      visibility: { ...(p.visibility || {}) },
    });
    setInner('modulos');
    setError('');
  }

  function patchModule(key, updater) {
    setEditing((cur) => {
      if (!cur) return cur;
      const def = modulesCatalog.find((m) => m.key === key);
      const prev = ensureModuleEntry(def || { key, actions: [], tabs: [] }, cur.modules?.[key]);
      const next = updater({ ...prev });
      return {
        ...cur,
        modules: {
          ...cur.modules,
          [key]: ensureModuleEntry(def || { key, actions: [], tabs: [] }, next),
        },
      };
    });
  }

  function toggleVer(key) {
    patchModule(key, (entry) => {
      const nextVer = !entry.ver;
      const next = { ...entry, ver: nextVer };
      if (!nextVer) {
        for (const k of Object.keys(next)) {
          if (k === 'ver' || k === 'tabs') continue;
          next[k] = false;
        }
        if (next.tabs) {
          const tabs = { ...next.tabs };
          for (const t of Object.keys(tabs)) tabs[t] = false;
          next.tabs = tabs;
        }
      } else if (next.tabs) {
        const tabs = { ...next.tabs };
        if (!Object.values(tabs).some(Boolean)) {
          const first = Object.keys(tabs)[0];
          if (first) tabs[first] = true;
        }
        next.tabs = tabs;
      }
      return next;
    });
  }

  function toggleTab(key, tabKey) {
    patchModule(key, (entry) => {
      if (!entry.ver) return entry;
      const tabs = { ...(entry.tabs || {}), [tabKey]: !entry.tabs?.[tabKey] };
      if (!Object.values(tabs).some(Boolean)) {
        // No dejar el módulo visible sin ninguna pestaña
        return entry;
      }
      return { ...entry, tabs };
    });
  }

  function toggleAction(key, act) {
    patchModule(key, (entry) => {
      if (!entry.ver && act !== 'ver') {
        return { ...entry, ver: true, [act]: true };
      }
      return { ...entry, [act]: !entry[act] };
    });
  }

  function toggleSee(role) {
    setEditing((cur) => ({
      ...cur,
      visibility: { ...cur.visibility, [role]: !cur.visibility?.[role] },
    }));
  }

  async function save() {
    try {
      await patchAccessProfile(session.token, editing.id, {
        name: editing.name,
        modules: editing.modules,
        visibility: editing.visibility,
        consoleAccess: editing.console_access,
        canHideLocation: editing.can_hide_location,
      });
      setEditing(null);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  }

  async function duplicate() {
    try {
      if (!name.trim()) {
        setError('Escribe un nombre para el perfil nuevo');
        return;
      }
      await createAccessProfile(session.token, { name: name.trim(), basedOn });
      setName('');
      await reload();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <header className="dispatch-header">
        <div>
          <h1>Perfiles</h1>
          <p className="cc-page-sub">
            Un perfil tiene dos partes: módulos (qué puede ver y hacer) y alcance (a quién ve). Los 7
            perfiles base no se borran. Solo el Administrador edita perfiles.
          </p>
        </div>
      </header>
      {error ? <p className="cc-form-error">{error}</p> : null}
      <div className="cc-card" style={{ padding: 12, marginBottom: 12 }}>
        <strong>Nuevo perfil a partir de una plantilla</strong>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del perfil" />
          <select value={basedOn} onChange={(e) => setBasedOn(e.target.value)}>
            {profiles
              .filter((p) => p.is_system && p.code !== 'root')
              .map((p) => (
                <option key={p.id} value={p.code}>
                  {p.name}
                </option>
              ))}
          </select>
          <button type="button" className="cc-btn primary" onClick={duplicate}>
            Crear
          </button>
        </div>
      </div>
      <div className="cc-table-wrap">
        <table className="cc-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Consola</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.is_system ? 'Sistema' : 'Personalizado'}</td>
                <td>{p.console_access ? 'Sí' : 'No'}</td>
                <td>
                  {!p.is_locked && (
                    <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => open(p)}>
                      Editar
                    </button>
                  )}
                  {!p.is_system && (
                    <button
                      type="button"
                      className="cc-btn ghost cc-btn-sm"
                      onClick={() =>
                        deleteAccessProfile(session.token, p.id)
                          .then(reload)
                          .catch((e) => setError(e.message))
                      }
                    >
                      Eliminar
                    </button>
                  )}
                  {p.is_locked ? <span>Inamovible</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="sys-modal-backdrop" role="presentation">
          <div className="sys-modal sys-modal--lg cc-perm-modal" role="dialog" aria-labelledby="cc-perm-title">
            <header className="sys-modal-head">
              <h2 id="cc-perm-title">{editing.name}</h2>
              <button type="button" className="sys-modal-x" onClick={() => setEditing(null)}>
                ×
              </button>
            </header>
            <div className="sys-modal-body cc-perm-modal-body">
              <label className="cc-perm-name">
                Nombre
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <div className="cc-perm-tabs">
                <button
                  type="button"
                  className={`cc-btn ${inner === 'modulos' ? 'primary' : ''}`}
                  onClick={() => setInner('modulos')}
                >
                  Módulos y permisos
                </button>
                <button
                  type="button"
                  className={`cc-btn ${inner === 'alcance' ? 'primary' : ''}`}
                  onClick={() => setInner('alcance')}
                >
                  Alcance / visibilidad
                </button>
              </div>

              {inner === 'modulos' ? (
                <div className="cc-perm-board">
                  <p className="cc-perm-lead">
                    1) Visible en el menú · 2) Pestañas (si aplica) · 3) Agregar / Editar / Eliminar
                  </p>
                  {groups.map((g) => (
                    <section key={g.key} className="cc-perm-group">
                      <h3 className="cc-perm-group-title">{g.label}</h3>
                      <div className="cc-perm-cards">
                        {g.items.map((def) => {
                          const entry = editing.modules?.[def.key] || { ver: false };
                          const crudActs = (def.actions || []).filter((a) => a !== 'ver');
                          const disabled = !entry.ver;
                          return (
                            <article
                              key={def.key}
                              className={`cc-perm-card${entry.ver ? ' is-on' : ''}`}
                            >
                              <header className="cc-perm-card-head">
                                <label className="cc-perm-visible">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(entry.ver)}
                                    onChange={() => toggleVer(def.key)}
                                  />
                                  <span>
                                    <strong>{def.label}</strong>
                                    <em>{def.hint || 'Visible en el menú'}</em>
                                  </span>
                                </label>
                              </header>

                              {def.tabs?.length ? (
                                <div className={`cc-perm-section${disabled ? ' is-disabled' : ''}`}>
                                  <div className="cc-perm-section-label">Pestañas</div>
                                  <div className="cc-perm-chips">
                                    {def.tabs.map((t) => (
                                      <label key={t.key} className="cc-perm-chip">
                                        <input
                                          type="checkbox"
                                          disabled={disabled}
                                          checked={Boolean(entry.tabs?.[t.key])}
                                          onChange={() => toggleTab(def.key, t.key)}
                                        />
                                        {t.label}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {crudActs.length ? (
                                <div className={`cc-perm-section${disabled ? ' is-disabled' : ''}`}>
                                  <div className="cc-perm-section-label">Acciones</div>
                                  <div className="cc-perm-chips">
                                    {crudActs.map((act) => (
                                      <label key={act} className="cc-perm-chip">
                                        <input
                                          type="checkbox"
                                          disabled={disabled}
                                          checked={Boolean(entry[act])}
                                          onChange={() => toggleAction(def.key, act)}
                                        />
                                        {ACTION_LABEL[act] || act}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="cc-perm-hint">Solo controla si aparece en el menú.</p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="cc-perm-alcance">
                  <p>Quién aparece para este perfil según jerarquía (territorio aparte en el mapa).</p>
                  {(roles.length
                    ? roles
                    : Object.keys(ROLE_LABEL).map((value) => ({ value, label: ROLE_LABEL[value] }))
                  ).map((r) => (
                    <label key={r.value} className="cc-perm-alcance-row">
                      <input
                        type="checkbox"
                        checked={Boolean(editing.visibility?.[r.value])}
                        onChange={() => toggleSee(r.value)}
                      />
                      Ver {r.label || ROLE_LABEL[r.value] || r.value}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <footer className="sys-modal-actions">
              <button type="button" className="cc-btn ghost" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="button" className="cc-btn primary" onClick={save}>
                Guardar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
