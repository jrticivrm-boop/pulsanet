import 'dart:async';

import 'package:flutter/material.dart';

import 'message_tone.dart';

/// Globo de mensaje estilo WhatsApp Web — visible en cualquier pantalla de la app.
class ChatMessageBannerPayload {
  ChatMessageBannerPayload({
    required this.kind,
    required this.title,
    required this.preview,
    this.peerId,
    this.groupId,
  });

  final String kind; // dm | group
  final String title;
  final String preview;
  final String? peerId;
  final String? groupId;
}

class ChatMessageBanner {
  ChatMessageBanner._();

  static final ChatMessageBanner instance = ChatMessageBanner._();

  final ValueNotifier<ChatMessageBannerPayload?> visible =
      ValueNotifier<ChatMessageBannerPayload?>(null);

  Timer? _timer;
  void Function(ChatMessageBannerPayload)? onTap;

  void show({
    required String kind,
    required String title,
    required String preview,
    String? peerId,
    String? groupId,
    bool playTone = true,
  }) {
    if (playTone) {
      // ignore: unawaited_futures
      playMessageNotificationTone();
    }
    visible.value = ChatMessageBannerPayload(
      kind: kind,
      title: title,
      preview: preview,
      peerId: peerId,
      groupId: groupId,
    );
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 9), dismiss);
  }

  void dismiss() {
    _timer?.cancel();
    visible.value = null;
  }

  void handleTap() {
    final p = visible.value;
    if (p == null) return;
    dismiss();
    onTap?.call(p);
  }
}

class ChatMessageBannerOverlay extends StatelessWidget {
  const ChatMessageBannerOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ChatMessageBannerPayload?>(
      valueListenable: ChatMessageBanner.instance.visible,
      builder: (context, payload, _) {
        if (payload == null) return const SizedBox.shrink();
        final title = payload.title.trim().isEmpty ? 'Mensaje' : payload.title;
        final initial =
            title.isNotEmpty ? title.characters.first.toUpperCase() : '?';
        return SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            child: Material(
              color: const Color(0xFF202C33),
              elevation: 12,
              shadowColor: Colors.black54,
              borderRadius: BorderRadius.circular(10),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: ChatMessageBanner.instance.handleTap,
                child: Container(
                  decoration: const BoxDecoration(
                    border: Border(
                      left: BorderSide(color: Color(0xFF25D366), width: 4),
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: const Color(0xFF3D5A45),
                        child: Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xFFE9EDEF),
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              payload.preview,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: const Color(0xFFE9EDEF).withValues(alpha: 0.75),
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Cerrar',
                        onPressed: ChatMessageBanner.instance.dismiss,
                        icon: Icon(
                          Icons.close,
                          size: 20,
                          color: const Color(0xFFE9EDEF).withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
