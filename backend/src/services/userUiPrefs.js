import { query } from '../db.js';

function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return {};
}

/** Deep-merge superficial de un nivel + objetos anidados de un nivel. */
function mergePrefs(base, patch) {
  const out = { ...asObject(base) };
  for (const [k, v] of Object.entries(asObject(patch))) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...asObject(out[k]), ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function getUserUiPrefs(userId) {
  const { rows } = await query(`SELECT ui_prefs FROM users WHERE id = $1`, [userId]);
  return asObject(rows[0]?.ui_prefs);
}

export async function patchUserUiPrefs(userId, patch) {
  const current = await getUserUiPrefs(userId);
  const next = mergePrefs(current, patch);
  await query(`UPDATE users SET ui_prefs = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
    userId,
    JSON.stringify(next),
  ]);
  return next;
}
