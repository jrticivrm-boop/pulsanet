import { useEffect, useMemo, useState } from 'react';
import { fetchAdminGroups, fetchAdminUsers } from '../api';

function iso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function defaultWhoFilter() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    userId: '',
    userName: '',
    withKind: '',
    peerId: '',
    peerName: '',
    groupId: '',
    groupName: '',
    period: 'mes',
    from: iso(start),
    to: iso(end),
  };
}

export function whoFilterReady(filter) {
  if (!filter?.userId || !filter.from || !filter.to || filter.from > filter.to) return false;
  if (filter.withKind === 'grupo') return Boolean(filter.groupId);
  if (filter.withKind === 'operador') {
    return Boolean(filter.peerId) && filter.peerId !== filter.userId;
  }
  return false;
}

function rangeFor(period, current) {
  const now = new Date();
  if (period === 'hoy') {
    const day = iso(now);
    return { from: day, to: day };
  }
  if (period === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: iso(start), to: iso(end) };
  }
  return { from: current.from, to: current.to };
}

/**
 * Barra ¿De quién? / ¿Con quién? / periodo. No consulta hasta que el padre vea whoFilterReady.
 */
export default function ReservedWhoBar({ token, value, onChange }) {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, g] = await Promise.all([fetchAdminUsers(token), fetchAdminGroups(token)]);
        if (cancelled) return;
        setUsers(u.users || []);
        setGroups(g.groups || []);
        setErr('');
      } catch (e) {
        if (!cancelled) setErr(e.message || 'No se pudieron cargar operadores');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const userOptions = useMemo(
    () =>
      users
        .slice()
        .sort((a, b) =>
          String(a.displayName || a.username || '').localeCompare(
            String(b.displayName || b.username || ''),
            'es'
          )
        ),
    [users]
  );

  const peers = userOptions.filter((u) => String(u.id) !== String(value.userId));

  function patch(partial) {
    onChange({ ...value, ...partial });
  }

  function pickUser(id) {
    const picked = userOptions.find((u) => String(u.id) === String(id));
    patch({
      userId: id,
      userName: picked?.displayName || picked?.username || '',
      withKind: '',
      peerId: '',
      peerName: '',
      groupId: '',
      groupName: '',
    });
  }

  function pickPeer(id) {
    const picked = peers.find((u) => String(u.id) === String(id));
    patch({
      peerId: id,
      peerName: picked?.displayName || picked?.username || '',
    });
  }

  function pickGroup(id) {
    const picked = groups.find((g) => String(g.id) === String(id));
    patch({ groupId: id, groupName: picked?.name || '' });
  }

  function pickKind(kind) {
    patch({
      withKind: kind,
      peerId: '',
      peerName: '',
      groupId: '',
      groupName: '',
    });
  }

  function pickPeriod(period) {
    patch({ period, ...rangeFor(period, value) });
  }

  const hasSpeaker = Boolean(value.userId);
  const hasKind = value.withKind === 'operador' || value.withKind === 'grupo';
  const hasTarget =
    value.withKind === 'grupo' ? Boolean(value.groupId) : Boolean(value.peerId);

  return (
    <section className="cc-card cc-reserved-who" aria-label="Filtro de consulta">
      <label>
        ¿De quién?
        <select value={value.userId} onChange={(e) => pickUser(e.target.value)} title={value.userName || undefined}>
          <option value="">Operador…</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName || u.username}
              {u.username ? ` (@${u.username})` : ''}
            </option>
          ))}
        </select>
      </label>
      {hasSpeaker ? (
        <label>
          ¿Con quién?
          <select value={value.withKind} onChange={(e) => pickKind(e.target.value)}>
            <option value="">Elige…</option>
            <option value="operador">Otro operador</option>
            <option value="grupo">Grupo o canal</option>
          </select>
        </label>
      ) : null}
      {hasSpeaker && hasKind && value.withKind === 'grupo' ? (
        <label>
          Grupo
          <select value={value.groupId} onChange={(e) => pickGroup(e.target.value)} title={value.groupName || undefined}>
            <option value="">Grupo…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || 'Grupo'}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {hasSpeaker && hasKind && value.withKind === 'operador' ? (
        <label>
          Operador
          <select value={value.peerId} onChange={(e) => pickPeer(e.target.value)} title={value.peerName || undefined}>
            <option value="">Operador…</option>
            {peers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName || u.username}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {hasSpeaker && hasKind && hasTarget ? (
        <label>
          Periodo
          <select value={value.period} onChange={(e) => pickPeriod(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="mes">Mes en curso</option>
            <option value="rango">Rango</option>
          </select>
        </label>
      ) : null}
      {hasSpeaker && hasKind && hasTarget && value.period === 'rango' ? (
        <>
          <label>
            Desde
            <input
              type="date"
              value={value.from}
              onChange={(e) => patch({ from: e.target.value })}
            />
          </label>
          <label>
            Hasta
            <input type="date" value={value.to} onChange={(e) => patch({ to: e.target.value })} />
          </label>
        </>
      ) : null}
      {hasTarget && value.period === 'rango' && value.from && value.to && value.from > value.to ? (
        <p className="cc-error">La fecha desde no puede ser posterior a hasta.</p>
      ) : null}
      {err ? <p className="cc-error">{err}</p> : null}
    </section>
  );
}
