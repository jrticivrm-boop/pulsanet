/** Clasificación de adjuntos de chat (web) — alineada con backend uploads.js */

const VIDEO_EXT = /\.(mp4|mov|webm|mkv|avi|m4v|3gp)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|jfif|bmp)$/i;
const AUDIO_EXT = /\.(webm|ogg|mp3|m4a|wav|aac|opus)$/i;

export function extOf(name = '') {
  const m = String(name).toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : '';
}

export function isVideoMessage(message) {
  if (!message) return false;
  if (message.type === 'video') return true;
  const mime = (message.mediaMime || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return VIDEO_EXT.test(message.mediaName || '');
}

export function isImageMessage(message) {
  if (!message) return false;
  if (message.type === 'image') return true;
  const mime = (message.mediaMime || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return IMAGE_EXT.test(message.mediaName || '');
}

export function isAudioMessage(message) {
  if (!message) return false;
  if (message.type === 'audio') return true;
  const mime = (message.mediaMime || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  return AUDIO_EXT.test(message.mediaName || '');
}

/** type para FormData al subir */
export function classifyUploadFile(file) {
  if (!file) return 'file';
  const mime = (file.type || '').toLowerCase();
  const name = file.name || '';
  if (mime.startsWith('image/') || IMAGE_EXT.test(name)) return 'image';
  if (mime.startsWith('audio/') || AUDIO_EXT.test(name)) return 'audio';
  if (mime.startsWith('video/') || VIDEO_EXT.test(name)) return 'video';
  return 'file';
}

export function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKindIcon(name = '', mime = '') {
  const n = String(name).toLowerCase();
  const m = String(mime).toLowerCase();
  if (m.startsWith('video/') || VIDEO_EXT.test(n)) return '🎬';
  if (m.includes('pdf') || n.endsWith('.pdf')) return '📄';
  if (/\.(doc|docx)$/.test(n) || m.includes('word')) return '📝';
  if (/\.(xls|xlsx|csv)$/.test(n) || m.includes('sheet') || m.includes('excel')) return '📊';
  if (/\.(ppt|pptx)$/.test(n) || m.includes('presentation')) return '📑';
  if (/\.(zip|rar|7z|gz|tar)$/.test(n) || m.includes('zip') || m.includes('rar') || m.includes('7z')) {
    return '🗜️';
  }
  if (m.startsWith('audio/') || AUDIO_EXT.test(n)) return '🎵';
  return '📎';
}

/** accept= para input de documentos / archivos generales */
export const DOC_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.gz,.tar,.mp4,.mov,.webm,.mkv,.avi,.m4v,image/*,audio/*,video/*,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-7z-compressed';

export const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v,.3gp';
