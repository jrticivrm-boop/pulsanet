const API_BASE = import.meta.env.VITE_API_URL || '';

/** key → { full: dataUrl|null, thumb: dataUrl|null } */
const entries = new Map();

function cacheKey(userId, avatarUrl) {
  return `${userId}:${avatarUrl || ''}`;
}

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

async function loadEntry(userId, token, avatarUrl) {
  const key = cacheKey(userId, avatarUrl);
  if (entries.has(key)) return entries.get(key);

  for (const k of [...entries.keys()]) {
    if (!k.startsWith(`${userId}:`) || k === key) continue;
    entries.delete(k);
  }

  const base = API_BASE || '';
  let full = null;
  try {
    const res = await fetch(`${base}/api/avatars/${encodeURIComponent(userId)}`, {
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

  const thumb = full ? await toCircularMarkerThumb(full) : null;
  const entry = { full, thumb };
  entries.set(key, entry);
  return entry;
}

/** Lista lateral: foto completa. */
export async function fetchAvatarBlobUrl(userId, token, avatarUrl = '') {
  const entry = await loadEntry(userId, token, avatarUrl);
  return entry.full;
}

/** Marcador mapa: miniatura circular. */
export async function fetchAvatarMarkerThumb(userId, token, avatarUrl = '') {
  const entry = await loadEntry(userId, token, avatarUrl);
  return entry.thumb;
}

export function hasAvatarEntry(userId, avatarUrl = '') {
  return entries.has(cacheKey(userId, avatarUrl));
}

export function peekAvatarBlobUrl(userId, avatarUrl = '') {
  const entry = entries.get(cacheKey(userId, avatarUrl));
  if (!entry) return undefined;
  return entry.full;
}

export function peekAvatarMarkerThumb(userId, avatarUrl = '') {
  const entry = entries.get(cacheKey(userId, avatarUrl));
  if (!entry) return undefined;
  return entry.thumb ?? entry.full;
}

export function invalidateAvatarBlob(userId, avatarUrl = '') {
  entries.delete(cacheKey(userId, avatarUrl));
}

export function clearAvatarBlobCache() {
  entries.clear();
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

export function invalidateGroupAvatarBlob(groupId, avatarUrl = '') {
  entries.delete(groupCacheKey(groupId, avatarUrl));
}
