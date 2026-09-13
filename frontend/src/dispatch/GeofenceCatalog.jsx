import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGeofences, deleteGeofence } from '../api';
import AppDialog from '../AppDialog';

export default function GeofenceCatalog({ session }) {
  const [geofences, setGeofences] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [pendingId, setPendingId] = useState('');

  async function reload() {
    try {
      const data = await fetchGeofences(session.token);
      setGeofences((data.geofences || []).filter((g) => g.isActive !== false));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    reload();
  }, [session.token]);

  function askRemove(id) {
    setPendingId(id);
  }

  async function confirmRemove() {
    const id = pendingId;
    if (!id) return;
    setBusyId(id);
    try {
      await deleteGeofence(session.token, id);
      setPendingId('');
      await reload();
    } catch (e) {
      setError(e.message);
      setPendingId('');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="cc-catalog-panel">
      <div className="cc-catalog-toolbar">
        <p>
          Zonas circulares usadas en el mapa en vivo. Para dibujar una nueva, abre el mapa.
        </p>
        <Link className="cc-btn primary" to="/despacho">
          Abrir Consola de Operaciones
        </Link>
      </div>
      {error && <p className="cc-error">{error}</p>}
      <div className="cc-table-wrap">
        <table className="cc-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Centro</th>
              <th>Radio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {geofences.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Sin geocercas
                </td>
              </tr>
            )}
            {geofences.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>
                  <code className="cc-mono">
                    {Number(g.centerLat).toFixed(5)}, {Number(g.centerLng).toFixed(5)}
                  </code>
                </td>
                <td>{g.radiusM} m</td>
                <td>
                  <button
                    type="button"
                    className="cc-btn ghost"
                    disabled={busyId === g.id}
                    onClick={() => askRemove(g.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AppDialog
        open={Boolean(pendingId)}
        title="Eliminar geocerca"
        message="¿Eliminar esta geocerca?"
        confirmLabel="Eliminar"
        danger
        busy={Boolean(busyId)}
        onCancel={() => {
          if (!busyId) setPendingId('');
        }}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
