import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGeofences, deleteGeofence } from '../api';

export default function GeofenceCatalog({ session }) {
  const [geofences, setGeofences] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

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

  async function remove(id) {
    if (!window.confirm('¿Eliminar esta geocerca?')) return;
    setBusyId(id);
    try {
      await deleteGeofence(session.token, id);
      await reload();
    } catch (e) {
      setError(e.message);
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
        <Link className="cc-btn primary" to="/despacho/mapa">
          Abrir mapa en vivo
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
                <td colSpan={4} className="cc-muted">
                  No hay geocercas. Créalas en Mapa en vivo.
                </td>
              </tr>
            )}
            {geofences.map((g) => (
              <tr key={g.id}>
                <td>
                  <strong>{g.name}</strong>
                </td>
                <td>
                  {Number(g.centerLat).toFixed(5)}, {Number(g.centerLng).toFixed(5)}
                </td>
                <td>{Math.round(g.radiusM)} m</td>
                <td>
                  <button
                    type="button"
                    className="cc-btn ghost"
                    disabled={busyId === g.id}
                    onClick={() => remove(g.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
