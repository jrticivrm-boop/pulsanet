import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'theme.dart';

final _linkRe = RegExp(
  r'(https?://[^\s<>"]+|www\.[^\s<>"]+|geo:[^\s<>"]+|mailto:[^\s<>"]+|tel:\+?[\d()\-\s.]{7,})',
  caseSensitive: false,
);

final _trailPunct = RegExp(r'[),.;:!?]+$');

String _normalizeHref(String raw) {
  var s = raw.trim();
  while (_trailPunct.hasMatch(s)) {
    s = s.replaceFirst(_trailPunct, '');
  }
  if (s.toLowerCase().startsWith('www.')) return 'https://$s';
  return s;
}

Future<void> openChatLink(String raw) async {
  final href = _normalizeHref(raw);
  if (href.isEmpty) return;
  final uri = Uri.tryParse(href);
  if (uri == null) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    /* ignore */
  }
}

/// Texto de burbuja con links tocables (http, www, geo, mailto, tel).
class LinkifiedText extends StatelessWidget {
  const LinkifiedText(
    this.text, {
    super.key,
    this.style,
    this.linkColor = kInstOliveMid,
  });

  final String text;
  final TextStyle? style;
  final Color linkColor;

  @override
  Widget build(BuildContext context) {
    final base = style ??
        const TextStyle(fontSize: 15.5, height: 1.28, color: kInstInk);
    final spans = <InlineSpan>[];
    var start = 0;
    for (final m in _linkRe.allMatches(text)) {
      if (m.start > start) {
        spans.add(TextSpan(text: text.substring(start, m.start)));
      }
      var matched = m.group(0)!;
      var trail = '';
      final tm = _trailPunct.firstMatch(matched);
      if (tm != null) {
        trail = tm.group(0)!;
        matched = matched.substring(0, matched.length - trail.length);
      }
      if (matched.isNotEmpty) {
        final href = matched;
        spans.add(
          TextSpan(
            text: matched,
            style: base.copyWith(
              color: linkColor,
              decoration: TextDecoration.underline,
              decorationColor: linkColor,
              fontWeight: FontWeight.w600,
            ),
            recognizer: TapGestureRecognizer()
              ..onTap = () {
                openChatLink(href);
              },
          ),
        );
      }
      if (trail.isNotEmpty) {
        spans.add(TextSpan(text: trail));
      }
      start = m.end;
    }
    if (start < text.length) {
      spans.add(TextSpan(text: text.substring(start)));
    }
    if (spans.isEmpty) {
      return Text(text, softWrap: true, style: base);
    }
    return Text.rich(
      TextSpan(style: base, children: spans),
      softWrap: true,
    );
  }
}
