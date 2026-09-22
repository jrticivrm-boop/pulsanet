import { useEffect, useState } from 'react';
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

export default function DispatchProfiles({ session }) {
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [inner, setInner] = useState('modulos');
  const [name, setName] = useState('');
  const [basedOn, setBasedOn] = useState('unit_user');

  async function reload() {
    const data = await fetchAccessProfiles(session.token);
    setProfiles(data.profiles || []);
    setRoles(data.roles || []);
    setModules(data.modules || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [session.token]);

  function open(p) {
    setEditing({
      ...p,
      modules: { ...(p.modules || {}) },
      visibility: { ...(p.visibility || {}) },
    });
    setInner('modulos');
    setError('');
  }

  function toggleMod(key, act) {
    setEditing((cur) => {
      const mods = { ...cur.modules, [key]: { ...(cur.modules[key] || {}), [act]: !cur.modules?.[key]?.[act] } };
      return { ...cur, modules: mods };
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
            Un perfil tiene dos partes: módulos (qué puede hacer) y alcance (a quién ve). Los 7 base no se borran.
            Solo el Administrador edita perfiles.
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
                      onClick={() => deleteAccessProfile(session.token, p.id).then(reload).catch((e) => setError(e.message))}
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
          <div className="sys-modal" role="dialog" style={{ maxWidth: 720 }}>
            <header className="sys-modal-head">
              <h2>{editing.name}</h2>
              <button type="button" className="sys-modal-x" onClick={() => setEditing(null)}>×</button>
            </header>
            <div className="sys-modal-body">
              <label>
                Nombre
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
                <button type="button" className={`cc-btn ${inner === 'modulos' ? 'primary' : ''}`} onClick={() => setInner('modulos')}>
                  Módulos y permisos
                </button>
                <button type="button" className={`cc-btn ${inner === 'alcance' ? 'primary' : ''}`} onClick={() => setInner('alcance')}>
                  Alcance / visibilidad
                </button>
              </div>
              {inner === 'modulos' ? (
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      <th>Ver</th>
                      <th>Agregar</th>
                      <th>Editar</th>
                      <th>Eliminar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modules.length ? modules : Object.keys(editing.modules || {}).map((key) => ({ key, label: key }))).map((m) => (
                      <tr key={m.key}>
                        <td>{m.label}</td>
                        {['ver', 'agregar', 'editar', 'eliminar'].map((act) => (
                          <td key={act}>
                            <input
                              type="checkbox"
                              checked={Boolean(editing.modules?.[m.key]?.[act])}
                              onChange={() => toggleMod(m.key, act)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div>
                  <p>Quién aparece para este perfil (antes de ocultar ubicación y territorio).</p>
                  {(roles.length ? roles : Object.keys(ROLE_LABEL).map((value) => ({ value, label: ROLE_LABEL[value] }))).map((r) => (
                    <label key={r.value} style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
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
              <button type="button" className="cc-btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="button" className="cc-btn primary" onClick={save}>Guardar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
