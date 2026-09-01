import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAdminActivity } from '../api';

const ACTION_LABELS = {
  'auth.login': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'auth.change_password': 'Cambio de contraseña',
  'user.create': 'Alta de usuario',
  'user.update': 'Edición de usuario',
  'user.delete': 'Baja de usuario',
  'user.avatar': 'Avatar de usuario',
  'user.export_csv': 'Exportación CSV de usuarios',
  'group.create': 'Alta de grupo',
  'group.update': 'Edición de grupo',
  'group.delete': 'Baja de grupo',
  'group.delete_hard': 'Eliminación definitiva de grupo',
  'group.member_add': 'Miembro añadido a grupo',
  'group.member_remove': 'Miembro quitado de grupo',
  'panic.trigger': 'Alerta de pánico',
  'geofence.create': 'Alta de geocerca',
  'geofence.update': 'Edición de geocerca',
  'geofence.delete': 'Baja de geocerca',
  'security.lockdown': 'Bloqueo de seguridad',
  'backup.run': 'Respaldo ejecutado',
  'backup.restore': 'Restauración de respaldo',
};

function labelAction(action) {
  if (!action) return '—';
  return ACTION_LABELS[action] || action;
}

function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return String(iso);
  }
}

function actorLabel(actor) {
  if (!actor) return 'Sistema / desconocido';
  return (
    actor.displayName ||
    actor.username ||
    actor.email ||
    'Usuario'
  );
}

function metaFull(meta) {
  if (meta == null) return '';
  try {
    const obj = typeof meta === 'string' ? JSON.parse(meta) : meta;
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(meta);
  }
}

function metaPreview(meta) {
  if (meta == null) return '—';
  try {
    const obj = typeof meta === 'string' ? JSON.parse(meta) : meta;
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const parts = Object.entries(obj).map(([k, v]) => {
        const val =
          v == null
            ? 'null'
            : typeof v === 'object'
              ? JSON.stringify(v)
              : String(v);
        return `${k}=${val}`;
      });
      const s = parts.join(' · ');
      return s.length > 280 ? `${s.slice(0, 277)}…` : s;
    }
    const s = JSON.stringify(obj);
    return s.length > 280 ? `${s.slice(0, 277)}…` : s;
  } catch {
    return String(meta).slice(0, 280);
  }
}

const PAGE = 100;

export default function ConfigAudit({ session }) {
  const [rows, setRows] = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminActivity(session.token, {
        limit: PAGE,
        offset,
        action,
        q,
      });
      setRows(res.activity || []);
      setActions(res.actions || []);
      setTotal(Number(res.total) || 0);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar el historial');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [session.token, offset, action, q]);

  useEffect(() => {
    load();
  }, [load]);

  const pageLabel = useMemo(() => {
    if (!total) return '0 eventos';
    const from = offset + 1;
    const to = Math.min(offset + rows.length, total);
    return `${from}–${to} de ${total}`;
  }, [offset, rows.length, total]);

  function applySearch(e) {
    e?.preventDefault?.();
    setOffset(0);
    setQ(qDraft.trim());
  }

  function onActionChange(value) {
    setOffset(0);
    setAction(value);
  }

  return (
    <div className="cc-audit">
      <header className="cc-backups-head">
        <div>
          <h1>Historial / Auditoría</h1>
          <p className="cc-hint">
            Quién hizo qué y cuándo en esta organización (inicios de sesión, usuarios, grupos,
            pánico, etc.). Solo visible para administradores.
          </p>
        </div>
        <button type="button" className="cc-btn" disabled={loading} onClick={() => load()}>
          Actualizar
        </button>
      </header>

      <section className="cc-card cc-audit-filters">
        <form className="cc-audit-form" onSubmit={applySearch}>
          <label>
            Buscar
            <input
              type="search"
              value={qDraft}
              placeholder="Nombre, usuario, acción, detalle…"
              onChange={(e) => setQDraft(e.target.value)}
            />
          </label>
          <label>
            Acción
            <select value={action} onChange={(e) => onActionChange(e.target.value)}>
              <option value="">Todas</option>
              {actions.map((a) => (
                <option key={a.action} value={a.action}>
                  {labelAction(a.action)} ({a.count})
                </option>
              ))}
            </select>
          </label>
          <div className="cc-audit-form-actions">
            <button type="submit" className="cc-btn" disabled={loading}>
              Filtrar
            </button>
            {(q || action) && (
              <button
                type="button"
                className="cc-btn ghost"
                disabled={loading}
                onClick={() => {
                  setQDraft('');
                  setQ('');
                  setAction('');
                  setOffset(0);
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </form>
        <p className="cc-hint cc-audit-page">{pageLabel}</p>
      </section>

      {err ? <p className="cc-error">{err}</p> : null}
      {loading && !rows.length ? <p className="cc-hint">Cargando historial…</p> : null}

      <div className="cc-table-wrap cc-audit-table-wrap">
        <table className="cc-table cc-audit-table">
          <colgroup>
            <col className="cc-audit-col-when" />
            <col className="cc-audit-col-who" />
            <col className="cc-audit-col-what" />
            <col className="cc-audit-col-entity" />
            <col className="cc-audit-col-meta" />
          </colgroup>
          <thead>
            <tr>
              <th>Cuándo</th>
              <th>Quién</th>
              <th>Qué</th>
              <th>Entidad</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="cc-hint">
                  No hay eventos con estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="cc-audit-when">{fmtWhen(row.createdAt)}</td>
                  <td>
                    <div className="cc-audit-who">{actorLabel(row.actor)}</div>
                    {row.actor?.email || row.actor?.username ? (
                      <div className="cc-hint cc-audit-sub">
                        {row.actor.username || row.actor.email}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div>{labelAction(row.action)}</div>
                    <div className="cc-hint cc-audit-sub">{row.action}</div>
                  </td>
                  <td>
                    {row.entityType || '—'}
                    {row.entityId ? (
                      <div className="cc-hint cc-audit-sub" title={row.entityId}>
                        {String(row.entityId).slice(0, 8)}…
                      </div>
                    ) : null}
                  </td>
                  <td className="cc-audit-meta" title={metaFull(row.meta)}>
                    {metaPreview(row.meta)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="cc-audit-pager">
        <button
          type="button"
          className="cc-btn ghost"
          disabled={loading || offset <= 0}
          onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
        >
          ← Anterior
        </button>
        <button
          type="button"
          className="cc-btn ghost"
          disabled={loading || offset + PAGE >= total}
          onClick={() => setOffset((o) => o + PAGE)}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
