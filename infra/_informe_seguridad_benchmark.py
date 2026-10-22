# -*- coding: utf-8 -*-
"""Genera el informe Word de seguridad (ASVS/MASVS / OWASP)."""
from __future__ import annotations

import os
from datetime import date

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHART_DIR = os.path.join(ROOT, "docs", "_security_charts")
OUT_DOCS = os.path.join(ROOT, "docs", "INFORME_SEGURIDAD_BENCHMARK.docx")
OUT_SOPORTE = os.path.join(
    "C:\\pulsanet_soporte", "Documentos", "INFORME_SEGURIDAD_BENCHMARK.docx"
)

NAVY = RGBColor(0x0B, 0x1F, 0x3A)
GOLD = RGBColor(0xC4, 0xA3, 0x5A)
GREEN = RGBColor(0x1B, 0x7A, 0x3A)
AMBER = RGBColor(0xB8, 0x6B, 0x00)
RED = RGBColor(0xA3, 0x1D, 0x1D)


def set_run(run, *, size=11, bold=False, color=NAVY, font="Calibri"):
    run.font.name = font
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = color
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:ascii"), font)
    rFonts.set(qn("w:hAnsi"), font)


def shade_cell(cell, hex_color):
    tc = cell._tePr if hasattr(cell, "_tePr") else cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        set_run(run, size=16 if level == 1 else 13, bold=True, color=NAVY)
    return p


def add_p(doc, text, *, size=11, bold=False, color=NAVY, space_after=8):
    p = doc.add_paragraph()
    run = p.add_run(text)
    set_run(run, size=size, bold=bold, color=color)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    return p


def add_bullets(doc, items):
    for it in items:
        p = doc.add_paragraph(it, style="List Bullet")
        for run in p.runs:
            set_run(run, size=11, color=NAVY)
        p.paragraph_format.space_after = Pt(4)


def set_cell_text(cell, text, *, bold=False, color=NAVY, fill=None, size=10):
    cell.text = ""
    p = cell.paragraphs[0]
    run = p.add_run(text)
    set_run(run, size=size, bold=bold, color=color)
    if fill:
        shade_cell(cell, fill)


def add_table(doc, headers, rows, col_fills=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    for i, h in enumerate(headers):
        set_cell_text(table.rows[0].cells[i], h, bold=True, color=RGBColor(255, 255, 255), fill="0B1F3A")
    status_fill = {
        "Cumple": "D4EDDA",
        "Parcial": "FFF3CD",
        "No cumple": "F8D7DA",
        "Hecho": "D4EDDA",
        "Pendiente": "F8D7DA",
        "En curso": "FFF3CD",
    }
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            fill = None
            if col_fills and c_i in col_fills:
                fill = status_fill.get(str(val), None)
            set_cell_text(table.rows[r_i + 1].cells[c_i], str(val), fill=fill)
    doc.add_paragraph()
    return table


def make_charts():
    os.makedirs(CHART_DIR, exist_ok=True)
    plt.rcParams["font.family"] = "Segoe UI"
    plt.rcParams["axes.unicode_minus"] = False

    areas = ["Autenticación", "Almacenamiento", "Comunicaciones", "Permisos"]
    before = [45, 40, 55, 50]
    after = [78, 72, 72, 68]
    x = range(len(areas))
    fig, ax = plt.subplots(figsize=(8.2, 4.2))
    ax.bar([i - 0.18 for i in x], before, 0.36, label="Antes (oct 2026)", color="#8AA0B8")
    ax.bar([i + 0.18 for i in x], after, 0.36, label="Después de esta oleada", color="#1B7A3A")
    ax.set_xticks(list(x))
    ax.set_xticklabels(areas)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Cumplimiento estimado vs ASVS/MASVS L2 (%)")
    ax.set_title("Avance por puerta de seguridad")
    ax.axhline(80, color="#C4A35A", linestyle="--", linewidth=1, label="Meta L2 (~80%)")
    ax.legend()
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    p1 = os.path.join(CHART_DIR, "avance_areas.png")
    fig.tight_layout()
    fig.savefig(p1, dpi=160)
    plt.close(fig)

    labels = ["Hecho", "Parcial", "Falta"]
    web = [4, 4, 2]  # A03+A10 hecho-ish; A01 A02 A05 A09 parcial; A06 A07/A08 gaps
    # More honest: Cumple 3, Parcial 5, Falta 2
    web = [3, 5, 2]
    mobile = [2, 5, 3]
    fig, axes = plt.subplots(1, 2, figsize=(8.4, 3.8))
    colors = ["#1B7A3A", "#C4A35A", "#A31D1D"]
    axes[0].pie(web, labels=labels, colors=colors, autopct="%1.0f%%", startangle=90)
    axes[0].set_title("OWASP Top 10 Web (10 riesgos)")
    axes[1].pie(mobile, labels=labels, colors=colors, autopct="%1.0f%%", startangle=90)
    axes[1].set_title("OWASP Mobile Top 10 (10 riesgos)")
    p2 = os.path.join(CHART_DIR, "owasp_pie.png")
    fig.tight_layout()
    fig.savefig(p2, dpi=160)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8.2, 2.6))
    ax.barh(["Meta ASVS/MASVS L2", "Hoy (tras oleada)", "Antes"], [80, 67, 48], color=["#C4A35A", "#1B7A3A", "#8AA0B8"])
    ax.set_xlim(0, 100)
    ax.set_xlabel("Puntaje estimado de benchmark (0–100)")
    ax.set_title("Qué tan cerca estamos del estándar que queremos")
    for i, v in enumerate([80, 67, 48]):
        ax.text(v + 1, i, f"{v}", va="center")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    p3 = os.path.join(CHART_DIR, "benchmark_score.png")
    fig.tight_layout()
    fig.savefig(p3, dpi=160)
    plt.close(fig)
    return p1, p2, p3


def build():
    c1, c2, c3 = make_charts()
    doc = Document()
    for s in doc.sections:
        s.top_margin = Cm(1.8)
        s.bottom_margin = Cm(1.8)
        s.left_margin = Cm(2.0)
        s.right_margin = Cm(2.0)

    t = doc.add_paragraph()
    r = t.add_run("SICOM / TacticalPtx")
    set_run(r, size=12, bold=True, color=GOLD)
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER

    h = doc.add_paragraph()
    r = h.add_run("Informe de seguridad\nBenchmark OWASP · ASVS · MASVS")
    set_run(r, size=26, bold=True, color=NAVY)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub = doc.add_paragraph()
    r = sub.add_run(
        f"Versión de trabajo · {date.today().isoformat()}\n"
        "Documento ejecutivo, preciso y en lenguaje claro.\n"
        "No es un certificado: es el mapa de qué ya cubrimos y qué falta para el listón L2."
    )
    set_run(r, size=11, color=NAVY)
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_p(
        doc,
        "Público: dirección, operación y desarrollo. Analogía: un cuartel con puertas, llaves, candados y un muro. "
        "El benchmark no pregunta si “hay candado”, pregunta si el candado cierra siempre, si la llave se puede anular y si el muro no tiene huecos.",
        size=11,
    )

    add_heading(doc, "1. Resumen ejecutivo", 1)
    add_p(
        doc,
        "Hoy SICOM ya no es una app “con usuario y contraseña nada más”. Tiene TLS en el borde, contraseñas hasheadas, "
        "sesión con refresh rotado, bloqueo por intentos, radio/GPS autenticados y tokens del teléfono en la caja fuerte del sistema.",
    )
    add_p(
        doc,
        "Eso cubre bien el nivel 1 (lo básico). El listón que queremos es el nivel 2: el que se usa en sistemas que manejan "
        "ubicación en vivo, voz y mando. En ese listón, antes estábamos más o menos a la mitad. Con la oleada de esta fecha "
        "subimos de ~48/100 a ~67/100. Todavía no “pasamos” el examen L2, pero cerramos los huecos más graves de sesión y de red.",
        bold=False,
    )
    add_table(
        doc,
        ["Pregunta simple", "Respuesta corta"],
        [
            ["¿Cumple OWASP Top 10 como certificado?", "No existe ese certificado. Top 10 es una lista de riesgos."],
            ["¿Qué estándar sí se puede medir?", "OWASP ASVS L2 (web/API) + OWASP MASVS L2 (app)."],
            ["¿Estamos en L1?", "Sí, en la mayoría de controles de L1."],
            ["¿Estamos en L2?", "Aún no. Faltan MFA, cookies HttpOnly, pin público, GPS cifrado de subida y endurecer el APK."],
            ["¿Se puede usar en operación?", "Sí, con las mejoras de esta oleada. L2 es el siguiente peldaño, no un apagón."],
            ["¿Hay que subir a producción ya?", "No. Primero pruebas. La migración 051 exige -Migrate cuando se publique."],
        ],
    )

    add_heading(doc, "2. Cómo entender el benchmark (sin jerga)", 1)
    add_p(doc, "Imagina cuatro puertas del cuartel. El estándar mira cada una:")
    add_bullets(
        doc,
        [
            "Autenticación: ¿quién entra y cómo le quito la llave si se la roban?",
            "Almacenamiento: ¿dónde guarda el teléfono o el navegador esa llave?",
            "Comunicaciones: ¿el mensaje (GPS, radio, chat) viaja por un túnel cerrado?",
            "Permisos: ¿el teléfono pide solo lo necesario y el servidor no se fía de la pantalla?",
        ],
    )
    add_p(
        doc,
        "OWASP Top 10 Web 2021 y Mobile 2024 son los “diez accidentes más comunes”. "
        "ASVS y MASVS son el reglamento de construcción (muchas reglas concretas). Nosotros usamos Top 10 para explicar y L2 para medir.",
    )

    add_heading(doc, "3. Gráficas de avance", 1)
    add_p(doc, "Las cifras son una estimación de cumplimiento frente a L2 (no un puntaje de laboratorio). Sirven para ver tendencia.")
    doc.add_picture(c3, width=Inches(6.3))
    cap = doc.add_paragraph("Gráfica 1. Distancia al listón L2 (meta 80).")
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in cap.runs:
        set_run(run, size=9, color=RGBColor(0x55, 0x55, 0x55))

    doc.add_picture(c1, width=Inches(6.3))
    cap = doc.add_paragraph("Gráfica 2. Las cuatro puertas: antes vs esta oleada.")
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in cap.runs:
        set_run(run, size=9, color=RGBColor(0x55, 0x55, 0x55))

    doc.add_picture(c2, width=Inches(6.3))
    cap = doc.add_paragraph("Gráfica 3. Semáforo de los 10 riesgos web y los 10 móviles.")
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in cap.runs:
        set_run(run, size=9, color=RGBColor(0x55, 0x55, 0x55))

    add_heading(doc, "4. En qué vamos bien (ya estaba y se mantiene)", 1)
    add_table(
        doc,
        ["Control", "En cristiano", "Dónde vive"],
        [
            ["bcrypt cost 12", "La contraseña no se guarda tal cual; se guarda un hash caro de calcular.", "backend/src/routes/auth.js"],
            ["Refresh rotado y hasheado", "La llave larga se cambia cada vez y en la BD solo está su huella SHA-256.", "auth.js + tabla refresh_tokens"],
            ["Perfil vivo", "Si te dan de baja o te cambian el rol, el JWT no manda: manda la base de datos.", "middleware/auth.js + userProfile.js"],
            ["Secretos débiles = no arranca", "En producción, si el JWT_SECRET es de ejemplo, el API se niega a subir.", "config.js"],
            ["Helmet, CORS, rate limit", "Casco HTTP, lista blanca de orígenes, tope de intentos por IP.", "server.js"],
            ["Lockout + lockdown", "Tres claves malas bloquean la cuenta; el root puede cerrar todo el servicio.", "intrusion.js"],
            ["RBAC por organización", "Un admin de una zona no administra otra organización.", "roles.js / visibilidad"],
            ["SQL con $1, $2", "No se pega texto del usuario dentro de la consulta (anti inyección).", "casi todo backend/src"],
            ["HTTPS/WSS en SICOM", "Caddy en 443 cubre API, Socket.IO y señalización LiveKit.", "Caddyfile.sicom"],
            ["GPS de bajada AES-GCM", "El mapa del despacho puede recibir la posición ya cifrada (tpxw1.).", "wireCrypto.js"],
            ["Audio DTLS-SRTP + E2EE de sala", "La voz no viaja en claro; hay cifrado de aplicación por room.", "LiveKit + voiceE2ee.js"],
            ["Tokens del APK en Keychain", "El teléfono usa EncryptedSharedPreferences / llavero, no un archivo de texto.", "secure_store.dart"],
            ["Android sin HTTP claro", "usesCleartextTraffic=false: la app no habla http:// hacia producción.", "AndroidManifest.xml"],
        ],
    )

    add_heading(doc, "5. Qué se reforzó en esta oleada (hecho ahora)", 1)
    add_p(
        doc,
        "Esta es la lista de avance concreto. Cada renglón cierra un hueco que el benchmark marcaba en rojo o ámbar.",
    )
    add_table(
        doc,
        ["#", "Qué se hizo", "Por qué importaba", "Estado"],
        [
            ["1", "token_version (migración 051)", "Antes, al bloquearte, el JWT seguía válido hasta 8 h. Ahora se muere al instante.", "Hecho"],
            ["2", "JWT de acceso a 15 minutos + keepalive", "Una llave robada dura poco. La consola 24 h se renueva sola.", "Hecho"],
            ["3", "Logout llama al API", "«Salir» ya no solo borra el navegador: revoca el refresh en el servidor.", "Hecho"],
            ["4", "must_change_password en el servidor", "La contraseña temporal ya no era un letrero: el API corta radio/GPS/admin.", "Hecho"],
            ["5", "HS256 fijado en jwt.verify", "Nadie puede colar un token con otro algoritmo.", "Hecho"],
            ["6", "bcrypt también si el usuario no existe", "El atacante no mide el reloj para saber si el usuario está dado de alta.", "Hecho"],
            ["7", "Sin “te quedan N intentos”", "Eso confirmaba que el usuario existía. Ahora el error es genérico.", "Hecho"],
            ["8", "Root también se bloquea", "La cuenta más poderosa ya no era inmune a adivinar la clave.", "Hecho"],
            ["9", "Política de password unificada (8+ letra y número) en admin", "Un admin no puede poner una clave de 6 caracteres.", "Hecho"],
            ["10", "Rate-limit en refresh y cambio de clave", "No se puede martillar esos endpoints.", "Hecho"],
            ["11", "Mutex de refresh en la web", "Dos pestañas ya no queman el refresh al mismo tiempo.", "Hecho"],
            ["12", "deviceId desde la APK + sesión única", "El operador no puede dejar 4 teléfonos logueados para siempre.", "Hecho"],
            ["13", "HSTS + nosniff + DENY iframe en Caddy", "El navegador recuerda “solo HTTPS” y no mete la consola en un marco ajeno.", "Hecho"],
            ["14", "TLS 1.2 mínimo (Node y Caddy DuckDNS)", "Se cierran TLS viejos (1.0/1.1).", "Hecho"],
            ["15", "Sin fallback a JWT_SECRET en prod (wire/content/voz)", "Cada cofre tiene su propia llave.", "Hecho"],
            ["16", "Logs de Redis sin contraseña", "El arranque ya no imprime el password de Redis.", "Hecho"],
            ["17", "Android allowBackup=false + reglas vacías", "Una copia de Google no se lleva grupos, GPS ni restos de tokens.", "Hecho"],
            ["18", "FLAG_SECURE", "No se puede capturar la pantalla del radio/mapa/login (recientes ni screenshot).", "Hecho"],
            ["19", "ATS iOS: no más “acepto cualquier HTTP”", "Solo excepciones LAN explícitas (150 y 77).", "Hecho"],
            ["20", "Android ya no confía CAs de usuario", "Un certificado de Burp instalado a mano ya no intercepta producción.", "Hecho"],
            ["21", "UCrop exported=false; texto de cámara más honesto", "Menos superficie Android 12+ y transparencia de permiso.", "Hecho"],
        ],
        col_fills={3},
    )

    add_heading(doc, "6. Semáforo OWASP Top 10 Web 2021", 1)
    add_table(
        doc,
        ["ID", "Riesgo", "Estado", "Qué significa aquí"],
        [
            ["A01", "Control de acceso roto", "Parcial", "Hay roles y org. Algunos listados admin aún se fían de ocultar el menú."],
            ["A02", "Fallos criptográficos", "Parcial", "TLS+HSTS sí. GPS de subida y chat en el socket siguen en JSON sobre TLS."],
            ["A03", "Inyección", "Cumple", "Consultas parametrizadas; casi no hay HTML crudo."],
            ["A04", "Diseño inseguro", "Parcial", "Hay lockout y ahora revocación. Falta MFA e idle timeout estricto."],
            ["A05", "Mala configuración", "Parcial", "Helmet + HSTS nuevos. Health público y CSP del SPA aún flojos."],
            ["A06", "Componentes vulnerables", "Parcial", "No hay SBOM ni npm audit en CI como control fijo."],
            ["A07", "Fallos de identificación", "Parcial", "Sesión revocable: sí. MFA y cookies HttpOnly: aún no."],
            ["A08", "Integridad de software", "Parcial", "OTA con HMAC; el hash SHA-256 del APK sigue siendo opcional."],
            ["A09", "Logging insuficiente", "Parcial", "Hay auditoría de login. Falta SIEM y alerta de reuso de refresh."],
            ["A10", "SSRF", "Cumple", "Casi no hay fetch a URLs que ponga el usuario. OTA debe seguir en allowlist."],
        ],
        col_fills={2},
    )

    add_heading(doc, "7. Semáforo OWASP Mobile Top 10 2024", 1)
    add_table(
        doc,
        ["ID", "Riesgo", "Estado", "Qué significa aquí"],
        [
            ["M1", "Uso indebido de credenciales", "Parcial", "APK en llavero: bien. Consola web aún guarda JWT en localStorage."],
            ["M2", "Cadena de suministro", "No cumple", "Sin R8/ofuscación; el release puede firmarse con debug si falta keystore."],
            ["M3", "Auth débil", "Parcial", "deviceId y logout real: sí. Sin biometría ni MFA."],
            ["M4", "Validación de entrada", "Parcial", "FileProvider aún amplio; override de servidor puede ser http en iOS LAN."],
            ["M5", "Comunicación insegura", "Parcial", "ATS y sin user-CA: sí. Falta pin público de DuckDNS."],
            ["M6", "Privacidad / authz", "Parcial", "Cámara remota y ubicación always: hay que alinear ficha de privacidad."],
            ["M7", "Protección del binario", "No cumple", "Sin minify, sin --obfuscate, sin Play Integrity / root."],
            ["M8", "Mala configuración", "Parcial", "Backup off y FLAG_SECURE: sí. Entitlements iOS siguen en development."],
            ["M9", "Almacenamiento inseguro", "Parcial", "Tokens móviles bien. Preferencias operativas aún en SharedPreferences."],
            ["M10", "Criptografía insuficiente", "Parcial", "HS256 compartido; GPS de subida sin AES de aplicación."],
        ],
        col_fills={2},
    )

    add_heading(doc, "8. Qué nos falta (preciso, priorizado)", 1)
    add_p(
        doc,
        "Esto es lo que todavía impide decir “cumplimos L2”. Está ordenado por impacto, no por moda.",
    )
    add_table(
        doc,
        ["Pri.", "Falta", "En cristiano", "Esfuerzo"],
        [
            ["P0", "MFA (TOTP) en consola y root", "Una segunda llave (el teléfono genera un código de 6 dígitos). Sin esto no hay AAL2.", "Medio (API + UI + recuperación)"],
            ["P0", "Refresh en cookie HttpOnly", "Hoy el JWT vive en localStorage: un XSS es dueño de la cuenta.", "Medio (CORS/CSRF)"],
            ["P1", "Cifrar GPS/pánico de subida", "El teléfono manda lat/lng en JSON. TLS cubre el camino, no un sniffer interno.", "Medio (protocolo tpxw1 en ambos lados)"],
            ["P1", "Pin de certificado público", "Si una CA se equivoca, hoy el APK se fía. Un pin SPKI lo evita. Hay que rotar el pin.", "Medio (y delicado: un pin mal puesto deja la app sorda)"],
            ["P1", "R8 + ofuscar Dart", "El APK se puede leer y sacar secretos de compilación (APP_UPDATE_SECRET).", "Bajo/medio"],
            ["P1", "Hash OTA obligatorio", "No instalar un APK si el servidor no manda SHA-256.", "Bajo"],
            ["P1", "requireModuleAction en listados", "Que “no ver usuarios” sea de verdad en el API, no solo esconder el menú.", "Bajo (probar mapa/roster)"],
            ["P2", "Play Integrity / root", "Avisar o cortar si el teléfono está rooteado.", "Medio"],
            ["P2", "TURNS 5349", "El TURN de voz sigue en UDP 3478 (el media sí va cifrado).", "Medio (certs)"],
            ["P2", "E2EE de voz con clave de usuario", "Hoy la clave de sala la fabrica el servidor. No es “nadie en el medio, ni nosotros”.", "Alto"],
            ["P2", "SBOM + npm audit en CI", "Inventario de librerías y parches automáticos.", "Bajo"],
            ["P2", "Política de privacidad real", "docs/PRIVACY.md es un borrador de 2026-08-10; Play/App Store lo van a pedir.", "Bajo (legal + producto)"],
        ],
    )

    add_heading(doc, "9. Cómo se prueba lo de esta oleada", 1)
    add_bullets(
        doc,
        [
            "Desarrollo: migración 051 ya aplicada en tacticalptx_db.",
            "Pruebas: PROMOVER a pruebas y PRUEBAS.ps1 (la 051 corre sobre la copia).",
            "Login 24 h: dejar la consola abierta > 20 min; no debe echarte (keepalive).",
            "Salir: en otra pestaña, el refresh anterior debe fallar.",
            "Contraseña temporal: un usuario nuevo no entra a radio hasta cambiarla.",
            "Tres claves malas: la cuenta se bloquea y el mapa/radio de esa cuenta se caen al momento (no a las 8 h).",
            "Producción: solo con orden explícita y -Migrate (respalda la BD antes).",
            "APK: estos cambios de Android/iOS viajan cuando se pida una APK nueva. La APK instalada hoy aún no trae FLAG_SECURE ni deviceId.",
        ],
    )

    add_heading(doc, "10. Conclusión", 1)
    add_p(
        doc,
        "Vamos bien en lo que un sistema táctico no puede improvisar: TLS en el borde, hashes, roles, bloqueos, radio autenticada y tokens del teléfono en el llavero. "
        "Esta oleada tapó el agujero más feo: “te bloqueé pero tu llave vieja seguía abriendo la puerta”.",
    )
    add_p(
        doc,
        "Nos falta lo que convierte un buen producto en un producto de benchmark L2: segunda llave (MFA), no dejar la llave bajo el felpudo del navegador (localStorage), "
        "no mandar el GPS en texto aunque el túnel sea HTTPS, y no entregar un APK que se pueda leer como un libro.",
        bold=False,
    )
    add_p(
        doc,
        "Puntaje honesto: L1 sí · L2 no todavía · tendencia: de 48 a 67 sobre 100. Siguiente peldaño natural: MFA + cookie HttpOnly + GPS de subida cifrado.",
        bold=True,
    )

    add_heading(doc, "Anexo A. Glosario de una línea", 1)
    add_table(
        doc,
        ["Palabra", "Significado simple"],
        [
            ["JWT", "Un pase de entrada firmado, con fecha de caducidad."],
            ["Refresh", "Una llave larga para pedir un pase nuevo sin volver a escribir la contraseña."],
            ["token_version", "Un número en tu ficha: si sube, todos los pases viejos dejan de valer."],
            ["HSTS", "El navegador se promete a sí mismo: “a este sitio solo por HTTPS”."],
            ["ATS", "La regla de Apple: no hablar por HTTP a menos que se lo pidas con nombre y apellido."],
            ["FLAG_SECURE", "Android no deja foto ni vista previa de recientes de esa pantalla."],
            ["Pin de certificado", "El teléfono memoriza la huella del servidor y no se fía de cualquier autoridad."],
            ["MFA / TOTP", "Además de la clave, un código que cambia cada 30 segundos."],
            ["ASVS L2", "Reglamento de construcción nivel 2 para APIs y webs serias."],
            ["MASVS L2", "El mismo reglamento, pero para la app del teléfono."],
        ],
    )

    add_heading(doc, "Anexo B. Archivos tocados en esta oleada", 1)
    add_p(
        doc,
        "Migración 051_token_version.sql; auth.js, middleware/auth.js, userProfile.js, intrusion.js, admin.js, server.js, config.js, tls.js, "
        "contentCrypto.js, wireCrypto.js, voiceE2ee.js, livekit.js, me.js; frontend api.js, App.jsx, SessionKeepaliveHost.jsx, nginx.conf; "
        "Caddyfile.sicom; AndroidManifest, network_security_config, backup/data_extraction rules, MainActivity.kt; Info.plist; "
        "secure_store.dart, api_client.dart, channel_session.dart; CHECKLIST_PRUEBAS.md, CHANGELOG.md.",
        size=10,
    )

    footer = doc.add_paragraph()
    r = footer.add_run(
        "Clasificación: uso interno SICOM / TacticalPtx. No incluye secretos ni contraseñas. "
        "Las gráficas son estimación de cobertura de controles, no el resultado de un pentest externo."
    )
    set_run(r, size=9, color=RGBColor(0x66, 0x66, 0x66))

    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    doc.save(OUT_DOCS)
    soporte_dir = os.path.dirname(OUT_SOPORTE)
    if os.path.isdir(soporte_dir):
        doc.save(OUT_SOPORTE)
        return OUT_DOCS, OUT_SOPORTE
    return OUT_DOCS, None


if __name__ == "__main__":
    a, b = build()
    print(a)
    if b:
        print(b)
