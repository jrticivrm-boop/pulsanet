/**
 * Restablece contraseña temporal del root atacticalptxr2 (ops local).
 * Uso: node src/scripts/reset-root-password.js
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { generateTemporaryPassword } from '../services/tempPassword.js';

const USERNAME = process.env.RESET_USERNAME || 'atacticalptxr2';
const temporaryPassword = process.env.RESET_PASSWORD || generateTemporaryPassword();
const hash = await bcrypt.hash(temporaryPassword, 12);

const { rows } = await query(
  `UPDATE users
   SET password_hash = $1,
       must_change_password = TRUE,
       is_active = TRUE,
       updated_at = NOW()
   WHERE LOWER(username) = LOWER($2)
   RETURNING username, role, display_name`,
  [hash, USERNAME]
);

if (!rows[0]) {
  console.error(`Usuario no encontrado: ${USERNAME}`);
  process.exit(1);
}

console.log(`OK ${rows[0].username} (${rows[0].role})`);
console.log(`Contraseña temporal: ${temporaryPassword}`);
console.log('Debe cambiarse en el primer ingreso.');
