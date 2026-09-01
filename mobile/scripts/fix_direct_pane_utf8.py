# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(r"C:\pulsanet\mobile\lib\screens\direct_pane.dart")
text = p.read_text(encoding="utf-8")

fixes = [
    (r"title: const Text\('Galer[^']*'\)", "title: const Text('Galería')"),
    (r"title: const Text\('C[^']*mara'\)", "title: const Text('Cámara')"),
    (
        r"subtitle: const Text\('PDF, Word, Excel, ZIP, RAR[^']*'\)",
        "subtitle: const Text('PDF, Word, Excel, ZIP, RAR…')",
    ),
    (
        r"hintText: _uploading \? '[^']*' : 'Mensaje'",
        "hintText: _uploading ? 'Subiendo…' : 'Mensaje'",
    ),
    (r"'Sin mensajes a[^']*'", "'Sin mensajes aún'"),
    (
        r"\(replySnapshot\['senderId'\] == me \? 'T[^']*' : _peer",
        "(replySnapshot['senderId'] == me ? 'Tú' : _peer",
    ),
    (r"\? 'T[^']*'\s*\n(\s*): _peerName", "? 'Tú'\n\\1: _peerName"),
    (
        r"content: Text\('Se borrar[^']*\$name[^']*'\)",
        "content: Text('Se borrarán todos los mensajes con «$name» para ambos.')",
    ),
    (
        r"final emoji = video \? '[^']*' : fileKindEmoji",
        "final emoji = video ? '🎬' : fileKindEmoji",
    ),
    (
        r"\]\.where\(\(e\) => e\.isNotEmpty\)\.join\('[^']*'\)",
        "].where((e) => e.isNotEmpty).join(' · ')",
    ),
    (
        r"/// Si viene de notificaci[^\n]*",
        "/// Si viene de notificación DM, abre ese hilo al cargar contactos.",
    ),
    (
        r"/// Solo hilo \(desde inbox\):[^\n]*",
        "/// Solo hilo (desde inbox): sin lista de contactos; atrás cierra la ruta.",
    ),
    (
        r"/// Sesi[^\n]*",
        "/// Sesión radio personal activa (barra PTT, no pantalla de llamada).",
    ),
    (
        r"// Tap en notificaci[^\n]*",
        "// Tap en notificación: abrir hilo al instante (sin esperar lista de contactos).",
    ),
]

# Fix the Tú ternary used for reply label in forward (multiline)
text2 = text
for pat, rep in fixes:
    text2, n = re.subn(pat, rep, text2, count=5)
    print(f"{n:2d}  {pat[:50]}")

# Specific multiline for '? \'T\' : _peerName' style around line 690
text2, n = re.subn(
    r"\? 'T[^']*'\s*: _peerName",
    "? 'Tú' : _peerName",
    text2,
)
print(f"{n:2d}  peerName Tú")

p.write_text(text2, encoding="utf-8")

# verify key lines
for i, line in enumerate(text2.splitlines(), 1):
    if i in (37, 39, 58, 74, 264, 359, 446, 451, 462, 690, 1018, 1313, 1432, 1467):
        print(f"{i}: {line.encode('unicode_escape').decode()}")
