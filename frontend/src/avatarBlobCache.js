const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Cache por userId (una entrada por usuario).
 * `avatarUrl` solo invalida si cambia (nueva foto); no se usa como clave
 * para evitar que la llamada (sin URL) borre la foto ya cargada en el chat.
 */
const entries = new Map();
/** userId → Promise en vuelo (dedupe). */
const inflight = new Map();

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Recorte circular JPEG pequeño para marcadores Leaflet. */
export function toCircularMarkerThumb(fullDataUrl, size = 88) {
  return new Promise((resolve) => {
    if (!fullDataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = fullDataUrl;
  });
}

async function fetchUserAvatarFull(userId, token) {
  const base = API_BASE || '';
  try {
    const res = await fetch(`${base}/api/avatars/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (
      blob.size > 0 &&
      (blob.type.startsWith('image/') || blob.type === 'application/octet-stream')
    ) {
      return blobToDataUrl(blob);
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function loadEntry(userId, token, avatarUrl) {
  const uid = String(userId || '');
  if (!uid || !token) return { full: null, thumb: null, avatarUrl: '' };

  const wantUrl = avatarUrl || '';
  const existing = entries.get(uid);
  // Reutilizar foto válida; revalidar solo si cambió avatarUrl conocido.
  if (existing?.full) {
    if (!wantUrl || !existing.avatarUrl || existing.avatarUrl === wantUrl) {
      return existing;
    }
  }
  // Miss cacheado sin foto: reintentar si ahora hay URL (antes no) o no hay miss reciente forzada.
  if (existing && existing.full === null && existing.avatarUrl === wantUrl) {
    return existing;
  }

  if (inflight.has(uid)) return inflight.get(uid);

  const job = (async () => {
    const full = await fetchUserAvatarFull(uid, token);
    const thumb = full ? await toCircularMarkerThumb(full) : null;
    const entry = { full, thumb, avatarUrl: wantUrl };
    // No pisar una foto buena con un miss (carrera llamada vs chat).
    const prev = entries.get(uid);
    if (!full && prev?.full) {
      return prev;
    }
    entries.set(uid, entry);
    return entry;
  })();

  inflight.set(uid, job);
  try {
    return await job;
  } finally {
    inflight.delete(uid);
  }
}

/** Lista lateral: foto completa. */
export async function fetchAvatarBlobUrl(userId, token, avatarUrl = '') {
  const entry = await loadEntry(userId, token, avatarUrl);
  return entry.full;
}

/** Marcador mapa: miniatura circular. */
export async function fetchAvatarMarkerThumb(userId, token, avatarUrl = '') {
  const entry = await loadEntry(userId, token, avatarUrl);
  return entry.thumb ?? entry.full;
}

export function hasAvatarEntry(userId, avatarUrl = '') {
  const e = entries.get(String(userId || ''));
  if (!e) return false;
  const want = avatarUrl || '';
  // Si hay foto, cuenta como lista (cualquier URL).
  if (e.full) return true;
  // Miss: solo si misma URL (evita no-reintentar cuando chat trae URL después).
  return e.avatarUrl === want;
}

export function peekAvatarBlobUrl(userId, avatarUrl = '') {
  void avatarUrl;
  const entry = entries.get(String(userId || ''));
  if (!entry) return undefined;
  return entry.full;
}

export function peekAvatarMarkerThumb(userId, avatarUrl = '') {
  void avatarUrl;
  const entry = entries.get(String(userId || ''));
  if (!entry) return undefined;
  return entry.thumb ?? entry.full;
}

export function invalidateAvatarBlob(userId, avatarUrl = '') {
  void avatarUrl;
  entries.delete(String(userId || ''));
}

/** Solo para logout / cambio de sesión. No usar al desmontar un mapa. */
export function clearAvatarBlobCache() {
  entries.clear();
  inflight.clear();
}

function groupCacheKey(groupId, avatarUrl) {
  return `group:${groupId}:${avatarUrl || ''}`;
}

async function loadGroupEntry(groupId, token, avatarUrl) {
  const key = groupCacheKey(groupId, avatarUrl);
  if (entries.has(key)) return entries.get(key);

  for (const k of [...entries.keys()]) {
    if (!k.startsWith(`group:${groupId}:`) || k === key) continue;
    entries.delete(k);
  }

  const base = API_BASE || '';
  let full = null;
  try {
    const res = await fetch(`${base}/api/avatars/group/${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const blob = await res.blob();
      if (
        blob.size > 0 &&
        (blob.type.startsWith('image/') || blob.type === 'application/octet-stream')
      ) {
        full = await blobToDataUrl(blob);
      }
    }
  } catch {
    full = null;
  }

  const entry = { full, thumb: null };
  entries.set(key, entry);
  return entry;
}

export async function fetchGroupAvatarBlobUrl(groupId, token, avatarUrl = '') {
  if (!groupId || !token) return null;
  const entry = await loadGroupEntry(groupId, token, avatarUrl);
  return entry.full;
}

export function peekGroupAvatarBlobUrl(groupId, avatarUrl = '') {
  const entry = entries.get(groupCacheKey(groupId, avatarUrl));
  if (!entry) return undefined;
  return entry.full;
}

export function hasGroupAvatarEntry(groupId, avatarUrl = '') {
  return entries.has(groupCacheKey(groupId, avatarUrl));
}

export function invalidateGroupAvatarBlob(groupId, avatarUrl = '') {
  entries.delete(groupCacheKey(groupId, avatarUrl));
}
