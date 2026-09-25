import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  fetchAdminUsers,
  fetchAdminUserGroups,
  fetchAuditDmConversations,
} from '../api';
import AuditConversationPeek from './AuditConversationPeek.jsx';

const POLL_MS = 12000;
const USERS_POLL_MS = 60000;

function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

function previewLastMessage(last) {
  if (!last) return '—';
  if (last.isDeleted) return 'Mensaje eliminado';
  if (last.type === 'image') return last.mediaName ? `Foto · ${last.mediaName}` : 'Foto';
  if (last.type === 'audio') return 'Audio';
  if (last.type === 'file') return last.mediaName ? `Archivo · ${last.mediaName}` : 'Archivo';
  if (last.type === 'sticker') return 'Sticker';
  if (last.type === 'nudge') return '¡Zumbido!';
  return last.body || '—';
}

/**
 * Pestaña Conversaciones en RESERVADO: ver hilos del operador (solo lectura).
 */
export default function ReservedChats() {
  const ctx = useOutletContext() || {};
  const session = ctx.session;

  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [subject, setSubject] = useState(null);
  const [dmThreads, setDmThreads] = useState([]);
  const [groupThreads, setGroupThreads] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [err, setErr] = useState('');
  const [peek, setPeek] = useState(null);

  const loadUsers = useCallback(
    async ({ silent = false } = {}) => {
      if (!session?.token) return;
      if (!silent) setLoadingUsers(true);
      try {
        const data = await fetchAdminUsers(session.token);
        const list = (data.users || []).slice().sort((a, b) =>
          String(a.displayName || a.username || '').localeCompare(
            String(b.displayName || b.username || ''),
            'es'
          )
        );
        setUsers(list);
        setErr('');
      } catch (e) {
        if (!silent) setErr(e.message || 'No se pudo cargar usuarios');
      } finally {
        if (!silent) setLoadingUsers(false);
      }
    },
    [session?.token]
  );

  const loadThreads = useCallback(
    async ({ silent = false } = {}) => {
      if (!session?.token || !userId) {
        setDmThreads([]);
        setGroupThreads([]);
        return;
      }
      if (!silent) setLoadingThreads(true);
      try {
        const [dmData, groupsData] = await Promise.all([
          fetchAuditDmConversations(session.token, userId),
          fetchAdminUserGroups(session.token, userId),
        ]);
        setDmThreads(dmData.conversations || []);
        setGroupThreads(groupsData.groups || []);
        setErr('');
      } catch (e) {
        if (!silent) {
          setErr(e.message || 'No se pudieron cargar conversaciones');
          setDmThreads([]);
          setGroupThreads([]);
        }
      } finally {
        if (!silent) setLoadingThreads(false);
      }
    },
    [session?.token, userId]
  );

  useEffect(() => {
    void loadUsers({ silent: false });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void loadUsers({ silent: true });
    }, USERS_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadUsers({ silent: true });
    };
    const onRefresh = () => void loadUsers({ silent: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('tacticalptx:module-refresh', onRefresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('tacticalptx:module-refresh', onRefresh);
    };
  }, [loadUsers]);

  useEffect(() => {
    void loadThreads({ silent: false });
    if (!userId) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void loadThreads({ silent: true });
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadThreads({ silent: true });
    };
    const onRefresh = () => void loadThreads({ silent: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('tacticalptx:module-refresh', onRefresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('tacticalptx:module-refresh', onRefresh);
    };
  }, [loadThreads, userId]);

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        label: `${u.displayName || u.username || 'Usuario'}${
          u.username ? ` (@${u.username})` : ''
        }`,
      })),
    [users]
  );

  if (!session) {
    return <p className="cc-hint">Sesión no disponible.</p>;
  }

  return (
    <div className="cc-reserved-conversations">
      <section className="cc-card cc-reserved-conv-filters">
        <label>
          Operador
          <select
            value={userId}
            disabled={loadingUsers}
            onChange={(e) => {
              const id = e.target.value;
              setUserId(id);
              if (!id) {
                setSubject(null);
                return;
              }
              const picked = users.find((u) => String(u.id) === String(id));
              setSubject(
                picked
                  ? { id: picked.id, displayName: picked.displayName || picked.username }
                  : { id, displayName: 'Operador' }
              );
            }}
          >
            <option value="">Selecciona un operador…</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {err ? <p className="cc-error">{err}</p> : null}

      {!userId ? (
        <p className="cc-hint">Selecciona un operador para ver sus conversaciones (solo lectura).</p>
      ) : loadingThreads && !dmThreads.length && !groupThreads.length ? (
        <p className="cc-hint">Cargando conversaciones…</p>
      ) : (
        <div className="cc-reserved-conv-grid">
          <section className="cc-card cc-reserved-conv-panel">
            <header className="cc-reserved-conv-head">
              <h2>Chats directos</h2>
              <span className="cc-hint">{dmThreads.length} hilo(s)</span>
            </header>
            {dmThreads.length === 0 ? (
              <p className="cc-hint">Sin chats directos registrados.</p>
            ) : (
              <ul className="cc-reserved-conv-list">
                {dmThreads.map((t) => (
                  <li key={t.peerId}>
                    <button
                      type="button"
                      className="cc-reserved-conv-row"
                      onClick={() =>
                        setPeek({
                          peerId: t.peerId,
                          peerName: t.peerName,
                          messageId: t.lastMessage?.id || null,
                        })
                      }
                    >
                      <span className="cc-reserved-conv-title">
                        {t.peerName || t.peerUsername || 'Usuario'}
                        {!t.peerActive ? (
                          <span className="cc-reserved-conv-inactive"> · inactivo</span>
                        ) : null}
                      </span>
                      <span className="cc-reserved-conv-preview">
                        {previewLastMessage(t.lastMessage)}
                      </span>
                      <time className="cc-reserved-conv-time" dateTime={t.lastMessage?.createdAt}>
                        {fmtWhen(t.lastMessage?.createdAt)}
                      </time>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cc-card cc-reserved-conv-panel">
            <header className="cc-reserved-conv-head">
              <h2>Grupos y canales</h2>
              <span className="cc-hint">{groupThreads.length} grupo(s)</span>
            </header>
            {groupThreads.length === 0 ? (
              <p className="cc-hint">Sin grupos asignados.</p>
            ) : (
              <ul className="cc-reserved-conv-list">
                {groupThreads.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="cc-reserved-conv-row"
                      onClick={() =>
                        setPeek({
                          groupId: g.id,
                          groupName: g.name,
                        })
                      }
                    >
                      <span className="cc-reserved-conv-title">{g.name || 'Grupo'}</span>
                      <span className="cc-reserved-conv-preview cc-hint">
                        Ver historial del canal · solo lectura
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <AuditConversationPeek
        session={session}
        subjectUserId={userId}
        subjectName={subject?.displayName}
        open={peek}
        onClose={() => setPeek(null)}
      />
    </div>
  );
}
