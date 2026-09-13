const DEVICE_KEY = 'tacticalptx_device_id';

/** Id estable por navegador/equipo (localStorage). */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id && id.length >= 8) return id;
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/** Auth Socket.IO con token + deviceId. */
export function socketAuth(token) {
  const deviceId = getDeviceId();
  return deviceId ? { token, deviceId } : { token };
}
