/** Utilidades del compositor de medios (pegar / editar / exportar). */

export function filesFromClipboard(clipboardData) {
  if (!clipboardData) return [];
  const out = [];
  const items = clipboardData.items;
  if (items?.length) {
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  if (!out.length && clipboardData.files?.length) {
    for (let i = 0; i < clipboardData.files.length; i += 1) {
      const f = clipboardData.files[i];
      if (f?.type?.startsWith('image/')) out.push(f);
    }
  }
  return out;
}

export function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith('image/')) return true;
  // Windows a veces deja type vacío; caemos a extensión
  const name = String(file.name || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|tif{1,2})$/i.test(name);
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas, { hd = true, type = 'image/jpeg' } = {}) {
  const quality = hd ? 0.92 : 0.72;
  const mime = type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('No se pudo exportar la imagen'));
        else resolve(blob);
      },
      mime,
      mime === 'image/jpeg' ? quality : undefined
    );
  });
}

/** Ajuste simple tipo “varita”: contraste/brillo leve. */
export function enhanceCanvas(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const contrast = 1.12;
  const brightness = 8;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.max(0, (d[i] - 128) * contrast + 128 + brightness));
    d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - 128) * contrast + 128 + brightness));
    d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - 128) * contrast + 128 + brightness));
  }
  ctx.putImageData(img, 0, 0);
}

/** Pincel mosaico / pixelado. */
export function mosaicAt(ctx, x, y, radius = 18, block = 8) {
  const sx = Math.max(0, Math.floor(x - radius));
  const sy = Math.max(0, Math.floor(y - radius));
  const sw = Math.min(ctx.canvas.width - sx, radius * 2);
  const sh = Math.min(ctx.canvas.height - sy, radius * 2);
  if (sw <= 0 || sh <= 0) return;
  const sample = ctx.getImageData(sx, sy, sw, sh);
  const d = sample.data;
  for (let py = 0; py < sh; py += block) {
    for (let px = 0; px < sw; px += block) {
      const i = (py * sw + px) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      for (let by = 0; by < block && py + by < sh; by += 1) {
        for (let bx = 0; bx < block && px + bx < sw; bx += 1) {
          const j = ((py + by) * sw + (px + bx)) * 4;
          d[j] = r;
          d[j + 1] = g;
          d[j + 2] = b;
          d[j + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(sample, sx, sy);
}

export const QUICK_EMOJIS = [
  '😀',
  '😂',
  '❤️',
  '🔥',
  '👍',
  '👏',
  '🙏',
  '😮',
  '😢',
  '⭐',
  '✅',
  '❌',
  '📍',
  '🚨',
  '📡',
  '🛡️',
];
