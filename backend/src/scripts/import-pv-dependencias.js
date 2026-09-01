/**
 * Importa Dependencias idénticas a ParqueVehicular (RR.MM. → ZZ.MM. → Organismos).
 * Desactiva org_units previos que no sean código PV-*.
 * No crea canales PTT automáticamente.
 *
 * Uso: cd backend && node src/scripts/import-pv-dependencias.js
 */
import 'dotenv/config';
import { query } from '../db.js';
import { PV_DEPENDENCIAS } from '../data/pvDependenciasTree.js';

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
       organization_id, parent_id, kind, zone_type, name, code, external_id, sort_order, is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
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

async function main() {
  const { rows: orgs } = await query(
    `SELECT id, name FROM organizations WHERE is_active ORDER BY created_at LIMIT 1`
  );
  if (!orgs[0]) {
    console.error('No hay organización. Ejecuta npm run seed.');
    process.exit(1);
  }
  const orgId = orgs[0].id;
  console.log(`Org: ${orgs[0].name}`);
  console.log(`Fuente: ${PV_DEPENDENCIAS.source}`);

  let regions = 0;
  let zones = 0;
  let organisms = 0;

  for (const r of PV_DEPENDENCIAS.regions) {
    const region = await upsertUnit({
      orgId,
      parentId: null,
      kind: 'region',
      name: r.name,
      code: r.code,
      externalId: r.externalId,
      sortOrder: r.sortOrder,
    });
    regions += 1;

    for (const z of r.zones) {
      const zone = await upsertUnit({
        orgId,
        parentId: region.id,
        kind: 'zone',
        zoneType: z.zoneType,
        name: z.name,
        code: z.code,
        externalId: z.externalId,
        sortOrder: z.sortOrder,
      });
      zones += 1;

      for (const o of z.organisms) {
        await upsertUnit({
          orgId,
          parentId: zone.id,
          kind: 'unit',
          name: o.name,
          code: o.code,
          externalId: o.externalId,
          sortOrder: o.sortOrder,
        });
        organisms += 1;
      }
      console.log(`  ${r.name} / ${z.name}: ${z.organisms.length} organismos`);
    }
  }

  const { rowCount: deactivated } = await query(
    `UPDATE org_units
     SET is_active = FALSE, updated_at = NOW()
     WHERE organization_id = $1
       AND is_active = TRUE
       AND code NOT LIKE 'PV-%'`,
    [orgId]
  );

  console.log(`OK regiones=${regions} zonas=${zones} organismos=${organisms}`);
  console.log(`Desactivados (no PV-*): ${deactivated || 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
