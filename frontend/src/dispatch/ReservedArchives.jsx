import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  createReservedArchive,
  downloadReservedArchive,
  fetchReservedArchives,
  saveReservedArchiveConfig,
} from '../api';

function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

function previousMonthValue() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Expediente mensual de RESERVADO. Copia; no borra los archivos que usa el teléfono.
 */
export default function ReservedArchives() {
  const ctx = useOutletContext() || {};
  const session = ctx.session;
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(previousMonthValue);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!session?.token) return;
      try {
        const data = await fetchReservedArchives(session.token);
        setInfo(data);
        if (!silent) setErr('');
      } catch (e) {
        if (!silent) setErr(e.message || 'No se pudo cargar el expediente');
      }
    },
    [session?.token]
  );

  useEffect(() => {
    void load({ silent: false });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load({ silent: true });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function runManual(body) {
    setBusy(true);
    setErr('');
    try {
      await createReservedArchive(session.token, body);
      await load({ silent: true });
    } catch (e) {
      setErr(e.message || 'No se pudo crear el respaldo');
      await load({ silent: true });
    } finally {
      setBusy(false);
    }
  }

  async function saveInterval(patch) {
    try {
      await saveReservedArchiveConfig(session.token, patch);
      await load({ silent: true });
    } catch (e) {
      setErr(e.message || 'No se guardó el intervalo');
    }
  }

  if (!session) return <p className="cc-hint">Sesión no disponible.</p>;

  const monthAlert = info?.month;
  const showFail = monthAlert?.status === 'falló';
  const cfg = info?.config || { intervalEnabled: true, intervalHours: 24 };

  return (
    <div className="cc-reserved-archives">
      {showFail ? (
        <p className="cc-error cc-reserved-archive-alert" role="alert">
          El cierre «{monthAlert.label || monthAlert.key}» falló
          {monthAlert.error ? `: ${monthAlert.error}` : ''}. No lo tomes como un mes guardado.
        </p>
      ) : null}
      {err ? <p className="cc-error">{err}</p> : null}

      <section className="cc-card cc-reserved-archive-tools">
        <div>
          <h2>Copia manual</h2>
          <p className="cc-hint">
            El día 1 se cierra solo el mes anterior. Esta copia no sustituye ese cierre y no borra
            los audios del servidor: el teléfono sigue abriendo el archivo original.
          </p>
        </div>
        <label>
          Mes
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <button
          type="button"
          className="cc-btn primary"
          disabled={busy || !month}
          onClick={() => void runManual({ month })}
        >
          {busy ? 'Respaldando…' : 'Respaldar ese mes'}
        </button>
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          type="button"
          className="cc-btn"
          disabled={busy || !from || !to}
          onClick={() => void runManual({ from, to })}
        >
          Respaldar rango
        </button>
      </section>

      <section className="cc-card cc-reserved-archive-tools">
        <div>
          <h2>Copia mientras el mes sigue abierto</h2>
          <p className="cc-hint">
            Cada cierto tiempo guarda lo que va del mes. No reemplaza el respaldo completo del mes.
          </p>
        </div>
        <label className="cc-reserved-archive-check">
          <input
            type="checkbox"
            checked={cfg.intervalEnabled !== false}
            onChange={(e) => void saveInterval({ intervalEnabled: e.target.checked, intervalHours: cfg.intervalHours })}
          />
          Activar
        </label>
        <label>
          Cada
          <select
            value={String(cfg.intervalHours || 24)}
            onChange={(e) =>
              void saveInterval({
                intervalEnabled: cfg.intervalEnabled !== false,
                intervalHours: Number(e.target.value),
              })
            }
          >
            <option value="6">6 horas</option>
            <option value="12">12 horas</option>
            <option value="24">24 horas</option>
          </select>
        </label>
        <p className="cc-hint">
          Última copia parcial: {fmtWhen(cfg.lastIntervalAt)}
        </p>
        {cfg.lastIntervalStatus === 'falló' ? (
          <p className="cc-error">
            La última copia parcial falló{cfg.lastIntervalError ? `: ${cfg.lastIntervalError}` : ''}. No cuenta como mes guardado.
          </p>
        ) : null}
      </section>

      <section className="cc-card">
        <header className="cc-reserved-conv-head">
          <h2>Expediente</h2>
          <span className="cc-hint">{info?.archives?.length || 0} archivo(s)</span>
        </header>
        {!info ? (
          <p className="cc-hint">Cargando…</p>
        ) : (info.archives || []).length === 0 ? (
          <p className="cc-hint">Todavía no hay respaldos. El cierre del mes anterior se intenta solo.</p>
        ) : (
          <ul className="cc-reserved-archive-list">
            {info.archives.map((a) => (
              <li key={a.id} className="cc-reserved-archive-row">
                <div>
                  <strong>{a.label}</strong>
                  <small>
                    {a.from} a {a.to}
                    {' · '}
                    {a.messages || 0} mensajes · {a.recordings || 0} PTT
                    {a.missingFiles ? ` · ${a.missingFiles} archivo(s) ya no estaban` : ''}
                    {a.status !== 'completo' && a.error ? ` · ${a.error}` : ''}
                    {' · '}
                    {fmtBytes(a.bytes)} · {fmtWhen(a.createdAt)}
                  </small>
                </div>
                <span className={`cc-reserved-archive-status is-${a.status === 'completo' ? 'ok' : 'bad'}`}>
                  {a.status === 'completo' ? 'completo' : 'falló'}
                </span>
                <button
                  type="button"
                  className="cc-btn"
                  disabled={a.status !== 'completo' || !a.file}
                  onClick={() =>
                    downloadReservedArchive(session.token, a.id, a.file).catch((e) =>
                      setErr(e.message || 'No se pudo descargar')
                    )
                  }
                >
                  Descargar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
