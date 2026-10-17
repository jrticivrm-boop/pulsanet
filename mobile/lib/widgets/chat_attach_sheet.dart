import 'dart:io';

import 'package:flutter/material.dart';

import '../theme.dart';

/// Menú adjuntar DM / chat — alineado con web (Imagen, Cámara, Video, Documento).
Future<String?> showChatAttachSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: kInstSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Text(
              'Adjuntar',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.image_outlined, color: kInstOlive),
            title: const Text('Imagen'),
            subtitle: const Text('Galería de fotos'),
            onTap: () => Navigator.pop(ctx, 'gallery'),
          ),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined, color: kInstOlive),
            title: const Text('Cámara'),
            onTap: () => Navigator.pop(ctx, 'camera'),
          ),
          ListTile(
            leading: const Icon(Icons.videocam_outlined, color: kInstOlive),
            title: const Text('Video'),
            onTap: () => Navigator.pop(ctx, 'video'),
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined, color: kInstOlive),
            title: const Text('Documento / archivo'),
            subtitle: const Text('PDF, Office, ZIP, texto…'),
            onTap: () => Navigator.pop(ctx, 'file'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

/// Resultado del sheet de confirmación de media.
class MediaSendConfirmResult {
  const MediaSendConfirmResult({required this.caption, this.viewOnce = false});
  final String caption;
  final bool viewOnce;
}

/// Confirmación previa al enviar (caption opcional). `null` = cancelar.
/// [allowViewOnce] solo en DM imagen/video.
Future<MediaSendConfirmResult?> showMediaSendConfirm(
  BuildContext context, {
  required String path,
  required String kind,
  String? filename,
  String? initialCaption,
  bool allowViewOnce = false,
}) {
  final name = (filename ?? path.split(Platform.pathSeparator).last).trim();
  final ctrl = TextEditingController(text: initialCaption ?? '');
  String title = 'Enviar archivo';
  if (kind == 'image') title = 'Enviar imagen';
  if (kind == 'video') title = 'Enviar video';
  if (kind == 'file') title = 'Enviar documento';
  final canViewOnce = allowViewOnce && (kind == 'image' || kind == 'video');
  final showThumb = kind == 'image' && File(path).existsSync();

  return showModalBottomSheet<MediaSendConfirmResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: kInstSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      var viewOnce = false;
      // viewInsets = teclado; SafeArea = barra nav / taskbar tablet (Galaxy).
      final keyboard = MediaQuery.viewInsetsOf(ctx).bottom;
      return StatefulBuilder(
        builder: (ctx, setModal) {
          void submit() {
            Navigator.pop(
              ctx,
              MediaSendConfirmResult(
                caption: ctrl.text.trim(),
                viewOnce: canViewOnce && viewOnce,
              ),
            );
          }

          return Padding(
            padding: EdgeInsets.only(bottom: keyboard),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 8),
                    if (showThumb) ...[
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(
                          File(path),
                          height: 120,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      name.isEmpty ? 'Archivo' : name,
                      style: const TextStyle(color: kInstMuted, fontSize: 13),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: ctrl,
                      autofocus: true,
                      maxLines: 3,
                      minLines: 1,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => submit(),
                      decoration: const InputDecoration(
                        hintText: 'Mensaje (opcional)',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    if (canViewOnce) ...[
                      const SizedBox(height: 4),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        title: const Text('Ver una vez', style: TextStyle(fontSize: 14)),
                        subtitle: const Text(
                          'Se elimina tras abrirla el destinatario',
                          style: TextStyle(fontSize: 12, color: kInstMuted),
                        ),
                        value: viewOnce,
                        activeTrackColor: kInstOlive.withValues(alpha: 0.45),
                        onChanged: (v) => setModal(() => viewOnce = v),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Cancelar'),
                        ),
                        const Spacer(),
                        FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: kInstOlive),
                          onPressed: submit,
                          child: Text(viewOnce ? 'Enviar · 1 vez' : 'Enviar'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    },
  ).whenComplete(ctrl.dispose);
}
