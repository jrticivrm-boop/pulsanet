/**
 * Seed de carga (solo pruebas de rendimiento). NO usar en producción.
 * Crea LOAD001… usuarios temporales; limpia después con: npm run seed:purge-demo
 */
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { generateTemporaryPassword } from '../services/tempPassword.js';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const COUNT = parseInt(process.env.LOAD_USERS || '100', 10);

async function seedLoad() {
  if (process.env.ALLOW_LOAD_SEED !== '1') {
    console.error(
      'Abortado: seed:load solo para pruebas. Exporta ALLOW_LOAD_SEED=1 para continuar.\n' +
        'Luego limpia con: npm run seed:purge-demo'
    );
    process.exit(1);
  }

  const password = generateTemporaryPassword();
  const hash = await bcrypt.hash(password, 10);

  const { rows: grp } = await query(
    `SELECT id FROM groups
     WHERE organization_id = $1 AND is_active = TRUE
       AND (livekit_room = 'grp_general' OR name = 'General')
     ORDER BY CASE WHEN livekit_room = 'grp_general' THEN 0 ELSE 1 END
     LIMIT 1`,
    [ORG_ID]
  );
  const groupId = grp[0]?.id;
  if (!groupId) {
    throw new Error('Falta grupo General. Ejecuta npm run seed primero.');
  }

  console.log(`Creando ${COUNT} usuarios de carga (prueba)…`);
  for (let i = 1; i <= COUNT; i++) {
    const n = String(i).padStart(3, '0');
    const username = `LOAD${n}900101`.slice(0, 20);
    const email = `load${n}@tacticalptx.local`;
    const displayName = `Load ${n}`;
    const { rows } = await query(
      `INSERT INTO users (
         organization_id, username, email, password_hash, display_name, role, must_change_password
       )
       VALUES ($1, $2, $3, $4, $5, 'operator', TRUE)
       ON CONFLICT (organization_id, username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             is_active = TRUE,
             must_change_password = TRUE
       RETURNING id`,
      [ORG_ID, username, email, hash, displayName]
    );
    await query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, rows[0].id]
    );
    if (i % 20 === 0) console.log(`  …${i}/${COUNT}`);
  }

  console.log('Seed carga OK (solo pruebas)');
  console.log(`  Usuarios: LOAD001900101 … LOAD${String(COUNT).padStart(3, '0')}900101`);
  console.log(`  Password temporal (todos): ${password}`);
  console.log(`  Grupo: ${groupId}`);
  console.log('  Limpieza: npm run seed:purge-demo');
}

seedLoad().catch((err) => {
  console.error('Seed carga falló:', err.message);
  process.exit(1);
});
