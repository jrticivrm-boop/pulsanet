// Clasificación de adjuntos (app) — alineada con backend uploads.js

bool isImageMedia({String? type, String? mime, String? name}) {
  if (type == 'image') return true;
  final m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return true;
  return RegExp(r'\.(jpe?g|png|gif|webp|jfif|bmp)$', caseSensitive: false)
      .hasMatch(name ?? '');
}

bool isVideoMedia({String? type, String? mime, String? name}) {
  if (type == 'video') return true;
  final m = (mime ?? '').toLowerCase();
  if (m.startsWith('video/')) return true;
  return RegExp(r'\.(mp4|mov|webm|mkv|avi|m4v|3gp)$', caseSensitive: false)
      .hasMatch(name ?? '');
}

bool isAudioMedia({String? type, String? mime, String? name}) {
  if (type == 'audio') return true;
  final m = (mime ?? '').toLowerCase();
  if (m.startsWith('audio/')) return true;
  return RegExp(r'\.(webm|ogg|mp3|m4a|wav|aac|opus)$', caseSensitive: false)
      .hasMatch(name ?? '');
}

/// Valor de `type` para multipart (video se envía como video; backend guarda file).
String classifyUploadName(String name, {String? mime}) {
  if (isImageMedia(mime: mime, name: name)) return 'image';
  if (isAudioMedia(mime: mime, name: name)) return 'audio';
  if (isVideoMedia(mime: mime, name: name)) return 'video';
  return 'file';
}

String fileKindEmoji(String? name, String? mime) {
  final n = (name ?? '').toLowerCase();
  final m = (mime ?? '').toLowerCase();
  if (isVideoMedia(mime: mime, name: name)) return '🎬';
  if (m.contains('pdf') || n.endsWith('.pdf')) return '📄';
  if (n.endsWith('.doc') || n.endsWith('.docx') || m.contains('word')) return '📝';
  if (n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return '📊';
  if (RegExp(r'\.(zip|rar|7z|gz|tar)$').hasMatch(n)) return '🗜️';
  return '📎';
}

String formatBytes(int? n) {
  final bytes = n ?? 0;
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
