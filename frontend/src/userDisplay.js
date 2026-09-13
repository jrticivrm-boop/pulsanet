/**
 * Etiqueta visible en chat/radio (indicativo: SGTO GOMEZ, B.O. LINARES…).
 * Usa displayName de BD (callSign); fallback a username.
 */
export function userDisplayLabel(user, fallback = 'Usuario') {
  const name = String(user?.displayName || '').trim();
  if (name) return name;
  const username = String(user?.username || '').trim();
  if (username) return username;
  return fallback;
}

/** Subtítulo: usuario de login · rol */
export function userDisplaySubtitle(user) {
  const parts = [];
  const username = String(user?.username || '').trim();
  if (username) parts.push(username);
  const role = String(user?.role || '').trim();
  if (role) parts.push(role);
  return parts.join(' · ');
}
