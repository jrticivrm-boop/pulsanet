import 'dotenv/config';
import pg from 'pg';

/** Enlaza grupos sin unit_id cuyo nombre coincide exactamente con una unidad. */
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const { rows } = await c.query(`
  UPDATE groups g
  SET unit_id = ou.id,
      updated_at = NOW()
  FROM org_units ou
  WHERE g.unit_id IS NULL
    AND ou.organization_id = g.organization_id
    AND ou.kind = 'unit'
    AND ou.is_active
    AND g.name = ou.name
  RETURNING g.id, g.name, g.unit_id, ou.name AS unit_name
`);
console.log('Backfilled', rows.length, 'groups:');
console.log(JSON.stringify(rows, null, 2));

const left = await c.query(`
  SELECT id, name, unit_id FROM groups WHERE is_active AND unit_id IS NULL ORDER BY name
`);
console.log('Still unbound:', JSON.stringify(left.rows, null, 2));

await c.end();
