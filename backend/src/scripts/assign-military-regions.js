/**
 * Crea las regiones militares que faltan y asigna sus estados.
 * No toca zonas ni unidades ya registradas.
 * Uso: cd backend && node src/scripts/assign-military-regions.js
 */
import 'dotenv/config';
import { query } from '../db.js';
import { assignMilitaryRegionStates } from '../services/regionStates.js';

async function main() {
  const { rows: orgs } = await query(
    `SELECT DISTINCT o.id, o.name
     FROM organizations o
     JOIN org_units u ON u.organization_id = o.id
     WHERE o.is_active AND u.kind = 'region' AND u.is_active AND u.name ILIKE '%R.M%'`
  );
  if (!orgs.length) {
    console.log('No hay organización con regiones militares.');
    return;
  }
  for (const org of orgs) {
    await assignMilitaryRegionStates(org.id);
    const { rows } = await query(
      `SELECT r.name AS region, COUNT(*)::int AS n,
              string_agg(s.estado, ', ' ORDER BY s.estado) AS estados
       FROM cat_region_states s
       JOIN org_units r ON r.id = s.region_id
       WHERE s.organization_id = $1
       GROUP BY r.name, r.sort_order
       ORDER BY r.sort_order, r.name`,
      [org.id]
    );
    console.log(org.name);
    for (const row of rows) console.log(`  ${row.region}: ${row.n} — ${row.estados}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
