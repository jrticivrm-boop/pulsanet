/**
 * Elimina usuarios demo/prueba (seed antiguo, loadtest, cuentas @ correo demo).
 * Conserva usuarios reales creados por alta admin (RFC) que no coincidan con los patrones.
 *
 * Uso: node src/scripts/purge-demo-users.js
 */
import { query } from '../db.js';

const DEMO_ORG = '00000000-0000-0000-0000-000000000001';

/** Usuarios RFC del seed de prueba + legacy por correo */
const KNOWN_DEMO_USERNAMES = [
  'SIAR900101',
  'LOMA880315',
  'HERC850722',
  'GANP920510',
  'RASM941103',
  'TOVL910918',
  'MECS960227',
  'ROOT',
  'ADMIN',
  'DESPACHO',
  'OP1',
  'OP2',
  'OP3',
  'OP4',
];

async function purge() {
  const { rows: candidates } = await query(
    `SELECT id, username, email, display_name, role
     FROM users
     WHERE
       username = ANY($1::text[])
       OR username LIKE 'LOAD%'
       OR LOWER(COALESCE(email, '')) LIKE 'loaduser%@%'
       OR LOWER(COALESCE(email, '')) IN (
         'root@tacticalptx.local',
         'admin@tacticalptx.local',
         'despacho@tacticalptx.local',
         'op1@tacticalptx.local',
         'op2@tacticalptx.local',
         'op3@tacticalptx.local',
         'op4@tacticalptx.local',
         'root@pulsanet.local',
         'admin@pulsanet.local',
         'despacho@pulsanet.local',
         'op1@pulsanet.local',
         'op2@pulsanet.local',
         'op3@pulsanet.local',
         'op4@pulsanet.local'
       )
       OR LOWER(COALESCE(email, '')) ~ '^op[0-9]+@(pulsanet|tacticalptx)\\.local$'
       OR display_name ILIKE '%demo%'
       OR display_name ~* '^operador[[:space:]]*[0-9]+$'
       OR display_name ILIKE 'Load %'
       OR display_name IN (
         'Superadmin Root',
         'Root Sistema Admin',
         'Administrador Demo',
         'Despachador Demo',
         'Ana Lopez Martinez',
         'Carlos Hernandez Ruiz',
         'Pedro Garcia Nunez',
         'Maria Ramirez Soto',
         'Luis Torres Vega',
         'Sofia Mendez Cruz'
       )`,
    [KNOWN_DEMO_USERNAMES]
  );

  if (!candidates.length) {
    console.log('Nada que purgar: no hay usuarios demo/prueba.');
    return;
  }

  console.log(`Usuarios a eliminar (${candidates.length}):`);
  for (const u of candidates) {
    console.log(`  - ${u.username} | ${u.display_name} (${u.role})`);
  }

  const ids = candidates.map((u) => u.id);

  // DM: el CHECK exige sender_id NOT NULL; ON DELETE SET NULL fallaría.
  await query(
    `DELETE FROM messages
     WHERE sender_id = ANY($1::uuid[])
        OR recipient_id = ANY($1::uuid[])`,
    [ids]
  );

  const { rowCount } = await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);

  // Limpia ubicaciones huérfanas ya cascaded; opcional: renombrar org demo
  await query(
    `UPDATE organizations SET name = 'Organización', updated_at = NOW()
     WHERE id = $1 AND (name ILIKE '%demo%' OR slug = 'demo')`,
    [DEMO_ORG]
  );

  console.log(`Eliminados: ${rowCount} usuario(s) demo/prueba.`);
}

purge().catch((err) => {
  console.error('Purge falló:', err.message);
  process.exit(1);
});
