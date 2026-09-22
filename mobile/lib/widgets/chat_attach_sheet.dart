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

/// Confirmación previa al enviar (caption opcional). `null` = cancelar.
Future<String?> showMediaSendConfirm(
  BuildContext context, {
  required String path,
  required String kind,
  String? filename,
  String? initialCaption,
}) {
  final name = (filename ?? path.split(Platform.pathSeparator).last).trim();
  final ctrl = TextEditingController(text: initialCaption ?? '');
  String title = 'Enviar archivo';
  if (kind == 'image') title = 'Enviar imagen';
  if (kind == 'video') title = 'Enviar video';
  if (kind == 'file') title = 'Enviar documento';

  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: kInstSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      // viewInsets = teclado; SafeArea = barra nav / taskbar tablet (Galaxy).
      final keyboard = MediaQuery.viewInsetsOf(ctx).bottom;
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
                Text(
                  name.isEmpty ? 'Archivo' : name,
                  style: const TextStyle(color: kInstMuted, fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: ctrl,
                  maxLines: 3,
                  minLines: 1,
                  decoration: const InputDecoration(
                    hintText: 'Mensaje (opcional)',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Cancelar'),
                    ),
                    const Spacer(),
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: kInstOlive),
                      onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
                      child: const Text('Enviar'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    },
  ).whenComplete(ctrl.dispose);
}
