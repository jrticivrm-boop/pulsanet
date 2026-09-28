import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

// Sin listener, un cliente inactivo cortado por PostgreSQL (reinicio, admin) tumba el proceso.
pool.on('error', (err) => {
  console.error('[db] error en cliente inactivo del pool:', err.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}
