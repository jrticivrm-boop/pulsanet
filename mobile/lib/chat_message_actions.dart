import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme.dart';

const kChatReactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/// Resultado del menú contextual estilo WhatsApp.
class ChatMsgAction {
  const ChatMsgAction(this.id, {this.emoji});
  final String id;
  final String? emoji;
}

/// Sheet estilo WhatsApp: fila de reacciones + acciones.
Future<ChatMsgAction?> showChatMessageActionsSheet({
  required BuildContext context,
  required bool mine,
  required bool isDeleted,
  required bool hasText,
  required bool hasMedia,
  bool canReply = true,
  bool canReact = true,
  bool canCopy = true,
  bool canForward = true,
  bool canPin = true,
  bool isPinned = false,
  bool canEdit = false,
  bool canDelete = false,
  bool canDownload = false,
}) {
  if (isDeleted) {
    return showModalBottomSheet<ChatMsgAction>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Text(
                'Mensaje eliminado',
                style: TextStyle(fontWeight: FontWeight.w700, color: kInstMuted),
              ),
            ),
            if (canDelete)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: kRadioDanger),
                title: const Text('Eliminar', style: TextStyle(color: kRadioDanger)),
                onTap: () => Navigator.pop(ctx, const ChatMsgAction('delete')),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  return showModalBottomSheet<ChatMsgAction>(
    context: context,
    backgroundColor: kTacSurface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              if (canReact) ...[
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F2F5),
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        for (final e in kChatReactionEmojis)
                          InkWell(
                            borderRadius: BorderRadius.circular(20),
                            onTap: () => Navigator.pop(ctx, ChatMsgAction('react', emoji: e)),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Text(e, style: const TextStyle(fontSize: 28)),
                            ),
                          ),
                        InkWell(
                          borderRadius: BorderRadius.circular(20),
                          onTap: () => Navigator.pop(ctx, const ChatMsgAction('react_more')),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6),
                            child: Icon(Icons.add_circle_outline, color: kInstMuted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 8),
              if (canReply)
                _actionTile(
                  ctx,
                  icon: Icons.reply,
                  label: 'Responder',
                  id: 'reply',
                ),
              if (canCopy && hasText)
                _actionTile(
                  ctx,
                  icon: Icons.copy_outlined,
                  label: 'Copiar',
                  id: 'copy',
                ),
              if (canForward)
                _actionTile(
                  ctx,
                  icon: Icons.shortcut,
                  label: 'Reenviar',
                  id: 'forward',
                ),
              if (canPin)
                _actionTile(
                  ctx,
                  icon: isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                  label: isPinned ? 'Desfijar' : 'Fijar',
                  id: isPinned ? 'unpin' : 'pin',
                ),
              if (canDownload && hasMedia)
                _actionTile(
                  ctx,
                  icon: Icons.download_outlined,
                  label: 'Descargar',
                  id: 'download',
                ),
              if (canEdit)
                _actionTile(
                  ctx,
                  icon: Icons.edit_outlined,
                  label: 'Editar',
                  id: 'edit',
                ),
              if (canDelete)
                _actionTile(
                  ctx,
                  icon: Icons.delete_outline,
                  label: 'Eliminar',
                  id: 'delete',
                  danger: true,
                ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      );
    },
  );
}

Widget _actionTile(
  BuildContext ctx, {
  required IconData icon,
  required String label,
  required String id,
  bool danger = false,
}) {
  return ListTile(
    leading: Icon(icon, color: danger ? kRadioDanger : kInstInk),
    title: Text(
      label,
      style: TextStyle(
        fontWeight: FontWeight.w600,
        color: danger ? kRadioDanger : kInstInk,
      ),
    ),
    onTap: () => Navigator.pop(ctx, ChatMsgAction(id)),
  );
}

Future<void> copyChatText(String text) async {
  await Clipboard.setData(ClipboardData(text: text));
}

String chatForwardPreview({
  required String type,
  String? body,
  String? mediaName,
  bool isDeleted = false,
}) {
  if (isDeleted) return 'Mensaje eliminado';
  final t = type.toLowerCase();
  if (t == 'image') return body?.trim().isNotEmpty == true ? body!.trim() : '📷 Imagen';
  if (t == 'audio') return '🎤 Audio';
  if (t == 'video') return '🎬 Video';
  if (t == 'sticker') return 'Sticker';
  if (t == 'file') return mediaName?.isNotEmpty == true ? '📎 $mediaName' : '📎 Archivo';
  final b = body?.trim() ?? '';
  return b.isNotEmpty ? b : 'Mensaje';
}

/// Fijado local por conversación (grupo o DM).
class ChatPinStore {
  static String _key(String scopeId) => 'chat_pin_v1_$scopeId';

  static Future<Map<String, String>?> get(String scopeId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(scopeId));
    if (raw == null || raw.isEmpty) return null;
    final parts = raw.split('\u001f');
    if (parts.length < 3) return null;
    return {
      'id': parts[0],
      'title': parts[1],
      'preview': parts[2],
    };
  }

  static Future<void> set({
    required String scopeId,
    required String messageId,
    required String title,
    required String preview,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key(scopeId),
      '$messageId\u001f${title.replaceAll('\u001f', ' ')}\u001f${preview.replaceAll('\u001f', ' ')}',
    );
  }

  static Future<void> clear(String scopeId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(scopeId));
  }
}

/// Elige un contacto para reenviar.
Future<Map<String, dynamic>?> pickForwardContact({
  required BuildContext context,
  required Future<List<Map<String, dynamic>>> Function() loadContacts,
}) async {
  final contacts = await loadContacts();
  if (!context.mounted) return null;
  if (contacts.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('No hay contactos para reenviar')),
    );
    return null;
  }
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    backgroundColor: kTacSurface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(ctx).height * 0.55,
          child: Column(
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Reenviar a…',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView.builder(
                  itemCount: contacts.length,
                  itemBuilder: (_, i) {
                    final c = contacts[i];
                    final name = c['displayName']?.toString() ?? 'Usuario';
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: kInstOlive.withValues(alpha: 0.15),
                        child: Text(
                          name.isNotEmpty ? name[0].toUpperCase() : '?',
                          style: const TextStyle(
                            color: kInstOlive,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(c['role']?.toString() ?? ''),
                      onTap: () => Navigator.pop(ctx, c),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
