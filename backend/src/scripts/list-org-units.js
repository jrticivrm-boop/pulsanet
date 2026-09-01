import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT kind, name, code, external_id, parent_id, is_active
   FROM org_units ORDER BY kind, sort_order, name`
);
const byKind = { region: [], zone: [], unit: [] };
for (const row of r.rows) byKind[row.kind]?.push(row);
console.log(
  JSON.stringify(
    {
      regions: byKind.region.map((x) => `${x.name} [${x.code}] active=${x.is_active}`),
      zones: byKind.zone.map((x) => `${x.name} [${x.code}]`),
      units: byKind.unit.length,
    },
    null,
    2
  )
);
await c.end();
