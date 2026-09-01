import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT username, role, display_name, must_change_password, is_active
   FROM users ORDER BY created_at`
);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
