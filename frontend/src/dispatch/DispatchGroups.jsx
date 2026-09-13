import { useEffect, useState } from 'react';
import {
  addGroupMember,
  createGroup,
  deleteAdminGroup,
  deleteGroupAvatar,
  fetchAdminGroupMembers,
  fetchAdminGroups,
  fetchAdminUsers,
  isAdminUser,
  isRootUser,
  patchAdminGroup,
  purgeGroupMessages,
  removeGroupMember,
  uploadGroupAvatar,
} from '../api';
import AppDialog from '../AppDialog';
import PersonAvatar from '../PersonAvatar';
import { invalidateGroupAvatarBlob } from '../avatarBlobCache.js';

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
  const [dialog, setDialog] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const canManage = isAdminUser(session.user);
  const isRoot = isRootUser(session.user);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

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

  async function onAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedGroupId) return;
    setAvatarBusy(true);
    try {
      await uploadGroupAvatar(session.token, selectedGroupId, file);
      invalidateGroupAvatarBlob(selectedGroupId, selectedGroup?.avatarUrl || '');
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemoveAvatar() {
    if (!selectedGroupId) return;
    setAvatarBusy(true);
    try {
      await deleteGroupAvatar(session.token, selectedGroupId);
      invalidateGroupAvatarBlob(selectedGroupId, selectedGroup?.avatarUrl || '');
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  function closeDialog() {
    if (dialogBusy) return;
    setDialog(null);
  }

  function askConfirm({ title, message, confirmLabel, danger, run }) {
    setDialog({
      title,
      message,
      confirmLabel,
      danger: Boolean(danger),
      alertOnly: false,
      run,
    });
  }

  async function runDialogAction() {
    if (!dialog?.run) {
      setDialog(null);
      return;
    }
    setDialogBusy(true);
    try {
      const next = await dialog.run();
      if (next?.alert) {
        setDialog({
          title: next.alert.title || 'Aviso',
          message: next.alert.message,
          confirmLabel: next.alert.confirmLabel || 'Entendido',
          danger: false,
          alertOnly: true,
          run: async () => {},
        });
      } else {
        setDialog(null);
      }
      setError('');
    } catch (err) {
      setDialog(null);
      setError(err.message);
    } finally {
      setDialogBusy(false);
    }
  }

  function deactivateGroup(g) {
    askConfirm({
      title: 'Desactivar grupo',
      message: `¿Desactivar el grupo «${g.name}»?`,
      confirmLabel: 'Desactivar',
      danger: true,
      run: async () => {
        await deleteAdminGroup(session.token, g.id, { hard: false });
        await reload();
      },
    });
  }

  function hardDeleteGroup(g) {
    askConfirm({
      title: 'Eliminar permanentemente',
      message: `¿Eliminar permanentemente «${g.name}» y todo su historial de chat?`,
      confirmLabel: 'Eliminar',
      danger: true,
      run: async () => {
        await deleteAdminGroup(session.token, g.id, { hard: true });
        if (selectedGroupId === g.id) setSelectedGroupId('');
        await reload();
      },
    });
  }

  async function reactivateGroup(g) {
    try {
      await patchAdminGroup(session.token, g.id, { isActive: true });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function purgeChat(g) {
    askConfirm({
      title: 'Vaciar chat',
      message: `¿Vaciar todos los mensajes del chat «${g.name}»?`,
      confirmLabel: 'Vaciar',
      danger: true,
      run: async () => {
        const r = await purgeGroupMessages(session.token, g.id);
        return {
          alert: {
            title: 'Chat vaciado',
            message: `Mensajes eliminados: ${r.deleted ?? 0}`,
          },
        };
      },
    });
  }

  function kickMember(userId) {
    if (!selectedGroupId) return;
    askConfirm({
      title: 'Quitar miembro',
      message: '¿Quitar a este miembro del grupo?',
      confirmLabel: 'Quitar',
      danger: true,
      run: async () => {
        await removeGroupMember(session.token, selectedGroupId, userId);
        await loadMembers(selectedGroupId);
        await reload();
      },
    });
  }

  return (
    <div className="dispatch-page cc-groups-page cc-cat-compact">
      <header className="dispatch-header cc-cat-compact-head">
        <div>
          <h1>Grupos y canales</h1>
          <p className="cc-page-sub">
            Canales PTT, membresía y administración del historial de chat.
          </p>
        </div>
        <p className="cc-units-summary">{groups.length} grupo(s)</p>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="cc-groups-forms">
        <form className="cc-groups-form" onSubmit={onCreate}>
          <h2>Nuevo grupo</h2>
          <label className="cc-groups-field">
            <span>Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="cc-groups-field">
            <span>Descripción</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="cc-groups-form-actions">
            <button type="submit" className="cc-btn primary">
              Crear grupo
            </button>
          </div>
        </form>

        <form className="cc-groups-form" onSubmit={onAssign}>
          <h2>Asignar miembro</h2>
          <label className="cc-groups-field">
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
          <label className="cc-groups-field">
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
          <label className="cc-groups-field">
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
          <div className="cc-groups-form-actions">
            <button type="submit" className="cc-btn primary">
              Asignar
            </button>
          </div>
        </form>
      </div>

      <div className="cc-groups-list-wrap">
        <ul className="cc-groups-list">
          {groups.map((g) => {
            const isOpen = selectedGroupId === g.id;
            return (
              <li key={g.id} className={`cc-group-card${isOpen ? ' is-selected' : ''}`}>
                <div className="cc-group-card-main">
                  <div className="cc-group-card-head">
                    <PersonAvatar
                      groupId={g.id}
                      avatarUrl={g.avatarUrl}
                      name={g.name}
                      token={session.token}
                      group
                      className="cc-group-avatar"
                    />
                    <strong>{g.name}</strong>
                    <span className={`status-pill ${g.is_active ? 'on' : 'off'}`}>
                      {g.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <code className="cc-group-room">{g.livekit_room}</code>
                  <span className="cc-group-meta">{g.member_count} miembro(s)</span>
                </div>
                <div className="cc-group-card-actions">
                  <button
                    type="button"
                    className={`cc-btn ghost cc-btn-sm${isOpen ? ' is-active' : ''}`}
                    aria-expanded={isOpen}
                    onClick={() => setSelectedGroupId(isOpen ? '' : g.id)}
                  >
                    Miembros
                  </button>
                  {canManage && g.is_active && (
                    <>
                      <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => purgeChat(g)}>
                        Vaciar
                      </button>
                      <button
                        type="button"
                        className="cc-btn ghost cc-btn-sm"
                        onClick={() => deactivateGroup(g)}
                      >
                        Desactivar
                      </button>
                    </>
                  )}
                  {canManage && !g.is_active && (
                    <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => reactivateGroup(g)}>
                      Reactivar
                    </button>
                  )}
                  {isRoot && (
                    <button type="button" className="cc-btn danger cc-btn-sm" onClick={() => hardDeleteGroup(g)}>
                      Eliminar
                    </button>
                  )}
                </div>
                {isOpen && (
                  <section className="members-panel cc-groups-members cc-groups-members--inline">
                    <h2>Miembros — {g.name || g.id}</h2>

                    {canManage && (
                      <div className="cc-group-avatar-edit">
                        <PersonAvatar
                          groupId={g.id}
                          avatarUrl={g.avatarUrl}
                          name={g.name}
                          token={session.token}
                          group
                          className="cc-group-avatar cc-group-avatar-lg"
                        />
                        <div className="cc-group-avatar-actions">
                          <p className="cc-hint">Imagen del canal (JPG, PNG o WebP, máx. 3 MB)</p>
                          <label className="cc-btn ghost cc-btn-sm">
                            {avatarBusy ? 'Subiendo…' : 'Cambiar imagen'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                              hidden
                              disabled={avatarBusy}
                              onChange={onAvatarFile}
                            />
                          </label>
                          {g.avatarUrl && (
                            <button
                              type="button"
                              className="cc-btn ghost cc-btn-sm"
                              disabled={avatarBusy}
                              onClick={onRemoveAvatar}
                            >
                              Quitar imagen
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {members.length === 0 ? (
                      <p className="cc-hint">Sin miembros en este canal.</p>
                    ) : (
                      <div className="cc-cat-chips">
                        {members.map((m) => (
                          <div key={m.id} className="cc-dep-org-chip cc-group-member-chip">
                            <span className="cc-cat-item-name">{m.displayName}</span>
                            <span className="cc-group-member-role">
                              {MEMBER_ROLES.find((r) => r.value === m.role)?.label || m.role}
                            </span>
                            {canManage && (
                              <button
                                type="button"
                                className="cc-cat-rm"
                                title="Quitar"
                                onClick={() => kickMember(m.id)}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        alertOnly={dialog?.alertOnly}
        busy={dialogBusy}
        onCancel={closeDialog}
        onConfirm={runDialogAction}
      />
    </div>
  );
}
