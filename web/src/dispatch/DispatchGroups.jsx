import { useEffect, useState } from 'react';
import {
  addGroupMember,
  createGroup,
  deleteAdminGroup,
  fetchAdminGroupMembers,
  fetchAdminGroups,
  fetchAdminUsers,
  isAdminUser,
  isRootUser,
  patchAdminGroup,
  purgeGroupMessages,
  removeGroupMember,
} from '../api';

const MEMBER_ROLES = [
  { value: 'member', label: 'Miembro' },
  { value: 'leader', label: 'Líder' },
  { value: 'listen_only', label: 'Solo escucha' },
];

export default function DispatchGroups({ session }) {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [assign, setAssign] = useState({ groupId: '', userId: '', role: 'member' });
  const [error, setError] = useState('');
  const canManage = isAdminUser(session.user);
  const isRoot = isRootUser(session.user);

  async function reload() {
    const [g, u] = await Promise.all([
      fetchAdminGroups(session.token),
      fetchAdminUsers(session.token),
    ]);
    setGroups(g.groups || []);
    setUsers(u.users || []);
  }

  async function loadMembers(groupId) {
    if (!groupId) {
      setMembers([]);
      return;
    }
    const data = await fetchAdminGroupMembers(session.token, groupId);
    setMembers(data.members || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [session.token]);

  useEffect(() => {
    loadMembers(selectedGroupId).catch((e) => setError(e.message));
  }, [selectedGroupId, session.token]);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await createGroup(session.token, { name, description });
      setName('');
      setDescription('');
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onAssign(e) {
    e.preventDefault();
    try {
      await addGroupMember(session.token, assign.groupId, assign.userId, assign.role);
      const gid = assign.groupId;
      setAssign({ groupId: '', userId: '', role: 'member' });
      await reload();
      if (selectedGroupId === gid || selectedGroupId) {
        await loadMembers(selectedGroupId || gid);
      }
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivateGroup(g) {
    if (!window.confirm(`¿Desactivar el grupo «${g.name}»?`)) return;
    try {
      await deleteAdminGroup(session.token, g.id, { hard: false });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function hardDeleteGroup(g) {
    if (!window.confirm(`¿Eliminar permanentemente «${g.name}» y todo su historial de chat?`)) {
      return;
    }
    try {
      await deleteAdminGroup(session.token, g.id, { hard: true });
      if (selectedGroupId === g.id) setSelectedGroupId('');
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reactivateGroup(g) {
    try {
      await patchAdminGroup(session.token, g.id, { isActive: true });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function purgeChat(g) {
    if (!window.confirm(`¿Vaciar todos los mensajes del chat «${g.name}»?`)) return;
    try {
      const r = await purgeGroupMessages(session.token, g.id);
      window.alert(`Mensajes eliminados: ${r.deleted ?? 0}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function kickMember(userId) {
    if (!selectedGroupId) return;
    if (!window.confirm('¿Quitar a este miembro del grupo?')) return;
    try {
      await removeGroupMember(session.token, selectedGroupId, userId);
      await loadMembers(selectedGroupId);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedName = groups.find((g) => g.id === selectedGroupId)?.name;

  return (
    <div className="dispatch-page">
      <header className="dispatch-header">
        <div>
          <h1>Grupos y canales</h1>
          <p className="cc-page-sub">
            Canales PTT, membresía y administración del historial de chat.
          </p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}

      <form className="admin-form" onSubmit={onCreate}>
        <h2>Nuevo grupo</h2>
        <label className="field">
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Descripción</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="field field-actions">
          <button type="submit" className="cc-btn primary">
            Crear grupo
          </button>
        </div>
      </form>

      <form className="admin-form" onSubmit={onAssign}>
        <h2>Asignar miembro</h2>
        <label className="field">
          <span>Grupo</span>
          <select
            value={assign.groupId}
            onChange={(e) => setAssign({ ...assign, groupId: e.target.value })}
            required
          >
            <option value="">Seleccionar…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Usuario</span>
          <select
            value={assign.userId}
            onChange={(e) => setAssign({ ...assign, userId: e.target.value })}
            required
          >
            <option value="">Seleccionar…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Rol en canal</span>
          <select
            value={assign.role}
            onChange={(e) => setAssign({ ...assign, role: e.target.value })}
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field field-actions">
          <button type="submit" className="cc-btn primary">
            Asignar
          </button>
        </div>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Sala</th>
            <th>Miembros</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td>
                <code>{g.livekit_room}</code>
              </td>
              <td>{g.member_count}</td>
              <td>
                <span className={`status-pill ${g.is_active ? 'on' : 'off'}`}>
                  {g.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button
                    type="button"
                    className="cc-btn ghost"
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    Miembros
                  </button>
                  {canManage && g.is_active && (
                    <>
                      <button type="button" className="cc-btn ghost" onClick={() => purgeChat(g)}>
                        Vaciar chat
                      </button>
                      <button
                        type="button"
                        className="cc-btn ghost"
                        onClick={() => deactivateGroup(g)}
                      >
                        Desactivar
                      </button>
                    </>
                  )}
                  {canManage && !g.is_active && (
                    <button type="button" className="cc-btn ghost" onClick={() => reactivateGroup(g)}>
                      Reactivar
                    </button>
                  )}
                  {isRoot && (
                    <button type="button" className="cc-btn danger" onClick={() => hardDeleteGroup(g)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedGroupId && (
        <section className="members-panel">
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
            Miembros — {selectedName || selectedGroupId}
          </h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol en canal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.displayName}</td>
                  <td>
                    <code className="cc-mono">{m.username || m.email}</code>
                  </td>
                  <td>{MEMBER_ROLES.find((r) => r.value === m.role)?.label || m.role}</td>
                  <td>
                    {canManage && (
                      <button type="button" className="cc-btn ghost" onClick={() => kickMember(m.id)}>
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
