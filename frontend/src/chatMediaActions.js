/** Copiar texto, imagen o descargar archivos del chat (Clipboard / descarga). */

export async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function copyImageBlob(blob) {
  if (!blob?.size || !navigator.clipboard?.write) return false;
  try {
    // Chrome suele aceptar solo image/png en el portapapeles
    let payload = blob;
    let type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
    if (type !== 'image/png') {
      payload = await blobToPngBlob(blob);
      type = 'image/png';
    }
    await navigator.clipboard.write([new ClipboardItem({ [type]: payload })]);
    return true;
  } catch {
    try {
      const png = await blobToPngBlob(blob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return true;
    } catch {
      return false;
    }
  }
}

async function blobToPngBlob(blob) {
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
  });
}

export async function copyImageFromObjectUrl(objectUrl) {
  const res = await fetch(objectUrl);
  const blob = await res.blob();
  return copyImageBlob(blob);
}

export function downloadBlob(blob, filename) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename || 'archivo';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

export async function downloadFromObjectUrl(objectUrl, filename) {
  const res = await fetch(objectUrl);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

export function isImageMessage(message) {
  if (!message?.mediaUrl) return false;
  const name = message.mediaName || '';
  const mime = (message.mediaMime || '').toLowerCase();
  return (
    message.type === 'image' ||
    mime.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|jfif|bmp|heic)$/i.test(name)
  );
}

/** Extensión corta desde mime o nombre. */
function extFromMimeOrName(mime, name, fallback = '') {
  const fromName = String(name || '').match(/\.[a-z0-9]{1,8}$/i);
  if (fromName) return fromName[0].toLowerCase();
  const m = String(mime || '').split(';')[0].toLowerCase();
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/webm': '.webm',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/vnd.rar': '.rar',
  };
  return map[m] || fallback;
}

function looksGeneratedName(base) {
  if (!base) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.|$)/i.test(base)) {
    return true;
  }
  if (/^(blob|image|video|audio|file|capture|screenshot)(\.|$)/i.test(base) && base.length < 18) {
    return true;
  }
  return false;
}

/**
 * Nombre para mostrar / descargar:
 * conserva el nombre de origen si es legible; si no → Img.jpg, Video.mp4, Archivo.ext…
 */
export function friendlyMediaName(message) {
  const raw = String(message?.mediaName || '').trim();
  const base = raw.split(/[/\\]/).pop() || '';
  const mime = message?.mediaMime || '';
  const type = message?.type || '';

  if (base && !looksGeneratedName(base)) return base;

  if (type === 'image' || String(mime).startsWith('image/') || isImageMessage(message || {})) {
    return `Img${extFromMimeOrName(mime, base, '.jpg')}`;
  }
  if (type === 'video' || String(mime).startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(base)) {
    return `Video${extFromMimeOrName(mime, base, '.mp4')}`;
  }
  if (type === 'audio' || String(mime).startsWith('audio/')) {
    return `Audio${extFromMimeOrName(mime, base, '.m4a')}`;
  }
  const ext = extFromMimeOrName(mime, base, '');
  return ext ? `Archivo${ext}` : 'Archivo';
}

export function clampMenuPos(x, y, menuW = 220, menuH = 320) {
  const pad = 8;
  const maxX = window.innerWidth - menuW - pad;
  const maxY = window.innerHeight - menuH - pad;
  return {
    x: Math.max(pad, Math.min(x, maxX)),
    y: Math.max(pad, Math.min(y, maxY)),
  };
}
