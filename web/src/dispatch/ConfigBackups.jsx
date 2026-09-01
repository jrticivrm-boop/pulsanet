import { useCallback, useEffect, useState } from 'react';
import {
  fetchBackups,
  saveBackupConfig,
  runBackupNow,
  deleteBackupFile,
  restoreBackupFile,
  restoreBackupUpload,
  downloadBackupFile,
} from '../api';
import AppDialog from '../AppDialog.jsx';

function fmtFecha(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX');
  } catch {
    return iso;
  }
}

export default function ConfigBackups({ session }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saveInfo, setSaveInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(24);
  const [retentionCount, setRetentionCount] = useState(14);
  const [uploadFile, setUploadFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBackups(session.token);
      setData(res);
      const cfg = res.config || {};
      setEnabled(Boolean(cfg.enabled));
      setIntervalHours(Number(cfg.intervalHours) || 24);
      setRetentionCount(Number(cfg.retentionCount) || 14);
      setDirty(false);
      setSaveInfo('');
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar respaldos');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSaveCfg() {
    setBusy(true);
    try {
      await saveBackupConfig(session.token, { enabled, intervalHours, retentionCount });
      setDirty(false);
      setSaveInfo('Programación guardada.');
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function onManual() {
    setBusy(true);
    try {
      const res = await runBackupNow(session.token);
      setDialog({
        title: 'Respaldo creado',
        message: `${res.filename} (${res.sizeLabel})`,
        alertOnly: true,
      });
      await load();
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function confirmRestore(run) {
    setDialog({
      title: '¿Restaurar la base de datos?',
      message:
        'Los datos actuales (usuarios, canales, chat, GPS, etc.) se reemplazarán. Se creará un respaldo de seguridad antes.',
      danger: true,
      confirmLabel: 'Continuar',
      onConfirm: () => {
        setDialog({
          title: 'Confirmar restauración',
          message: 'Escriba RESTAURAR (mayúsculas) para confirmar.',
          promptDefault: '',
          promptPlaceholder: 'RESTAURAR',
          promptLabel: 'Confirmación',
          danger: true,
          confirmLabel: 'Restaurar',
          onConfirm: (typed) => {
            if (String(typed || '').trim() !== 'RESTAURAR') {
              setDialog({ title: 'Cancelado', message: 'Restauración cancelada.', alertOnly: true });
              return;
            }
            setDialog(null);
            run();
          },
        });
      },
    });
  }

  async function doRestoreNamed(filename) {
    setBusy(true);
    try {
      const res = await restoreBackupFile(session.token, filename);
      setDialog({
        title: 'Restaurado',
        message: `${res.message || 'OK'}${res.safetyFile ? ` · Seguridad: ${res.safetyFile}` : ''}`,
        alertOnly: true,
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function doRestoreUpload() {
    if (!uploadFile) {
      setDialog({ title: 'Archivo', message: 'Seleccione un .zip o .sql', alertOnly: true });
      return;
    }
    setBusy(true);
    try {
      const res = await restoreBackupUpload(session.token, uploadFile);
      setDialog({
        title: 'Restaurado',
        message: `${res.message || 'OK'}${res.safetyFile ? ` · Seguridad: ${res.safetyFile}` : ''}`,
        alertOnly: true,
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setDialog({ title: 'Error', message: e.message, alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(filename) {
    setDialog({
      title: 'Eliminar respaldo',
      message: `Se eliminará ${filename}.`,
      danger: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteBackupFile(session.token, filename);
          setDialog(null);
          await load();
        } catch (e) {
          setDialog({ title: 'Error', message: e.message, alertOnly: true });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  if (loading) return <p className="cc-hint">Cargando respaldos…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  const cfg = data?.config || {};
  const backups = data?.backups || [];
  const dirPath = data?.backupDirRelative || 'data/backups';

  return (
    <div className="cc-backups">
      <header className="cc-backups-head">
        <div>
          <h1>Respaldos</h1>
          <p className="cc-hint">
            Copia de <strong>datos</strong> (usuarios, canales, chat, ubicaciones, geocercas, pánico,
            organigrama, etc.). El archivo <code>.zip</code> incluye <code>database.sql</code> y{' '}
            <code>meta.json</code>. Se guarda en <code>{dirPath}</code>.
          </p>
        </div>
        <button type="button" className="cc-btn" disabled={busy} onClick={onManual}>
          Respaldo manual ahora
        </button>
      </header>

      <section className="cc-card">
        <h2>Programación automática</h2>
        <div className="cc-backups-form">
          <label className="cc-backups-check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setDirty(true);
                setSaveInfo('Tiene cambios sin guardar.');
              }}
            />
            <span>
              Respaldos automáticos
              <br />
              {enabled ? 'activos' : 'inactivos'}
            </span>
          </label>
          <label>
            Cada cuántas horas
            <select
              value={intervalHours}
              onChange={(e) => {
                setIntervalHours(Number(e.target.value));
                setDirty(true);
                setSaveInfo('Tiene cambios sin guardar.');
              }}
            >
              <option value={6}>Cada 6 horas</option>
              <option value={12}>Cada 12 horas</option>
              <option value={24}>Cada 24 horas (diario)</option>
              <option value={48}>Cada 48 horas</option>
              <option value={168}>Cada 7 días</option>
            </select>
          </label>
          <label>
            Conservar últimos archivos
            <select
              value={retentionCount}
              onChange={(e) => {
                setRetentionCount(Number(e.target.value));
                setDirty(true);
                setSaveInfo('Tiene cambios sin guardar.');
              }}
            >
              {[7, 14, 21, 30, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {n} respaldos
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="cc-backups-save-row">
          <button type="button" className="cc-btn" disabled={busy || !dirty} onClick={onSaveCfg}>
            Guardar programación
          </button>
          <span className={dirty ? 'cc-warn' : 'cc-hint'}>{saveInfo}</span>
        </div>
        <div className="cc-backups-last">
          <strong>Último respaldo:</strong> {cfg.lastRunAt ? fmtFecha(cfg.lastRunAt) : 'Nunca'}
          {' · '}Estado:{' '}
          <span
            className={
              cfg.lastStatus === 'ok'
                ? 'cc-ok'
                : cfg.lastStatus === 'error'
                  ? 'cc-error'
                  : 'cc-hint'
            }
          >
            {cfg.lastStatus === 'ok'
              ? 'Correcto'
              : cfg.lastStatus === 'error'
                ? 'Error'
                : cfg.lastStatus || '—'}
          </span>
          {cfg.lastFile ? (
            <>
              {' · '}Archivo: <code>{cfg.lastFile}</code>
            </>
          ) : null}
          {cfg.lastError ? (
            <>
              <br />
              <span className="cc-error">{cfg.lastError}</span>
            </>
          ) : null}
        </div>
      </section>

      <section className="cc-card">
        <h2>Historial ({backups.length})</h2>
        {backups.length === 0 ? (
          <p className="cc-hint">No hay respaldos. Use «Respaldo manual ahora».</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Contenido</th>
                  <th>Tamaño</th>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename}>
                    <td>
                      <code title={b.filename}>{b.filename}</code>
                    </td>
                    <td>{b.format === 'zip' ? 'BD + meta' : 'Solo BD (legado)'}</td>
                    <td>{b.sizeLabel}</td>
                    <td>{fmtFecha(b.createdAt)}</td>
                    <td>{b.manual ? 'Manual' : 'Automático'}</td>
                    <td className="cc-backups-actions">
                      <button
                        type="button"
                        className="cc-btn ghost"
                        disabled={busy}
                        onClick={() =>
                          downloadBackupFile(session.token, b.filename).catch((e) =>
                            setDialog({ title: 'Error', message: e.message, alertOnly: true })
                          )
                        }
                      >
                        Descargar
                      </button>
                      <button
                        type="button"
                        className="cc-btn ghost"
                        disabled={busy}
                        onClick={() => confirmRestore(() => doRestoreNamed(b.filename))}
                      >
                        Restaurar
                      </button>
                      <button
                        type="button"
                        className="cc-btn ghost danger"
                        disabled={busy}
                        onClick={() => onDelete(b.filename)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cc-card cc-card--danger">
        <h2>Restaurar desde archivo</h2>
        <ul className="cc-hint">
          <li>
            <code>.zip</code> — restaura la base completa (con respaldo de seguridad previo).
          </li>
          <li>
            <code>.sql</code> — mismo efecto (formato legado).
          </li>
        </ul>
        <input
          type="file"
          accept=".zip,.sql,application/zip"
          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          className="cc-btn danger"
          disabled={busy}
          onClick={() => confirmRestore(doRestoreUpload)}
        >
          Restaurar desde archivo
        </button>
      </section>

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        danger={dialog?.danger}
        alertOnly={dialog?.alertOnly}
        confirmLabel={dialog?.confirmLabel || 'Aceptar'}
        promptDefault={dialog?.promptDefault}
        promptLabel={dialog?.promptLabel}
        promptPlaceholder={dialog?.promptPlaceholder}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={(value) => {
          if (dialog?.onConfirm) dialog.onConfirm(value);
          else setDialog(null);
        }}
      />
    </div>
  );
}
