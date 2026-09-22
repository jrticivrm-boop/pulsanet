import { useEffect, useMemo, useState } from 'react';
import { fetchOrgUnits } from '../api';

const ZONE_TYPE_LABEL = {
  cg: 'C.G. Región',
  zm: 'Zona militar',
  support: 'Apoyo',
};

function flattenUnits(tree) {
  const rows = [];
  for (const region of tree || []) {
    for (const zone of region.children || []) {
      for (const unit of zone.children || []) {
        rows.push({
          regionName: region.name,
          zoneId: zone.id,
          zoneName: zone.name,
          zoneType: zone.zoneType,
          zoneCode: zone.code,
          ...unit,
        });
      }
    }
  }
  return rows;
}

export default function DispatchUnits({ session }) {
  const [tree, setTree] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOrgUnits(session.token)
      .then((data) => {
        if (cancelled) return;
        setTree(data.tree || []);
        setErr('');
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'No se pudo cargar el organigrama');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const zones = useMemo(() => {
    const list = [];
    for (const region of tree) {
      for (const z of region.children || []) list.push(z);
    }
    return list;
  }, [tree]);

  const units = useMemo(() => {
    let rows = flattenUnits(tree);
    if (zoneFilter) rows = rows.filter((r) => r.zoneId === zoneFilter);
    const q = filter.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.zoneName.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [tree, filter, zoneFilter]);

  return (
    <div className="cc-units">
      <header className="cc-units-head">
        <div>
          <h2>Unidades (IV R.M.)</h2>
          <p className="cc-hint">
            Región (maestro) → Zonas (C.G. con organismos subordinados directos, Z.M. y apoyo) →
            Unidades con servicios desplegados (usuarios). Cada unidad tiene canal PTT. Zona y unidad
            administran, oyen y dan seguimiento solo a su alcance.
          </p>
        </div>
        <div className="cc-units-filters">
          <label>
            Zona
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
              <option value="">Todas</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                  {z.zoneType ? ` · ${ZONE_TYPE_LABEL[z.zoneType] || z.zoneType}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Unidad, código…"
            />
          </label>
        </div>
      </header>

      {err && <p className="error">{err}</p>}
      {loading && <p className="muted">Cargando organigrama…</p>}

      {!loading && !err && (
        <>
          <div className="cc-units-summary">
            <span>{zones.length} zonas</span>
            <span>{units.length} unidades</span>
          </div>

          <div className="cc-units-zones">
            {zones.map((z) => (
              <article key={z.id} className="cc-units-zone-card">
                <header>
                  <h3>{z.name}</h3>
                  <span className="cc-units-badge">
                    {ZONE_TYPE_LABEL[z.zoneType] || z.zoneType || 'Zona'}
                  </span>
                </header>
                <p className="muted">
                  {z.code} · {(z.children || []).length} unidades
                </p>
              </article>
            ))}
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Unidad</th>
                  <th>Código</th>
                  <th>Tipo zona</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td>{u.zoneName}</td>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td>
                      <code>{u.code}</code>
                    </td>
                    <td>{ZONE_TYPE_LABEL[u.zoneType] || '—'}</td>
                  </tr>
                ))}
                {!units.length && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Sin unidades. Ejecuta en el servidor:{' '}
                      <code>cd backend && npm run seed:units</code>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
