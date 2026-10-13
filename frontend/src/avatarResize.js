const MAX_SIDE = 640;
const SKIP_BYTES = 180 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('img'));
    };
    img.src = url;
  });
}

/**
 * Reduce una foto de perfil / icono de grupo a ≤ 640 px antes de subirla.
 * Las fotos de cámara (varios MB) se ven en círculos de ~50 px; subirlas tal cual
 * hace lenta la carga en la app. Si algo falla, devuelve el archivo original.
 */
export async function shrinkAvatarFile(file) {
  if (!(file instanceof Blob)) return file;
  const type = (file.type || '').toLowerCase();
  if (type === 'image/gif' || type === 'image/svg+xml') return file;
  try {
    const img = await loadImage(file);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return file;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    if (scale === 1 && file.size <= SKIP_BYTES) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const keepAlpha = type === 'image/png' || type === 'image/webp';
    const outType = keepAlpha ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, 0.86));
    if (!blob || blob.size >= file.size) return file;
    const ext = outType === 'image/webp' ? 'webp' : 'jpg';
    const base = (file.name || 'avatar').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${ext}`, { type: outType });
  } catch {
    return file;
  }
}
