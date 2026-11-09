import { pool, query } from '../db.js';
import { IV_RM_STATE_IDS, MX_STATE_BY_ID } from '../data/mxStateCatalog.js';

function mapRow(r) {
  return {
    estadoId: r.estado_id,
    name: r.estado,
    regionId: r.region_id,
    regionName: r.region_name,
  };
}

async function selectStates(orgId) {
  const { rows } = await query(
    `SELECT s.estado_id, s.estado, s.region_id, r.name AS region_name
     FROM cat_region_states s
     JOIN org_units r ON r.id = s.region_id
     WHERE s.organization_id = $1
     ORDER BY r.name, s.estado`,
    [orgId]
  );
  return rows.map(mapRow);
}

/** La primera vez, IV R.M. recibe Nuevo León, Tamaulipas y San Luis Potosí. */
async function ensureSeed(orgId) {
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS n FROM cat_region_states WHERE organization_id = $1`,
    [orgId]
  );
  if ((countRows[0]?.n || 0) > 0) return;
  const { rows: regions } = await query(
    `SELECT id, name FROM org_units
     WHERE organization_id = $1 AND kind = 'region' AND is_active
       AND (name ILIKE '%IV R.M%' OR name ILIKE '%IV RM%')
     ORDER BY name
     LIMIT 1`,
    [orgId]
  );
  const region = regions[0];
  if (!region) return;
  for (const id of IV_RM_STATE_IDS) {
    const def = MX_STATE_BY_ID.get(id);
    if (!def) continue;
    await query(
      `INSERT INTO cat_region_states (organization_id, region_id, estado_id, estado)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, estado_id) DO NOTHING`,
      [orgId, region.id, def.id, def.name]
    );
  }
}

export async function listRegionStates(orgId) {
  await ensureSeed(orgId);
  return selectStates(orgId);
}

export async function regionHasEstado(orgId, regionId, estadoName) {
  if (!regionId || !estadoName) return false;
  const { rows } = await query(
    `SELECT 1 FROM cat_region_states
     WHERE organization_id = $1
       AND region_id = $2
       AND LOWER(TRIM(estado)) = LOWER(TRIM($3))
     LIMIT 1`,
    [orgId, regionId, estadoName]
  );
  return Boolean(rows[0]);
}

/**
 * assign true: el estado pasa a esta región.
 * Si otra lo tiene y transfer no viene, se devuelve el conflicto sin cambiar nada.
 * assign false: esta región lo pierde y nadie lo recupera.
 */
export async function setRegionState(orgId, body = {}) {
  const regionId = String(body.regionId || '').trim();
  const estadoId = String(body.estadoId || '').trim().toUpperCase();
  const assign = Boolean(body.assign);
  const transfer = Boolean(body.transfer);
  const def = MX_STATE_BY_ID.get(estadoId);
  if (!regionId || !def) {
    const e = new Error('regionId y estadoId son obligatorios');
    e.status = 400;
    throw e;
  }
  const { rows: regionRows } = await query(
    `SELECT id, name FROM org_units
     WHERE id = $1 AND organization_id = $2 AND kind = 'region' AND is_active`,
    [regionId, orgId]
  );
  if (!regionRows[0]) {
    const e = new Error('Región no encontrada');
    e.status = 404;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const holder = await client.query(
      `SELECT s.region_id, r.name AS region_name
       FROM cat_region_states s
       JOIN org_units r ON r.id = s.region_id
       WHERE s.organization_id = $1 AND s.estado_id = $2`,
      [orgId, def.id]
    );
    const current = holder.rows[0] || null;

    if (!assign) {
      await client.query(
        `DELETE FROM cat_region_states
         WHERE organization_id = $1 AND region_id = $2 AND estado_id = $3`,
        [orgId, regionId, def.id]
      );
      await client.query('COMMIT');
      return { states: await selectStates(orgId) };
    }

    if (current && String(current.region_id) === regionId) {
      await client.query('COMMIT');
      return { states: await selectStates(orgId) };
    }

    if (current && !transfer) {
      await client.query('ROLLBACK');
      return {
        conflict: true,
        estado: def.name,
        holderName: current.region_name,
        states: await selectStates(orgId),
      };
    }

    if (current) {
      await client.query(
        `DELETE FROM cat_region_states
         WHERE organization_id = $1 AND estado_id = $2`,
        [orgId, def.id]
      );
    }
    await client.query(
      `INSERT INTO cat_region_states (organization_id, region_id, estado_id, estado)
       VALUES ($1, $2, $3, $4)`,
      [orgId, regionId, def.id, def.name]
    );
    await client.query('COMMIT');
    return { states: await selectStates(orgId) };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
