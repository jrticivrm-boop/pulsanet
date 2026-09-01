import 'package:flutter/material.dart';

import 'theme.dart';

/// Fondo y burbujas estilo chat institucional (claro).
const Color kChatBg = kTacBg;
const Color kBubbleMine = kTacBubbleMine;
const Color kBubbleOther = kTacBubbleOther;
const Color kChatMeta = Color(0xFF7A8574);
const Color kTickRead = Color(0xFF34B7F1);
const Color kComposerBar = kTacInputBar;

BorderRadius chatBubbleRadius({
  required bool mine,
  bool clusteredAbove = false,
  bool clusteredBelow = false,
}) {
  const r = 14.0;
  const soft = 6.0;
  const tip = 4.0;
  return BorderRadius.only(
    topLeft: Radius.circular(mine ? r : (clusteredAbove ? soft : r)),
    topRight: Radius.circular(mine ? (clusteredAbove ? soft : r) : r),
    bottomLeft: Radius.circular(mine ? r : (clusteredBelow ? soft : tip)),
    bottomRight: Radius.circular(mine ? (clusteredBelow ? soft : tip) : r),
  );
}

EdgeInsets chatBubbleOuterPadding({
  required bool mine,
  bool clusteredAbove = false,
  bool clusteredBelow = false,
}) {
  return EdgeInsets.only(
    top: clusteredAbove ? 1.5 : 7,
    bottom: clusteredBelow ? 1.5 : 7,
    left: mine ? 52 : 12,
    right: mine ? 12 : 52,
  );
}

double chatBubbleMinWidth({required bool showMeta}) => showMeta ? 68 : 0;

Widget chatBubbleFramedContent({
  required EdgeInsets padding,
  required Widget body,
  required Widget meta,
}) {
  return Padding(
    padding: padding,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        body,
        Align(
          alignment: Alignment.centerRight,
          child: meta,
        ),
      ],
    ),
  );
}

class ChatBubbleMeta extends StatelessWidget {
  const ChatBubbleMeta({
    super.key,
    required this.time,
    this.mine = false,
    this.read = false,
    this.pending = false,
    this.edited = false,
  });

  final String time;
  final bool mine;
  final bool read;
  final bool pending;
  final bool edited;

  @override
  Widget build(BuildContext context) {
    if (time.isEmpty && !mine && !edited) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (edited)
          const Text(
            'editado  ',
            style: TextStyle(fontSize: 10, color: kChatMeta, fontStyle: FontStyle.italic),
          ),
        if (time.isNotEmpty)
          Text(
            time,
            style: const TextStyle(
              fontSize: 11,
              height: 1,
              color: kChatMeta,
              fontWeight: FontWeight.w400,
            ),
          ),
        if (mine) ...[
          const SizedBox(width: 3),
          Icon(
            pending ? Icons.access_time : Icons.done_all,
            size: 15,
            color: pending
                ? kChatMeta
                : (read ? kTickRead : kChatMeta),
          ),
        ],
      ],
    );
  }
}
