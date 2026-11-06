import { useEffect, useMemo, useState } from 'react';
import { fetchAdminGroups, fetchAdminUsers } from '../api';
import ReservedPick from './ReservedPick.jsx';

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
      <ReservedPick
        label="¿De quién?"
        title="Operador que envió el mensaje, la nota o el PTT"
        placeholder="Operador…"
        value={value.userId}
        options={userOptions.map((u) => ({
          id: u.id,
          label: `${u.displayName || u.username}${u.username ? ` (@${u.username})` : ''}`,
        }))}
        onChange={pickUser}
      />
      {hasSpeaker ? (
        <label>
          ¿Con quién?
          <select
            value={value.withKind}
            onChange={(e) => pickKind(e.target.value)}
            title="Otro operador, o un grupo o canal"
          >
            <option value="">Elige…</option>
            <option value="operador">Otro operador</option>
            <option value="grupo">Grupo o canal</option>
          </select>
        </label>
      ) : null}
      {hasSpeaker && hasKind && value.withKind === 'grupo' ? (
        <ReservedPick
          label="Grupo"
          title="Grupo o canal de esa persona"
          placeholder="Grupo…"
          value={value.groupId}
          options={groups.map((g) => ({ id: g.id, label: g.name || 'Grupo' }))}
          onChange={pickGroup}
        />
      ) : null}
      {hasSpeaker && hasKind && value.withKind === 'operador' ? (
        <ReservedPick
          label="Operador"
          title="La otra persona del chat"
          placeholder="Operador…"
          value={value.peerId}
          options={peers.map((u) => ({
            id: u.id,
            label: u.displayName || u.username || 'Operador',
          }))}
          onChange={pickPeer}
        />
      ) : null}
      {hasSpeaker && hasKind && hasTarget ? (
        <label>
          Periodo
          <select
            value={value.period}
            onChange={(e) => pickPeriod(e.target.value)}
            title="Hoy, el mes en curso, o un rango de fechas"
          >
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
              title="Primer día del periodo"
              onChange={(e) => patch({ from: e.target.value })}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={value.to}
              title="Último día del periodo"
              onChange={(e) => patch({ to: e.target.value })}
            />
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
