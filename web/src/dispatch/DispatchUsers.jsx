import { useEffect, useMemo, useState } from 'react';
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminGroups,
  fetchAdminUsers,
  isAdminUser,
  isRootUser,
  patchAdminUser,
  previewAdminUsername,
  usersCsvUrl,
} from '../api';

const ROLE_OPTIONS = [
  { value: 'operator', label: 'Operador' },
  { value: 'dispatcher', label: 'Despacho' },
  { value: 'admin', label: 'Administrador' },
  { value: 'root', label: 'Superadministrador' },
];

const EMPTY_FORM = {
  givenNames: '',
  paternalSurname: '',
  maternalSurname: '',
  role: 'operator',
};

function roleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
}

/** Sugiere General si existe; si no, el primer grupo activo. */
function suggestedGroupIds(groups) {
  const active = (groups || []).filter((g) => g.is_active !== false);
  if (!active.length) return [];
  const general = active.find((g) => String(g.name).toLowerCase() === 'general');
  return [(general || active[0]).id];
}

export default function DispatchUsers({ session }) {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState({ username: '', displayName: '' });
  const [step, setStep] = useState('datos'); // 'datos' | 'grupos'
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const canManage = isAdminUser(session.user);
  const isRoot = isRootUser(session.user);

  const previewKey = useMemo(
    () =>
      [form.givenNames, form.paternalSurname, form.maternalSurname]
        .map((s) => String(s || '').trim())
        .join('|'),
    [form.givenNames, form.paternalSurname, form.maternalSurname]
  );

  const activeGroups = useMemo(
    () => (groups || []).filter((g) => g.is_active !== false),
    [groups]
  );

  async function reload() {
    const [usersData, groupsData] = await Promise.all([
      fetchAdminUsers(session.token),
      fetchAdminGroups(session.token),
    ]);
    setUsers(usersData.users || []);
    setGroups(groupsData.groups || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [session.token]);

  useEffect(() => {
    if (!canManage) return;
    if (!form.givenNames.trim() || !form.paternalSurname.trim()) {
      setPreview({ username: '', displayName: '' });
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      previewAdminUsername(session.token, {
        givenNames: form.givenNames,
        paternalSurname: form.paternalSurname,
        maternalSurname: form.maternalSurname,
      })
        .then((data) => {
          if (!cancelled) {
            setPreview({
              username: data.username || '',
              displayName: data.displayName || '',
            });
          }
        })
        .catch(() => {
          if (!cancelled) setPreview({ username: '', displayName: '' });
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [previewKey, canManage, session.token]);

  function resetCreateFlow() {
    setForm(EMPTY_FORM);
    setPreview({ username: '', displayName: '' });
    setStep('datos');
    setSelectedGroupIds([]);
  }

  function goToGroupsStep(e) {
    e.preventDefault();
    if (!preview.username) {
      setError('Completa nombre y apellido paterno para generar el usuario.');
      return;
    }
    setError('');
    setSelectedGroupIds(suggestedGroupIds(activeGroups));
    setStep('grupos');
  }

  function toggleGroup(id) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await createAdminUser(session.token, {
        ...form,
        groupIds: selectedGroupIds,
      });
      resetCreateFlow();
      await reload();
      setError('');
      const gNames = (created.groups || []).map((g) => g.name).join(', ');
      const temp = created.temporaryPassword || '';
      const lines = [
        `Usuario: ${created.user.username}`,
        temp ? `Contraseña temporal: ${temp}` : null,
        'Debe cambiarla en el primer ingreso.',
        gNames ? `Grupos: ${gNames}` : 'Sin grupos',
      ].filter(Boolean);
      window.alert(lines.join('\n'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u) {
    try {
      await patchAdminUser(session.token, u.id, { isActive: !u.isActive });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePanicPerm(u) {
    try {
      await patchAdminUser(session.token, u.id, { canReceivePanic: !u.canReceivePanic });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeRole(u, role) {
    try {
      await patchAdminUser(session.token, u.id, { role });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(u) {
    if (
      !window.confirm(
        `¿Generar contraseña temporal para ${u.displayName || u.username}? Deberá cambiarla al entrar.`
      )
    ) {
      return;
    }
    try {
      const data = await patchAdminUser(session.token, u.id, { resetPassword: true });
      setError('');
      window.alert(
        [
          `Usuario: ${u.username}`,
          `Contraseña temporal: ${data.temporaryPassword}`,
          'Debe cambiarla en el próximo ingreso.',
        ].join('\n')
      );
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeUser(u) {
    if (
      !window.confirm(
        `¿Eliminar permanentemente a ${u.displayName} (${u.username})?`
      )
    ) {
      return;
    }
    try {
      await deleteAdminUser(session.token, u.id);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function downloadCsv() {
    fetch(usersCsvUrl(), {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo exportar');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tacticalptx-usuarios.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e.message));
  }

  return (
    <div className="dispatch-page">
      <header className="dispatch-header">
        <div>
          <h1>Usuarios</h1>
          <p className="cc-page-sub">
            Alta con nombre completo: el usuario se genera automáticamente
            (ej. Guadalupe Gómez de la Cruz → <code className="cc-mono">ggomezd2</code>).
          </p>
        </div>
        <button type="button" className="cc-btn" onClick={downloadCsv}>
          Exportar CSV
        </button>
      </header>
      {error && <p className="error">{error}</p>}

      {canManage && (
        <form
          className="admin-form"
          onSubmit={step === 'datos' ? goToGroupsStep : onCreate}
        >
          <h2>Alta de usuario</h2>
          <p className="cc-form-steps" aria-label="Pasos del alta">
            <span className={step === 'datos' ? 'on' : ''}>1. Datos</span>
            <span aria-hidden="true">→</span>
            <span className={step === 'grupos' ? 'on' : ''}>2. Grupos</span>
          </p>

          {step === 'datos' && (
            <>
              <label className="field">
                <span>Nombre(s)</span>
                <input
                  value={form.givenNames}
                  onChange={(e) => setForm({ ...form, givenNames: e.target.value })}
                  placeholder="Juan Carlos"
                  required
                />
              </label>
              <label className="field">
                <span>Apellido paterno</span>
                <input
                  value={form.paternalSurname}
                  onChange={(e) => setForm({ ...form, paternalSurname: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Apellido materno</span>
                <input
                  value={form.maternalSurname}
                  onChange={(e) => setForm({ ...form, maternalSurname: e.target.value })}
                  placeholder="De la Cruz"
                />
              </label>
              <label className="field">
                <span>Usuario generado</span>
                <input
                  value={preview.username}
                  readOnly
                  placeholder="Se calcula al completar nombre y apellidos"
                  className="cc-input-readonly"
                />
              </label>
              <label className="field">
                <span>Rol</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {ROLE_OPTIONS.filter((r) => r.value !== 'root' || isRoot).map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="cc-group-pick-hint">
                Se generará una <strong>contraseña temporal</strong>; el usuario deberá
                cambiarla en el primer ingreso.
              </p>
              <div className="field field-actions">
                <button
                  type="submit"
                  className="cc-btn primary"
                  disabled={!preview.username}
                >
                  Continuar a grupos
                </button>
              </div>
            </>
          )}

          {step === 'grupos' && (
            <>
              <div className="cc-create-summary">
                <p>
                  <strong>{preview.displayName || 'Nuevo usuario'}</strong>
                </p>
                <p>
                  Usuario: <code className="cc-mono">{preview.username}</code>
                  {' · '}
                  {roleLabel(form.role)}
                </p>
              </div>

              <fieldset className="cc-group-pick">
                <legend>¿A qué grupos ingresa?</legend>
                <p className="cc-group-pick-hint">
                  Se sugiere el canal <strong>General</strong> cuando existe. Puedes marcar
                  varios o ninguno.
                </p>
                {activeGroups.length === 0 ? (
                  <p className="muted">No hay grupos activos. Puedes crear el usuario sin canal.</p>
                ) : (
                  <ul className="cc-group-check-list">
                    {activeGroups.map((g) => {
                      const suggested = suggestedGroupIds(activeGroups).includes(g.id);
                      const checked = selectedGroupIds.includes(g.id);
                      return (
                        <li key={g.id}>
                          <label className={`cc-group-check ${checked ? 'on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleGroup(g.id)}
                            />
                            <span className="cc-group-check-body">
                              <span className="cc-group-check-name">{g.name}</span>
                              {suggested && (
                                <span className="cc-group-suggest">sugerido</span>
                              )}
                              {g.description ? (
                                <span className="cc-group-check-desc">{g.description}</span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>

              <div className="field field-actions">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setStep('datos')}
                  disabled={busy}
                >
                  Atrás
                </button>
                <button type="submit" className="cc-btn primary" disabled={busy}>
                  {busy
                    ? 'Creando…'
                    : selectedGroupIds.length
                      ? `Crear e ingresar a ${selectedGroupIds.length} grupo(s)`
                      : 'Crear sin grupos'}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Pánico</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.displayName}</td>
              <td>
                <code className="cc-mono">{u.username}</code>
                {u.mustChangePassword ? (
                  <span className="cc-group-suggest" title="Debe cambiar contraseña al entrar">
                    clave temporal
                  </span>
                ) : null}
              </td>
              <td>
                {canManage && u.id !== session.user.id && (isRoot || u.role !== 'root') ? (
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    aria-label={`Rol de ${u.displayName}`}
                  >
                    {ROLE_OPTIONS.filter((r) => r.value !== 'root' || isRoot).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  roleLabel(u.role)
                )}
              </td>
              <td>
                <span className={`status-pill ${u.isActive ? 'on' : 'off'}`}>
                  {u.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                {u.role === 'root' || u.role === 'admin' || u.role === 'dispatcher'
                  ? 'Por rol'
                  : u.canReceivePanic
                    ? 'Sí'
                    : 'No'}
              </td>
              <td>
                {canManage && u.id !== session.user.id && (isRoot || u.role !== 'root') && (
                  <div className="row-actions">
                    <button type="button" className="cc-btn ghost" onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button type="button" className="cc-btn ghost" onClick={() => resetPassword(u)}>
                      Restablecer clave
                    </button>
                    {u.role === 'operator' && (
                      <button
                        type="button"
                        className="cc-btn ghost"
                        onClick={() => togglePanicPerm(u)}
                      >
                        {u.canReceivePanic ? 'Quitar pánico' : 'Dar pánico'}
                      </button>
                    )}
                    {isRoot && (
                      <button type="button" className="cc-btn danger" onClick={() => removeUser(u)}>
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
