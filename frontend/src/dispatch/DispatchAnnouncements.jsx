import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAnnouncement,
  fetchAnnouncements,
  fetchDependencias,
  isRootUser,
} from '../api';

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

export default function DispatchAnnouncements({ session }) {
  const [list, setList] = useState([]);
  const [tree, setTree] = useState([]);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('org');
  const [selectedIds, setSelectedIds] = useState([]);
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const isRoot = isRootUser(session.user);

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const zones = useMemo(() => flat.filter((n) => n.kind === 'zone'), [flat]);
  const units = useMemo(() => flat.filter((n) => n.kind === 'unit'), [flat]);

  const reload = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        fetchAnnouncements(session.token),
        fetchDependencias(session.token),
      ]);
      setList(a.announcements || []);
      setTree(d.tree || d.regions || d.dependencias || []);
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
        includeAdmins: audience === 'admins' ? false : includeAdmins,
      });
      setBody('');
      setSelectedIds([]);
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

  const pickList = audience === 'zone' ? zones : audience === 'unit' ? units : [];

  return (
    <div className="cc-announcements-page">
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
                onChange={() => {
                  setAudience('org');
                  setSelectedIds([]);
                }}
              />
              Todos mis subordinados
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'zone'}
                onChange={() => {
                  setAudience('zone');
                  setSelectedIds([]);
                }}
              />
              Zona(s)
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'unit'}
                onChange={() => {
                  setAudience('unit');
                  setSelectedIds([]);
                }}
              />
              Unidad(es) / servicios
            </label>
            <label>
              <input
                type="radio"
                name="aud"
                checked={audience === 'admins'}
                onChange={() => {
                  setAudience('admins');
                  setSelectedIds([]);
                  setIncludeAdmins(false);
                }}
              />
              Solo administradores (de mi alcance)
            </label>
          </fieldset>
          {pickList.length > 0 && (
            <div className="cc-announcements-pick">
              <span>Selecciona {audience === 'zone' ? 'zonas' : 'unidades'}</span>
              <ul>
                {pickList.map((n) => (
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
          {audience !== 'admins' && (
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
          <button type="submit" className="cc-btn primary" disabled={busy || !body.trim()}>
            {busy ? 'Enviando…' : 'Enviar aviso'}
          </button>
        </form>
      </section>

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
    </div>
  );
}
