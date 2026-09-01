import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const counts = await c.query(`
  SELECT 'users' AS t, COUNT(*)::int AS n FROM users
  UNION ALL SELECT 'groups', COUNT(*)::int FROM groups
  UNION ALL SELECT 'org_units', COUNT(*)::int FROM org_units
  UNION ALL SELECT 'cat_grades', COUNT(*)::int FROM cat_grades
  UNION ALL SELECT 'cat_empleos', COUNT(*)::int FROM cat_empleos
  UNION ALL SELECT 'messages', COUNT(*)::int FROM messages
`);
const tables = await c.query(
  `SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`
);
console.log(JSON.stringify({ publicTables: tables.rows[0].n, counts: counts.rows }, null, 2));
await c.end();
