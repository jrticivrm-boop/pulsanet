/**
 * Importa Región → zonas → unidades (IV R.M.) y canales PTT por unidad.
 * Uso: cd backend && npm run seed:units
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { query } from '../db.js';
import { IV_RM_ORG } from '../data/ivRmUnits.js';

async function upsertUnit({
  orgId,
  parentId,
  kind,
  zoneType,
  name,
  code,
  externalId,
  sortOrder,
}) {
  const { rows } = await query(
    `INSERT INTO org_units (
       organization_id, parent_id, kind, zone_type, name, code, external_id, sort_order
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (organization_id, code) DO UPDATE SET
       parent_id = EXCLUDED.parent_id,
       kind = EXCLUDED.kind,
       zone_type = EXCLUDED.zone_type,
       name = EXCLUDED.name,
       external_id = EXCLUDED.external_id,
       sort_order = EXCLUDED.sort_order,
       is_active = TRUE,
       updated_at = NOW()
     RETURNING id, code, name`,
    [orgId, parentId, kind, zoneType || null, name, code, externalId ?? null, sortOrder]
  );
  return rows[0];
}

async function ensurePttGroup({ orgId, unitId, name, code }) {
  const { rows: existing } = await query(
    `SELECT id FROM groups WHERE organization_id = $1 AND unit_id = $2 LIMIT 1`,
    [orgId, unitId]
  );
  if (existing[0]) return { id: existing[0].id, created: false };

  const room = `unit_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}_${randomBytes(4).toString('hex')}`;
  const { rows } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, unit_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [orgId, name, `Canal operativo · ${code}`, room, unitId]
  );
  return { id: rows[0].id, created: true };
}

async function main() {
  const { rows: orgs } = await query(
    `SELECT id, name FROM organizations WHERE is_active ORDER BY created_at LIMIT 1`
  );
  if (!orgs[0]) {
    console.error('No hay organización activa. Ejecuta primero npm run seed.');
    process.exit(1);
  }
  const orgId = orgs[0].id;
  console.log(`Org: ${orgs[0].name} (${orgId})`);

  const region = await upsertUnit({
    orgId,
    parentId: null,
    kind: 'region',
    zoneType: null,
    name: IV_RM_ORG.region.name,
    code: IV_RM_ORG.region.code,
    externalId: IV_RM_ORG.region.externalId,
    sortOrder: 0,
  });
  console.log(`Región: ${region.name}`);

  let zones = 0;
  let units = 0;
  let channels = 0;

  for (let zi = 0; zi < IV_RM_ORG.zones.length; zi += 1) {
    const z = IV_RM_ORG.zones[zi];
    const zone = await upsertUnit({
      orgId,
      parentId: region.id,
      kind: 'zone',
      zoneType: z.zoneType,
      name: z.name,
      code: z.code,
      externalId: z.externalId,
      sortOrder: zi + 1,
    });
    zones += 1;

    for (let ui = 0; ui < z.units.length; ui += 1) {
      const u = z.units[ui];
      const unit = await upsertUnit({
        orgId,
        parentId: zone.id,
        kind: 'unit',
        zoneType: null,
        name: u.name,
        code: u.code,
        externalId: u.externalId,
        sortOrder: ui + 1,
      });
      units += 1;
      const g = await ensurePttGroup({
        orgId,
        unitId: unit.id,
        name: u.name,
        code: u.code,
      });
      if (g.created) channels += 1;
    }
    console.log(`  Zona ${z.name}: ${z.units.length} unidades`);
  }

  console.log(`OK — zonas=${zones} unidades=${units} canales_nuevos=${channels}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
