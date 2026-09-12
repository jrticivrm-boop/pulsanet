import { useCallback, useEffect, useState } from 'react';
import { fetchOrgSettings, patchOrgSettings } from '../api';

export default function ConfigPresence({ session }) {
  const [minutes, setMinutes] = useState(15);
  const [draft, setDraft] = useState('15');
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
      const m = Number(data.settings?.presenceOfflineRedMinutes) || 15;
      setMinutes(m);
      setDraft(String(m));
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
    if (!Number.isFinite(n) || n < 1 || n > 10080) {
      setError('Indica minutos entre 1 y 10080 (7 días).');
      return;
    }
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const data = await patchOrgSettings(session.token, {
        presenceOfflineRedMinutes: n,
      });
      const m = Number(data.settings?.presenceOfflineRedMinutes) || n;
      setMinutes(m);
      setDraft(String(m));
      setOkMsg('Presencia guardada.');
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

  return (
    <div className="cc-config-block">
      <h2>Presencia</h2>
      <p className="cc-hint">
        Colores en mapa y chat: verde = en línea (app abierta, minimizada o alcanzable);
        gris = desconectado; rojo = desconectado prolongado (umbral abajo). Pánico mantiene alerta.
      </p>
      <p className="cc-hint">
        Umbral actual: <strong>{minutes} min</strong> (gris → rojo).
      </p>
      <form className="cc-form" onSubmit={onSavePresence} style={{ maxWidth: 420 }}>
        <label>
          Minutos hasta desconectado prolongado (rojo)
          <input
            type="number"
            min={1}
            max={10080}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            disabled={busy}
          />
        </label>
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
