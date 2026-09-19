import { useCallback, useEffect, useState } from 'react';
import { fetchOrgSettings, patchOrgSettings } from '../api';

export default function ConfigPresence({ session }) {
  const [minutes, setMinutes] = useState(15);
  const [draft, setDraft] = useState('15');
  const [absence, setAbsence] = useState(15);
  const [absenceDraft, setAbsenceDraft] = useState('15');
  const [showAway, setShowAway] = useState(true);
  const [showOffline, setShowOffline] = useState(true);
  const [gpsAcc, setGpsAcc] = useState(50);
  const [gpsAccDraft, setGpsAccDraft] = useState('50');
  const [gpsInterval, setGpsInterval] = useState(5);
  const [gpsIntervalDraft, setGpsIntervalDraft] = useState('5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchOrgSettings(session.token);
      const m = Number(data.settings?.presenceOfflineRedMinutes);
      const red = Number.isFinite(m) ? m : 15;
      setMinutes(red);
      setDraft(String(red));
      const a = Number(data.settings?.presenceAbsenceMinutes);
      const abs = Number.isFinite(a) ? a : 15;
      setAbsence(abs);
      setAbsenceDraft(String(abs));
      setShowAway(data.settings?.presenceShowAway !== false);
      setShowOffline(data.settings?.presenceShowOffline !== false);
      const acc = Number(data.settings?.gpsMaxAccuracyM) || 50;
      const sec = Number(data.settings?.gpsIntervalSec) || 5;
      setGpsAcc(acc);
      setGpsAccDraft(String(acc));
      setGpsInterval(sec);
      setGpsIntervalDraft(String(sec));
    } catch (e) {
      setError(e.message || 'No se pudo cargar');
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSavePresence(e) {
    e.preventDefault();
    const n = parseInt(draft, 10);
    const abs = parseInt(absenceDraft, 10);
    if (!Number.isFinite(n) || n < 0 || n > 10080) {
      setError('Fuera de línea: minutos entre 0 y 10080 (0 = rojo al desconectar).');
      return;
    }
    if (!Number.isFinite(abs) || abs < 0 || abs > 10080) {
      setError('Ausencia: minutos entre 0 y 10080 (0 = sin amarillo).');
      return;
    }
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const data = await patchOrgSettings(session.token, {
        presenceOfflineRedMinutes: n,
        presenceAbsenceMinutes: abs,
        presenceShowAway: showAway,
        presenceShowOffline: showOffline,
      });
      const m = Number(data.settings?.presenceOfflineRedMinutes);
      const a = Number(data.settings?.presenceAbsenceMinutes);
      setMinutes(Number.isFinite(m) ? m : n);
      setDraft(String(Number.isFinite(m) ? m : n));
      setAbsence(Number.isFinite(a) ? a : abs);
      setAbsenceDraft(String(Number.isFinite(a) ? a : abs));
      setShowAway(data.settings?.presenceShowAway !== false);
      setShowOffline(data.settings?.presenceShowOffline !== false);
      setOkMsg('Presencia guardada. El mapa aplica al refrescar ubicaciones.');
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveGps(e) {
    e.preventDefault();
    const acc = parseInt(gpsAccDraft, 10);
    const sec = parseInt(gpsIntervalDraft, 10);
    if (!Number.isFinite(acc) || acc < 10 || acc > 200) {
      setError('Precisión máxima: entre 10 y 200 metros.');
      return;
    }
    if (!Number.isFinite(sec) || sec < 2 || sec > 60) {
      setError('Intervalo GPS: entre 2 y 60 segundos.');
      return;
    }
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const data = await patchOrgSettings(session.token, {
        gpsMaxAccuracyM: acc,
        gpsIntervalSec: sec,
      });
      const a = Number(data.settings?.gpsMaxAccuracyM) || acc;
      const s = Number(data.settings?.gpsIntervalSec) || sec;
      setGpsAcc(a);
      setGpsAccDraft(String(a));
      setGpsInterval(s);
      setGpsIntervalDraft(String(s));
      setOkMsg(
        'GPS guardado. La APK y la consola aplican el cambio al refrescar (unos segundos / al reabrir radio).'
      );
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  const modeHint = (() => {
    const parts = ['Verde'];
    if (showAway) parts.push('Amarillo');
    if (showOffline) parts.push('Gris');
    parts.push('Rojo');
    return parts.join(' · ');
  })();

  return (
    <div className="cc-config-block">
      <h2>Presencia</h2>
      <p className="cc-hint">
        Semáforo del mapa: {modeHint}. Verde y rojo siempre existen; amarillo y gris son
        opcionales.
      </p>
      <form className="cc-form" onSubmit={onSavePresence} style={{ maxWidth: 420 }}>
        <fieldset
          style={{
            border: '1px solid var(--cc-border, #334155)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            margin: '0 0 0.75rem',
          }}
        >
          <legend style={{ padding: '0 0.35rem' }}>Colores intermedios</legend>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showAway}
              onChange={(ev) => setShowAway(ev.target.checked)}
              disabled={busy}
            />
            <span>
              Mostrar <strong style={{ color: '#eab308' }}>Ausente</strong> (amarillo)
            </span>
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showOffline}
              onChange={(ev) => setShowOffline(ev.target.checked)}
              disabled={busy}
            />
            <span>
              Mostrar <strong style={{ color: '#9ca3af' }}>Desconectado</strong> (gris)
            </span>
          </label>
          <p className="cc-hint" style={{ margin: '0.5rem 0 0' }}>
            Sin amarillo: en 2º plano sigue verde. Sin gris: al soltar presencia pasa a rojo.
            Ambos off → solo verde y rojo.
          </p>
        </fieldset>

        <p className="cc-hint">
          Ausencia: <strong>{absence} min</strong>
          {absence === 0 || !showAway ? ' (sin amarillo)' : ''} · Fuera de línea:{' '}
          <strong>{minutes} min</strong>
          {minutes === 0 || !showOffline ? ' (rojo al desconectar)' : ''}.
        </p>
        <label>
          Tiempo de ausencia → amarillo (minutos)
          <input
            type="number"
            min={0}
            max={10080}
            value={absenceDraft}
            onChange={(ev) => setAbsenceDraft(ev.target.value)}
            disabled={busy || !showAway}
          />
        </label>
        <label>
          Tiempo fuera de línea → rojo tras gris (minutos)
          <input
            type="number"
            min={0}
            max={10080}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            disabled={busy || !showOffline}
          />
        </label>
        <p className="cc-hint" style={{ marginTop: 0 }}>
          0 en ausencia = sin amarillo. 0 en fuera de línea = al desconectarse pasa a rojo al
          instante. Los minutos solo aplican si el color correspondiente está activado.
        </p>
        <button type="submit" className="cc-btn primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar presencia'}
        </button>
      </form>

      <h2 style={{ marginTop: '1.75rem' }}>GPS / ubicación</h2>
      <p className="cc-hint">
        Controla qué fixes acepta la flota (APK y Radio web) y cada cuánto reportan. No cambia el
        chip GPS del teléfono: solo el filtro y el ritmo. Valores actuales:{' '}
        <strong>≤ {gpsAcc} m</strong>, cada <strong>{gpsInterval} s</strong>.
      </p>
      <p className="cc-hint">
        Más estricto (p. ej. 30 m): pines más finos, más huecos en interiores. Más laxo (80 m): más
        cobertura, menos precisión aparente. Intervalo más corto: mapa más vivo, más batería.
      </p>
      <form className="cc-form" onSubmit={onSaveGps} style={{ maxWidth: 420 }}>
        <label>
          Precisión máxima aceptada (metros)
          <input
            type="number"
            min={10}
            max={200}
            value={gpsAccDraft}
            onChange={(ev) => setGpsAccDraft(ev.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Intervalo de reporte (segundos)
          <input
            type="number"
            min={2}
            max={60}
            value={gpsIntervalDraft}
            onChange={(ev) => setGpsIntervalDraft(ev.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" className="cc-btn primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar GPS'}
        </button>
      </form>

      {error && <p className="lt-error">{error}</p>}
      {okMsg && <p className="cc-hint">{okMsg}</p>}
    </div>
  );
}
