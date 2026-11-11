import { pool, query } from '../db.js';
import { MX_MILITARY_REGIONS, MX_STATE_BY_ID } from '../data/mxStateCatalog.js';

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

async function ensureMilitaryRegions(orgId) {
  for (const region of MX_MILITARY_REGIONS) {
    const { rows } = await query(
      `SELECT id FROM org_units
       WHERE organization_id = $1 AND kind = 'region' AND is_active
         AND (LOWER(name) = LOWER($2) OR code = $3)
       LIMIT 1`,
      [orgId, region.name, region.code]
    );
    if (rows[0]) continue;
    await query(
      `INSERT INTO org_units (
         organization_id, parent_id, kind, name, code, external_id, sort_order, is_active
       ) VALUES ($1, NULL, 'region', $2, $3, $4, $5, TRUE)
       ON CONFLICT (organization_id, code) DO UPDATE SET
         name = EXCLUDED.name,
         is_active = TRUE,
         updated_at = NOW()`,
      [orgId, region.name, region.code, region.externalId, region.sortOrder]
    );
  }
}

/** Crea las regiones que faltan y deja cada estado en la suya. No borra zonas ni unidades. */
export async function assignMilitaryRegionStates(orgId) {
  await ensureMilitaryRegions(orgId);
  const { rows } = await query(
    `SELECT id, name, code FROM org_units
     WHERE organization_id = $1 AND kind = 'region' AND is_active`,
    [orgId]
  );
  const byName = new Map(rows.map((r) => [String(r.name || '').toLowerCase(), r]));
  const byCode = new Map(rows.map((r) => [String(r.code || ''), r]));
  for (const region of MX_MILITARY_REGIONS) {
    const row = byName.get(region.name.toLowerCase()) || byCode.get(region.code);
    if (!row) continue;
    for (const estadoId of region.states) {
      const def = MX_STATE_BY_ID.get(estadoId);
      if (!def) continue;
      await query(
        `DELETE FROM cat_region_states
         WHERE organization_id = $1 AND estado_id = $2 AND region_id <> $3`,
        [orgId, def.id, row.id]
      );
      await query(
        `INSERT INTO cat_region_states (organization_id, region_id, estado_id, estado)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, estado_id) DO NOTHING`,
        [orgId, row.id, def.id, def.name]
      );
    }
  }
}

/** La primera vez que una organización militar abre Estados, asigna las 12 regiones. */
async function ensureSeed(orgId) {
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS n FROM cat_region_states WHERE organization_id = $1`,
    [orgId]
  );
  if ((countRows[0]?.n || 0) > 0) return;
  const { rows: military } = await query(
    `SELECT 1 FROM org_units
     WHERE organization_id = $1 AND kind = 'region' AND is_active
       AND name ILIKE '%R.M%'
     LIMIT 1`,
    [orgId]
  );
  if (!military[0]) return;
  await assignMilitaryRegionStates(orgId);
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
