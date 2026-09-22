import 'dart:io';
import 'dart:ui';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'api_client.dart';
import 'media_kind.dart';

/// Texto que se puede copiar: mensaje, pie de foto/video/archivo, o «¡Zumbido!».
/// Stickers y adjuntos sin texto no cuentan.
String? dmMessageCopyText(Map<String, dynamic> m) {
  if (m['isDeleted'] == true) return null;
  final type = (m['type']?.toString() ?? 'text').toLowerCase();
  if (type == 'nudge') return '¡Zumbido!';
  if (type == 'sticker') return null;
  final body = (m['body']?.toString() ?? '').trim();
  if (body.isEmpty || body == 'nudge') return null;
  return body;
}

/// Texto para la hoja de compartir (incluye el emoji del sticker).
String? dmMessageShareText(Map<String, dynamic> m) {
  final copy = dmMessageCopyText(m);
  if (copy != null) return copy;
  if (m['isDeleted'] == true) return null;
  if ((m['type']?.toString() ?? '').toLowerCase() != 'sticker') return null;
  final sticker = m['sticker'];
  if (sticker is! Map) return null;
  final value = sticker['value']?.toString().trim() ?? '';
  return value.isEmpty ? null : value;
}

class DmShareResult {
  const DmShareResult({required this.shared, required this.omittedFiles});
  final bool shared;
  final int omittedFiles;
}

/// Comparte texto y archivos que ya están en disco. No descarga.
Future<DmShareResult> shareDmMessages({
  required ApiClient api,
  required List<Map<String, dynamic>> messages,
  Rect? sharePositionOrigin,
}) async {
  final lines = <String>[];
  final files = <XFile>[];
  final seenPaths = <String>{};
  var omitted = 0;

  for (final m in messages) {
    if (m['isDeleted'] == true) continue;
    final text = dmMessageShareText(m);
    if (text != null) lines.add(text);

    final url = m['mediaUrl']?.toString() ?? '';
    if (url.isEmpty) continue;
    final local = await _existingLocalMedia(api, m);
    if (local == null) {
      omitted++;
      continue;
    }
    if (!seenPaths.add(local.path)) continue;
    final name = m['mediaName']?.toString();
    files.add(XFile(
      local.path,
      name: (name != null && name.isNotEmpty) ? name : p.basename(local.path),
      mimeType: m['mediaMime']?.toString(),
    ));
  }

  final body = lines.join('\n').trim();
  if (files.isEmpty && body.isEmpty) {
    return DmShareResult(shared: false, omittedFiles: omitted);
  }
  if (files.isEmpty) {
    await Share.share(body, sharePositionOrigin: sharePositionOrigin);
  } else {
    await Share.shareXFiles(
      files,
      text: body.isEmpty ? null : body,
      sharePositionOrigin: sharePositionOrigin,
    );
  }
  return DmShareResult(shared: true, omittedFiles: omitted);
}

/// Misma ruta que [ChatVoiceBubble] (`chat-audio-<hash>`) o el temporal
/// de «abrir» (`chat_<ts>_<nombre>`). No crea archivos nuevos.
Future<File?> _existingLocalMedia(ApiClient api, Map<String, dynamic> m) async {
  final url = m['mediaUrl']?.toString() ?? '';
  if (url.isEmpty) return null;
  final dir = await getTemporaryDirectory();
  final type = m['type']?.toString();
  final mime = m['mediaMime']?.toString();
  final name = m['mediaName']?.toString();

  if (isAudioMedia(type: type, mime: mime, name: name ?? url)) {
    final abs = api.mediaAbsoluteUrl(url);
    final ext = url.contains('.') ? p.extension(url.split('?').first) : '.m4a';
    final voice = File(p.join(dir.path, 'chat-audio-${abs.hashCode}$ext'));
    if (await voice.exists() && await voice.length() > 0) return voice;
  }

  final safe = (name ?? '').replaceAll(RegExp(r'[<>:"/\\|?*]'), '_');
  if (safe.isEmpty) return null;
  File? best;
  DateTime? bestAt;
  await for (final ent in dir.list()) {
    if (ent is! File) continue;
    final base = p.basename(ent.path);
    if (!base.startsWith('chat_') || !base.endsWith('_$safe')) continue;
    final modified = (await ent.stat()).modified;
    if (best == null || modified.isAfter(bestAt!)) {
      best = ent;
      bestAt = modified;
    }
  }
  if (best != null && await best.length() > 0) return best;
  return null;
}
