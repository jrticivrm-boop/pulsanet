import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAnnouncement,
  fetchAdminGroups,
  fetchAdminUsers,
  fetchAnnouncements,
  fetchDependencias,
  isRootUser,
} from '../api';
import { canModuleAction, canViewModule } from './modulePermissions.js';

function flattenTree(nodes, acc = [], depth = 0) {
  for (const n of nodes || []) {
    acc.push({
      id: n.id,
      name: n.name,
      kind: n.kind,
      depth,
    });
    if (n.children?.length) flattenTree(n.children, acc, depth + 1);
  }
  return acc;
}

function userLabel(u) {
  const name = u.displayName || u.display_name || u.username || 'Usuario';
  const grade = u.grade || u.grado || '';
  return grade ? `${grade} ${name}` : name;
}

export default function DispatchAnnouncements({ session }) {
  const [list, setList] = useState([]);
  const [tree, setTree] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('org');
  const [selectedIds, setSelectedIds] = useState([]);
  const [pickFilter, setPickFilter] = useState('');
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const isRoot = isRootUser(session.user);
  const canViewAvisos = canViewModule(session.user, 'avisos');
  const canSendAvisos = canModuleAction(session.user, 'avisos', 'agregar');

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const zones = useMemo(() => flat.filter((n) => n.kind === 'zone'), [flat]);
  const units = useMemo(() => flat.filter((n) => n.kind === 'unit'), [flat]);

  const reload = useCallback(async () => {
    try {
      const [a, d, u, g] = await Promise.all([
        fetchAnnouncements(session.token),
        fetchDependencias(session.token),
        fetchAdminUsers(session.token),
        fetchAdminGroups(session.token),
      ]);
      setList(a.announcements || []);
      setTree(d.tree || d.regions || d.dependencias || []);
      setUsers((u.users || []).filter((x) => x.isActive !== false && x.is_active !== false));
      setGroups((g.groups || []).filter((x) => x.is_active !== false && x.isActive !== false));
    } catch (err) {
      setError(err.message);
    }
  }, [session.token]);

  useEffect(() => {
    reload();
  }, [reload]);

  function toggleId(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function setAudienceMode(next) {
    setAudience(next);
    setSelectedIds([]);
    setPickFilter('');
    if (next === 'admins') setIncludeAdmins(false);
  }

  async function onSend(e) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const data = await createAnnouncement(session.token, {
        body,
        audience,
        scopeUnitIds: audience === 'zone' || audience === 'unit' ? selectedIds : [],
        targetIds: audience === 'users' || audience === 'groups' ? selectedIds : [],
        includeAdmins:
          audience === 'admins' || audience === 'users' || audience === 'groups'
            ? false
            : includeAdmins,
      });
      setBody('');
      setSelectedIds([]);
      setPickFilter('');
      setOkMsg(
        `Aviso enviado a ${data.recipientCount} destinatario${data.recipientCount === 1 ? '' : 's'}.`
      );
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const q = pickFilter.trim().toLowerCase();

  const pickOrgList = audience === 'zone' ? zones : audience === 'unit' ? units : [];

  const pickUsers = useMemo(() => {
    if (audience !== 'users') return [];
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${userLabel(u)} ${u.username || ''} ${u.matricula || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [audience, users, q]);

  const pickGroups = useMemo(() => {
    if (audience !== 'groups') return [];
    if (!q) return groups;
    return groups.filter((g) => {
      const hay = `${g.name || ''} ${g.scopeLabel || ''} ${g.unitName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [audience, groups, q]);

  const needsSelection =
    audience === 'zone' ||
    audience === 'unit' ||
    audience === 'users' ||
    audience === 'groups';
  const canSend = Boolean(body.trim()) && (!needsSelection || selectedIds.length > 0);

  return (
    <div className="cc-announcements-page">
      {canSendAvisos ? (
      <section className="cc-announcements-compose">
        <h2>Nuevo aviso</h2>
        <p className="cc-hint">
          Se muestra como aviso crítico (warning) en web y app. No entra en Chats. El destinatario
          debe pulsar <strong>Enterado</strong>. Alcance según tu jerarquía
          {isRoot ? ' (Administrador: toda la organización)' : ''}.
        </p>
        <form className="cc-announcements-form" onSubmit={onSend}>
          <label className="cc-announcements-field">
            <span>Mensaje</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              required
              placeholder="Texto nítido del aviso…"
            />
          </label>
          <fieldset className="cc-announcements-audience">
            <legend>Destinatarios</legend>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'org'}
                onChange={() => setAudienceMode('org')}
              />
              Todos mis subordinados
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'zone'}
                onChange={() => setAudienceMode('zone')}
              />
              Zona(s)
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'unit'}
                onChange={() => setAudienceMode('unit')}
              />
              Unidad(es) / servicios
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'users'}
                onChange={() => setAudienceMode('users')}
              />
              Usuario(s) específico(s)
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'groups'}
                onChange={() => setAudienceMode('groups')}
              />
              Canal(es) / grupo(s)
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'admins'}
                onChange={() => setAudienceMode('admins')}
              />
              Solo administradores (de mi alcance)
            </label>
          </fieldset>

          {pickOrgList.length > 0 && (
            <div className="cc-announcements-pick">
              <span>Selecciona {audience === 'zone' ? 'zonas' : 'unidades'}</span>
              <ul>
                {pickOrgList.map((n) => (
                  <li key={n.id} style={{ paddingLeft: `${n.depth * 0.75}rem` }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(n.id)}
                        onChange={() => toggleId(n.id)}
                      />
                      {n.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {audience === 'users' && (
            <div className="cc-announcements-pick">
              <span>
                Selecciona usuarios
                {selectedIds.length ? ` (${selectedIds.length})` : ''}
              </span>
              <input
                type="search"
                className="cc-announcements-filter"
                value={pickFilter}
                onChange={(e) => setPickFilter(e.target.value)}
                placeholder="Buscar por nombre, usuario o matrícula…"
              />
              <ul>
                {pickUsers.length === 0 ? (
                  <li className="cc-hint">Sin coincidencias en tu alcance.</li>
                ) : (
                  pickUsers.map((u) => (
                    <li key={u.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleId(u.id)}
                        />
                        <span>
                          {userLabel(u)}
                          {u.username ? (
                            <em className="cc-announcements-sub"> · {u.username}</em>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {audience === 'groups' && (
            <div className="cc-announcements-pick">
              <span>
                Selecciona canales / grupos
                {selectedIds.length ? ` (${selectedIds.length})` : ''}
              </span>
              <input
                type="search"
                className="cc-announcements-filter"
                value={pickFilter}
                onChange={(e) => setPickFilter(e.target.value)}
                placeholder="Buscar canal…"
              />
              <ul>
                {pickGroups.length === 0 ? (
                  <li className="cc-hint">Sin canales en tu alcance.</li>
                ) : (
                  pickGroups.map((g) => (
                    <li key={g.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(g.id)}
                          onChange={() => toggleId(g.id)}
                        />
                        <span>
                          {g.name}
                          <em className="cc-announcements-sub">
                            {' '}
                            · {g.member_count ?? g.memberCount ?? 0} miembros
                            {g.scopeLabel ? ` · ${g.scopeLabel}` : ''}
                          </em>
                        </span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {audience !== 'admins' && audience !== 'users' && audience !== 'groups' && (
            <label className="cc-announcements-admins">
              <input
                type="checkbox"
                checked={includeAdmins}
                onChange={(e) => setIncludeAdmins(e.target.checked)}
              />
              Incluir también administradores del alcance
            </label>
          )}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {okMsg ? (
            <p className="cc-hint" role="status">
              {okMsg}
            </p>
          ) : null}
          <button type="submit" className="cc-btn primary" disabled={busy || !canSend}>
            {busy ? 'Enviando…' : 'Enviar aviso'}
          </button>
        </form>
      </section>
      ) : (
        <p className="cc-hint">No tienes permiso para enviar avisos.</p>
      )}

      {canViewAvisos ? (
      <section className="cc-announcements-history">
        <h2>Enviados recientemente</h2>
        {!list.length ? (
          <p className="cc-hint">Aún no hay avisos.</p>
        ) : (
          <ul className="cc-announcements-list">
            {list.map((a) => (
              <li key={a.id}>
                <div className="cc-announcements-meta">
                  <strong>{a.audienceLabel}</strong>
                  <span>
                    {a.createdByName} ·{' '}
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : ''}
                  </span>
                  <span>{a.ackCount} Enterado</span>
                </div>
                <p>{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}
    </div>
  );
}
