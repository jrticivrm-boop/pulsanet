/**
 * Crea la base si falta y aplica schema + migraciones. Idempotente: no DROP, no borra datos.
 * Uso: desde backend/  node src/scripts/apply-all-migrations.js
 * Lee DATABASE_URL de backend/.env (no imprime secretos).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '..');
const migrationsDir = path.join(repoRoot, 'database', 'migrations');
const schemaPath = path.join(repoRoot, 'database', 'schema.sql');

dotenv.config({ path: path.join(backendRoot, '.env') });

const ALREADY = new Set([
  '42P04', // duplicate_database
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '42710', // duplicate_object
  '42723', // duplicate_function
  '42712', // duplicate_alias
  '23505', // unique_violation (semilla ya presente)
]);

function parseDatabaseUrl(raw) {
  if (!raw || !String(raw).trim()) {
    throw new Error('Falta DATABASE_URL. Copia backend\\.env.example a backend\\.env');
  }
  const u = new URL(String(raw).trim().replace(/^postgresql:/i, 'http:'));
  const database = decodeURIComponent((u.pathname || '').replace(/^\//, '').split('/')[0] || '');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
    throw new Error('Nombre de base de datos no válido en DATABASE_URL');
  }
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port || '5432',
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database,
  };
}

function isAlready(err) {
  const code = err && err.code;
  if (ALREADY.has(code)) return true;
  const msg = String((err && err.message) || '');
  return /already exists/i.test(msg);
}

async function runSql(client, sql) {
  try {
    await client.query(sql);
    return 'aplicado';
  } catch (err) {
    if (isAlready(err)) return 'ya existía';
    throw err;
  }
}

function findApplyScript(sqlFile) {
  const scriptsDir = path.join(backendRoot, 'src', 'scripts');
  if (!fs.existsSync(scriptsDir)) return null;
  const files = fs.readdirSync(scriptsDir).filter((f) => /^apply-\d+.*\.js$/i.test(f));
  for (const f of files) {
    const txt = fs.readFileSync(path.join(scriptsDir, f), 'utf8');
    if (txt.includes(sqlFile)) return path.join(scriptsDir, f);
  }
  return null;
}

function runApplyScript(scriptPath) {
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: backendRoot,
    env: process.env,
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status === 0) return 'ok';
  const combined = `${r.stdout || ''}\n${r.stderr || ''}\n${r.error || ''}`;
  if (/already exists/i.test(combined)) return 'ya existía';
  throw new Error(`apply script falló (${path.basename(scriptPath)}) código ${r.status}`);
}

const cfg = parseDatabaseUrl(process.env.DATABASE_URL);
console.log('=== TacticalPtx: crear o actualizar base de datos ===');
console.log(`Host: ${cfg.host}:${cfg.port}`);
console.log(`Base: ${cfg.database}`);
console.log(`Usuario: ${cfg.user}`);
console.log('(no se muestra la contraseña)');
console.log('');

const admin = new pg.Client({
  host: cfg.host,
  port: Number(cfg.port),
  user: cfg.user,
  password: cfg.password,
  database: 'postgres',
});

let createdDb = false;
try {
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 AS ok FROM pg_database WHERE datname = $1', [
    cfg.database,
  ]);
  if (rows.length) {
    console.log(`[OK] Base ${cfg.database}: ya existía (no se borra)`);
  } else {
    await admin.query(`CREATE DATABASE ${cfg.database}`);
    createdDb = true;
    console.log(`[OK] Base ${cfg.database}: creada`);
  }
} catch (err) {
  if (isAlready(err)) {
    console.log(`[OK] Base ${cfg.database}: ya existía`);
  } else {
    console.error(`[ERROR] No se pudo conectar/crear la base: ${err.message}`);
    console.error('Comprueba que PostgreSQL está en marcha y DATABASE_URL en backend\\.env');
    process.exit(1);
  }
} finally {
  try {
    await admin.end();
  } catch {
    /* ignore */
  }
}

const client = new pg.Client({
  host: cfg.host,
  port: Number(cfg.port),
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
});
await client.connect();

const { rows: tableRows } = await client.query(
  `SELECT COUNT(*)::int AS n
     FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
);
const tableCount = tableRows[0]?.n || 0;

if (tableCount < 1) {
  if (!fs.existsSync(schemaPath)) {
    console.error(`[ERROR] Falta ${schemaPath}`);
    process.exit(1);
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const status = await runSql(client, schemaSql);
  console.log(`[OK] Esquema schema.sql: ${status} (base vacía)`);
} else {
  console.log(`[OK] Esquema: ya había ${tableCount} tablas (no se reaplica schema.sql)`);
}

if (!fs.existsSync(migrationsDir)) {
  console.error(`[ERROR] Falta ${migrationsDir}`);
  process.exit(1);
}

const sqlFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.toLowerCase().endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, 'en'));

let ok = 0;
let existed = 0;
let failed = 0;

for (const sqlFile of sqlFiles) {
  const applyPath = findApplyScript(sqlFile);
  try {
    if (applyPath) {
      const st = runApplyScript(applyPath);
      if (st === 'ya existía') {
        existed += 1;
        console.log(`[OK] ${sqlFile} (via ${path.basename(applyPath)}): ya existía`);
      } else {
        ok += 1;
        console.log(`[OK] ${sqlFile} (via ${path.basename(applyPath)})`);
      }
    } else {
      const sql = fs.readFileSync(path.join(migrationsDir, sqlFile), 'utf8');
      const st = await runSql(client, sql);
      if (st === 'ya existía') {
        existed += 1;
        console.log(`[OK] ${sqlFile}: ya existía`);
      } else {
        ok += 1;
        console.log(`[OK] ${sqlFile}: ${st}`);
      }
    }
  } catch (err) {
    failed += 1;
    console.error(`[ERROR] ${sqlFile}: ${err.message}`);
  }
}

await client.end();

console.log('');
console.log('========== RESUMEN BD ==========');
console.log(`Base: ${cfg.database}${createdDb ? ' (creada ahora)' : ' (ya existía)'}`);
console.log(`Migraciones OK: ${ok}  |  ya aplicadas: ${existed}  |  errores: ${failed}`);
console.log('No se ejecutó DROP ni se borraron datos.');
if (tableCount < 1) {
  console.log('Si es una máquina nueva: npm run seed  (en backend) crea el usuario root.');
}
console.log('================================');

if (failed > 0) process.exit(1);
process.exit(0);
