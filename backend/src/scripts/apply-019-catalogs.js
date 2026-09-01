import 'dotenv/config';
import fs from 'fs';
import pg from 'pg';

const sql = fs.readFileSync(
  new URL('../../../database/migrations/019_catalog_grades_empleos.sql', import.meta.url),
  'utf8'
);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
const r = await client.query(
  `SELECT 'grades' AS t, COUNT(*)::int AS n FROM cat_grades
   UNION ALL
   SELECT 'empleos', COUNT(*)::int FROM cat_empleos`
);
console.log(r.rows);
await client.end();
