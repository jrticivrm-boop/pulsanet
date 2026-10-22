# -*- coding: utf-8 -*-
"""Informe Word: CIS Benchmarks vs SICOM / TacticalPtx."""
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
OUT_DOCS = os.path.join(ROOT, "docs", "INFORME_CIS_BENCHMARK.docx")
OUT_SOPORTE = os.path.join(
    "C:\\pulsanet_soporte", "Documentos", "INFORME_CIS_BENCHMARK.docx"
)

NAVY = RGBColor(0x0B, 0x1F, 0x3A)
GOLD = RGBColor(0xC4, 0xA3, 0x5A)


def set_run(run, *, size=11, bold=False, color=NAVY, font="Calibri"):
    run.font.name = font
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:ascii"), font)
    rFonts.set(qn("w:hAnsi"), font)


def shade_cell(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
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
    return p


def add_bullets(doc, items):
    for it in items:
        p = doc.add_paragraph(it, style="List Bullet")
        for run in p.runs:
            set_run(run, size=11, color=NAVY)
        p.paragraph_format.space_after = Pt(3)


def set_cell_text(cell, text, *, bold=False, color=NAVY, fill=None, size=10):
    cell.text = ""
    run = cell.paragraphs[0].add_run(text)
    set_run(run, size=size, bold=bold, color=color)
    if fill:
        shade_cell(cell, fill)


def add_table(doc, headers, rows, status_col=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    for i, h in enumerate(headers):
        set_cell_text(
            table.rows[0].cells[i], h, bold=True, color=RGBColor(255, 255, 255), fill="0B1F3A"
        )
    fills = {
        "Sí": "D4EDDA",
        "Parcial": "FFF3CD",
        "No": "F8D7DA",
        "No aplica": "E9ECEF",
        "Cumple": "D4EDDA",
        "Falta": "F8D7DA",
        "No medido": "E9ECEF",
    }
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            fill = fills.get(str(val)) if status_col is None or c_i == status_col else None
            if status_col is None:
                fill = fills.get(str(val))
            set_cell_text(table.rows[r_i + 1].cells[c_i], str(val), fill=fill)
    doc.add_paragraph()
    return table


def caption(doc, text):
    p = doc.add_paragraph(text)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in p.runs:
        set_run(run, size=9, color=RGBColor(0x55, 0x55, 0x55))


def make_charts():
    os.makedirs(CHART_DIR, exist_ok=True)
    plt.rcParams["font.family"] = "Segoe UI"
    plt.rcParams["axes.unicode_minus"] = False

    # 1. Dos caminos
    fig, ax = plt.subplots(figsize=(8.4, 3.4))
    ax.barh(
        ["OWASP ASVS/MASVS (app)", "CIS Benchmarks (máquinas)"],
        [67, 35],
        color=["#1B7A3A", "#2E6B9A"],
    )
    ax.set_xlim(0, 100)
    ax.set_xlabel("Cobertura estimada del listón que nos toca (%)")
    ax.set_title("No es el mismo examen: app vs configuración de servidores")
    ax.axvline(80, color="#C4A35A", ls="--", lw=1)
    ax.text(81, 1.35, "Meta ~80%", color="#C4A35A", fontsize=8)
    for i, v in enumerate([67, 35]):
        ax.text(v + 1.5, i, str(v), va="center")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    p1 = os.path.join(CHART_DIR, "cis_vs_owasp.png")
    fig.tight_layout()
    fig.savefig(p1, dpi=160)
    plt.close(fig)

    # 2. Por benchmark aplicable
    names = [
        "Docker",
        "PostgreSQL 18",
        "Redis 7",
        "NGINX",
        "Ubuntu (VM)",
        "Windows (PCs)",
        "Android",
        "iOS",
    ]
    scores = [38, 32, 22, 42, 15, 15, 48, 20]
    colors = ["#2E6B9A" if s >= 40 else "#C4A35A" if s >= 30 else "#A31D1D" for s in scores]
    fig, ax = plt.subplots(figsize=(8.4, 4.4))
    ax.barh(names[::-1], scores[::-1], color=colors[::-1])
    ax.set_xlim(0, 100)
    ax.set_xlabel("Estimación vs perfil CIS Nivel 1 (%)")
    ax.set_title("Qué tanto está endurecido cada componente SICOM")
    ax.axvline(80, color="#1B7A3A", ls="--", lw=1)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    p2 = os.path.join(CHART_DIR, "cis_por_componente.png")
    fig.tight_layout()
    fig.savefig(p2, dpi=160)
    plt.close(fig)

    # 3. CIS Controls 18
    ctrl = [
        "1 Activos",
        "2 Software",
        "3 Datos",
        "4 Config. segura",
        "5 Cuentas",
        "6 Acceso",
        "7 Vulnerabilidades",
        "8 Bitácoras",
        "9 Navegador",
        "10 Malware",
        "11 Recuperación",
        "12 Red",
        "13 Monitoreo",
        "14 Concientización",
        "15 Proveedores",
        "16 App segura",
        "17 Incidentes",
        "18 Pentest",
    ]
    vals = [25, 30, 55, 35, 60, 62, 20, 45, 20, 15, 70, 55, 25, 10, 20, 67, 25, 15]
    fig, ax = plt.subplots(figsize=(8.6, 6.2))
    bar_c = ["#1B7A3A" if v >= 55 else "#C4A35A" if v >= 35 else "#A31D1D" for v in vals]
    ax.barh(ctrl[::-1], vals[::-1], color=bar_c[::-1])
    ax.set_xlim(0, 100)
    ax.set_xlabel("% estimado de salvaguardas cubiertas (IG1/IG2 mixto)")
    ax.set_title("CIS Controls v8 — los 18 controles (higiene de la organización)")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    p3 = os.path.join(CHART_DIR, "cis_controls18.png")
    fig.tight_layout()
    fig.savefig(p3, dpi=160)
    plt.close(fig)

    # 4. Semáforo perfiles
    fig, ax = plt.subplots(figsize=(8.2, 2.8))
    ax.barh(
        ["CIS Nivel 2 (alto)", "CIS Nivel 1 (básico)", "CIS STIG (DoD EE.UU.)"],
        [18, 35, 5],
        color=["#A31D1D", "#C4A35A", "#6C757D"],
    )
    ax.set_xlim(0, 100)
    ax.set_xlabel("Cobertura estimada (%)")
    ax.set_title("Perfiles CIS: no confundir con OWASP L1/L2")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    p4 = os.path.join(CHART_DIR, "cis_perfiles.png")
    fig.tight_layout()
    fig.savefig(p4, dpi=160)
    plt.close(fig)

    # 5. Pie aplicable
    fig, ax = plt.subplots(figsize=(6.2, 4.0))
    ax.pie(
        [8, 4, 90],
        labels=["Aplica a SICOM (~8)", "Opcional / futuro", "Catálogo CIS (~100, no nos toca)"],
        colors=["#2E6B9A", "#C4A35A", "#DEE2E6"],
        autopct="%1.0f%%",
        startangle=90,
        textprops={"fontsize": 8},
    )
    ax.set_title("De más de 100 Benchmarks CIS, solo unos pocos son los nuestros")
    p5 = os.path.join(CHART_DIR, "cis_aplicables.png")
    fig.tight_layout()
    fig.savefig(p5, dpi=160)
    plt.close(fig)
    return p1, p2, p3, p4, p5


def build():
    c1, c2, c3, c4, c5 = make_charts()
    doc = Document()
    for s in doc.sections:
        s.top_margin = Cm(1.7)
        s.bottom_margin = Cm(1.7)
        s.left_margin = Cm(2.0)
        s.right_margin = Cm(2.0)

    kicker = doc.add_paragraph()
    r = kicker.add_run("SICOM / TacticalPtx  ·  Centro for Internet Security")
    set_run(r, size=12, bold=True, color=GOLD)
    kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER

    title = doc.add_paragraph()
    r = title.add_run("Informe CIS Benchmarks\n¿Nos aplica? ¿Cumplimos? ¿Qué falta?")
    set_run(r, size=24, bold=True, color=NAVY)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub = doc.add_paragraph()
    r = sub.add_run(
        f"Versión de trabajo · {date.today().isoformat()}\n"
        "Fuente de concepto: CIS (cisecurity.org) y explicación IBM Think.\n"
        "Este documento es distinto del informe OWASP/ASVS. No se sustituyen: se complementan."
    )
    set_run(r, size=11, color=NAVY)
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_heading(doc, "1. Respuesta corta (léalo primero)", 1)
    add_table(
        doc,
        ["Pregunta", "Respuesta"],
        [
            [
                "¿CIS Benchmarks aplica para SICOM?",
                "Sí. Aplica a las máquinas y servicios (Ubuntu, Docker, PostgreSQL, Redis, NGINX, Android, PCs Windows). No a cada renglón de los 100+ PDFs.",
            ],
            [
                "¿Es el mismo camino que OWASP L1/L2?",
                "No. OWASP mira cómo está escrita la app. CIS mira cómo está configurado el servidor, el contenedor y el teléfono.",
            ],
            [
                "¿Cumplimos con todo CIS?",
                "No. No hay evidencia de CIS-CAT. Redis sin contraseña, Docker sin endurecer (cap_drop / read_only), Ubuntu/Windows no medidos.",
            ],
            [
                "¿Hay que tirar el trabajo OWASP?",
                "No. Ese trabajo sigue valiendo. CIS es el siguiente examen, sobre el cuartel, no sobre el reglamento interno de la app.",
            ],
            [
                "¿Qué listón CIS nos toca?",
                "Nivel 1 en todos los componentes aplicables, y Nivel 2 en PostgreSQL/Redis/Ubuntu/Docker porque hay GPS y radio.",
            ],
            [
                "¿STIG (DoD EE.UU.)?",
                "Solo si un contrato lo pide. No es el estándar mexicano por defecto.",
            ],
        ],
    )

    add_heading(doc, "2. Qué es CIS, en cristiano", 1)
    add_p(
        doc,
        "El Center for Internet Security (CIS) es una organización sin fines de lucro de EE.UU. "
        "Publica recetas paso a paso para “cerrar tuercas” de un sistema: Windows, Ubuntu, Docker, PostgreSQL, Android, etc. "
        "IBM lo resume así: mejores prácticas para configurar de forma segura sistemas, software, redes e infraestructura.",
    )
    add_p(
        doc,
        "Analogía del cuartel: OWASP es el reglamento de quién entra y cómo se cifran los partes. "
        "CIS es el manual del almacén: candados de la puerta del cuarto de servidores, PostgreSQL sin puerto a la calle, Redis con clave, Ubuntu sin servicios de más, Docker sin privilegios de root.",
    )
    add_p(doc, "Hay más de 100 Benchmarks, en 8 familias:", bold=True)
    add_bullets(
        doc,
        [
            "Sistemas operativos (Windows, Linux, macOS).",
            "Software de servidor (Docker, Kubernetes, PostgreSQL, NGINX, Redis…).",
            "Nube (AWS, Azure, Google, IBM) — SICOM de producción no vive ahí.",
            "Dispositivos móviles (Android, iOS).",
            "Red (Cisco, Palo Alto…) — no es nuestro stack.",
            "Escritorio (Chrome, Office) — consola de despacho.",
            "Impresoras — no aplica.",
            "DevSecOps (cadena de suministro del software).",
        ],
    )

    add_heading(doc, "3. Niveles CIS: no son los L1/L2 de OWASP", 1)
    add_p(
        doc,
        "En el informe anterior, L1/L2 eran de OWASP ASVS/MASVS (calidad de la aplicación). "
        "CIS usa las mismas palabras para otra cosa: perfiles de configuración del producto.",
    )
    add_table(
        doc,
        ["Nombre CIS", "Qué quiere decir", "Impacto en el servicio", "¿SICOM?"],
        [
            [
                "Perfil Nivel 1",
                "Tuercas básicas: poco esfuerzo, casi no se nota el cambio.",
                "Mínimo. Es el piso para cualquiera.",
                "Debería ser el mínimo de la VM y Docker.",
            ],
            [
                "Perfil Nivel 2",
                "Tuercas de alta seguridad: más coordinación, a veces se pierde una comodidad.",
                "Puede romper algo si se aplica a ciegas (ej. desactivar un protocolo).",
                "Justificado: GPS en vivo + radio táctica.",
            ],
            [
                "Perfil STIG",
                "Línea del Departamento de Defensa de EE.UU.",
                "Muy rígido. Pensado para contratos DoD.",
                "No, salvo que un pliego lo exija.",
            ],
        ],
    )
    add_p(
        doc,
        "CIS también publica los CIS Controls (18 controles, 153 salvaguardas). Eso no es “cómo configuro PostgreSQL”, "
        "es “cómo se comporta la organización”: inventario, respaldos, concientización, pentest. "
        "Los grupos de implementación (IG1 / IG2 / IG3) son el orden: primero higiene (IG1, 56 salvaguardas), luego madurez (IG2).",
    )

    add_heading(doc, "4. Gráficas de avance y hueco", 1)
    add_p(doc, "Las cifras son estimación de cobertura frente al perfil Nivel 1 del componente, no un puntaje CIS-CAT (esa herramienta no se ha corrido).")
    doc.add_picture(c1, width=Inches(6.3))
    caption(doc, "Gráfica 1. OWASP (app) vs CIS (máquinas): dos exámenes distintos.")
    doc.add_picture(c5, width=Inches(5.4))
    caption(doc, "Gráfica 2. Del catálogo CIS, solo un puñado de Benchmarks nos toca.")
    doc.add_picture(c4, width=Inches(6.3))
    caption(doc, "Gráfica 3. Perfiles CIS Nivel 1 / Nivel 2 / STIG.")
    doc.add_picture(c2, width=Inches(6.3))
    caption(doc, "Gráfica 4. Avance por componente del stack SICOM.")
    doc.add_picture(c3, width=Inches(6.3))
    caption(doc, "Gráfica 5. CIS Controls v8 (los 18): higiene de la organización, no solo código.")

    add_heading(doc, "5. Qué Benchmarks SÍ nos aplican y cuáles NO", 1)
    add_table(
        doc,
        ["Benchmark CIS", "¿Aplica?", "Dónde está en SICOM", "Por qué"],
        [
            ["Ubuntu Linux (VM Proxmox 103)", "Sí", "192.168.1.150 /opt/pulsanet", "El servidor de producción es Ubuntu."],
            ["Docker", "Sí", "docker-compose.sicom.yml", "API, web, Postgres, Redis, Caddy, LiveKit van en contenedores."],
            ["PostgreSQL 18", "Sí", "postgres:18-alpine", "Toda la BD operativa."],
            ["Redis 7", "Sí", "redis:7-alpine", "Presencia PTT y floor."],
            ["NGINX", "Sí", "frontend/Dockerfile (nginx:1.27)", "Sirve el SPA detrás de Caddy."],
            ["Google Android", "Sí", "APK SICOM + teléfonos de flota", "App y política del dispositivo."],
            ["Apple iOS", "Parcial", "App pendiente de Apple", "Cuando haya IPA/TestFlight."],
            ["Windows 10/11", "Sí", "PCs de despacho y desarrollo", "La consola web corre en Windows."],
            ["Caddy", "No aplica (no hay PDF CIS)", "Caddyfile.sicom", "Se endurece con práctica equivalente (TLS, HSTS), no con un Benchmark CIS propio."],
            ["Node.js / Express / LiveKit", "No aplica (no hay PDF CIS)", "backend, LiveKit", "Se cubren con OWASP ASVS y CIS Docker del contenedor."],
            ["AWS / Azure / GCP", "No", "—", "Producción es on-premise (Proxmox), no nube pública."],
            ["Kubernetes", "No", "—", "Compose, no K8s."],
            ["Cisco / Palo Alto", "No", "—", "No administramos ese hardware en el repo."],
        ],
        status_col=1,
    )

    add_heading(doc, "6. Qué ya tenemos (evidencia en el repo / operación)", 1)
    add_p(doc, "Esto sí cuenta a favor. CIS premia configuración concreta, no intenciones.")
    add_table(
        doc,
        ["Hecho", "Qué quiere decir", "Evidencia"],
        [
            [
                "API no corre como root",
                "Si alguien rompe Node, no sale con poderes de administrador del contenedor.",
                "backend/Dockerfile → USER node",
            ],
            [
                "Postgres y Redis sin puertos a la calle",
                "En SICOM no se publican 5432/6379; solo existen dentro de la red Docker.",
                "docker-compose.sicom.yml (postgres/redis sin ports:)",
            ],
            [
                "Firewall bloquea 5432 y 6379",
                "Aunque alguien escuche, Windows/LAN no los deja pasar (en el PC de desarrollo).",
                "infra/Ensure-Firewall.ps1 reglas BLOCK",
            ],
            [
                "Logs de contenedor con tope",
                "El disco de la VM no se llena de logs infinitos (DoS de disco).",
                "x-logging json-file 10m × 5",
            ],
            [
                "Imágenes oficiales Alpine",
                "Se parte de Postgres/Redis/Caddy/Nginx publicados, no de un tar misterioso.",
                "compose: postgres:18-alpine, redis:7-alpine, caddy:2-alpine",
            ],
            [
                "Contraseña de Postgres obligatoria",
                "Compose exige POSTGRES_PASSWORD; no arranca vacío.",
                "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}",
            ],
            [
                "Redis con persistencia AOF",
                "Si se cae Redis, no se pierde todo el estado (CIS habla de persistencia segura).",
                "command: redis-server --appendonly yes",
            ],
            [
                "SPA con cabeceras anti-clickjacking",
                "NGINX ya manda X-Frame-Options DENY, nosniff, Referrer-Policy.",
                "frontend/nginx.conf",
            ],
            [
                "Caddy TLS 1.2+ y HSTS",
                "Equivalente práctico al endurecimiento TLS de un Benchmark de proxy.",
                "Caddyfile.sicom (oleada OWASP)",
            ],
            [
                "Android: sin backup, sin HTTP claro, FLAG_SECURE, sin CAs de usuario",
                "Parte del CIS Android a nivel app (el resto es MDM del teléfono).",
                "AndroidManifest, network_security_config, MainActivity",
            ],
            [
                "Respaldos de BD",
                "CIS Control 11 (recuperación): dump diario + Proxmox + copia a PC.",
                "FLUJO_DESPLIEGUE.md / respaldos",
            ],
            [
                "Secretos fuera de git",
                "keystores, .env.prod, google-services no van al remoto.",
                ".gitignore",
            ],
        ],
    )

    add_heading(doc, "7. Qué nos falta, punto por punto (con significado)", 1)
    add_p(
        doc,
        "Aquí está el hueco CIS. Cada renglón dice qué pide el Benchmark, qué quiere decir en la vida real, y dónde tocaría SICOM.",
    )

    add_heading(doc, "7.1 CIS Docker — el cuarto de contenedores", 2)
    add_p(
        doc,
        "Qué es: receta para el anfitrión Docker, el demonio, las imágenes y cómo se lanzan los contenedores. "
        "Nivel 1 = no privilegiado, no root, recursos limitados. Nivel 2 = read-only, seccomp, no-new-privileges.",
    )
    add_table(
        doc,
        ["Control típico", "Qué quiere decir", "Hoy", "Dónde"],
        [
            ["No privileged", "El contenedor no es “el dueño de la máquina”.", "Parcial: no usamos privileged: true", "compose"],
            ["USER no root", "El proceso no es uid 0.", "Cumple en API (node). NGINX imagen oficial arranca root y baja el worker.", "Dockerfiles"],
            ["cap_drop: ALL", "Se quitan poderes de Linux (raw sockets, etc.).", "Falta", "docker-compose.sicom.yml"],
            ["security_opt no-new-privileges", "Un binario no puede ganar más poderes después.", "Falta", "compose"],
            ["read_only: true", "El disco del contenedor no se escribe (solo volúmenes).", "Falta", "compose"],
            ["Límites CPU/RAM", "Un contenedor loco no tumba la VM.", "Falta", "deploy.resources"],
            ["Content Trust / firmas", "Solo corre imagen firmada.", "Falta (no Cosign/DCT)", "pipeline"],
            ["network_mode: host", "Salta el aislamiento de red.", "LiveKit lo usa (WebRTC). Excepción documentada, no “CIS feliz”.", "livekit service"],
            ["CIS Docker del HOST Ubuntu", "El demonio docker.sock, auditd, userns.", "No medido", "VM 103"],
        ],
        status_col=2,
    )

    add_heading(doc, "7.2 CIS PostgreSQL 18 — la caja fuerte de los datos", 2)
    add_p(
        doc,
        "Qué es: instalación, permisos de archivos, logging, quién se conecta, cifrado, replicación. "
        "El Benchmark de PostgreSQL históricamente es sobre todo Nivel 1 (práctico, sin romper el motor).",
    )
    add_table(
        doc,
        ["Control típico", "Qué quiere decir", "Hoy", "Dónde"],
        [
            ["scram-sha-256", "Las claves de BD no viajan ni se guardan al estilo viejo (md5).", "No medido (default de la imagen)", "postgresql.conf"],
            ["pg_hba no trust", "Nadie entra a Postgres “porque está en localhost” sin clave.", "Probable OK dentro de Docker; no hay evidencia en repo", "pg_hba.conf"],
            ["SSL entre API y Postgres", "Aunque sea red interna, el GPS en tránsito interno también se cifra.", "Falta: sslmode no está en DATABASE_URL", "docker-compose.sicom.yml L73, db.js"],
            ["Logging de conexiones y DDL", "Queda rastro de quién se conectó y quién cambió tablas.", "Falta configuración explícita", "postgresql.conf"],
            ["Rol de la app ≠ superuser", "El API no debería ser el dueño de la instancia.", "Parcial: un usuario táctico, no documentado si es superuser", ".env.prod"],
            ["Parches", "Imagen 18-alpine al día.", "Hay que pinchar digest y actualizar con calendario", "compose image tag"],
        ],
        status_col=2,
    )

    add_heading(doc, "7.3 CIS Redis 7 — la memoria de presencia y PTT", 2)
    add_p(
        doc,
        "Qué es: Redis con clave, ACL, bind, TLS, apagar comandos peligrosos (FLUSHALL, CONFIG, DEBUG), persistencia. "
        "Un Redis abierto en Internet se secuestra en minutos. El nuestro no está publicado, pero dentro del Docker sigue sin contraseña.",
    )
    add_table(
        doc,
        ["Control típico", "Qué quiere decir", "Hoy", "Dónde"],
        [
            ["requirepass / ACL", "Hasta el contenedor vecino necesita clave para hablarle a Redis.", "Falta: redis://redis:6379 sin password", "compose + redis.js"],
            ["Bind / no exponer 6379", "Que no escuche en 0.0.0.0 de la VM.", "Cumple a nivel compose (sin ports)", "docker-compose.sicom.yml"],
            ["Renombrar/apagar FLUSHALL, CONFIG", "Un comando no borra toda la presencia ni cambia la config.", "Falta", "redis command/ACL"],
            ["TLS redis (rediss://)", "Cifrado incluso en la red Docker.", "Falta (Nivel 2)", "REDIS_URL"],
            ["No como root", "El proceso redis del Alpine oficial ya baja de root; verificar.", "Parcial (imagen oficial)", "redis:7-alpine"],
        ],
        status_col=2,
    )

    add_heading(doc, "7.4 CIS NGINX — el que sirve la consola", 2)
    add_p(
        doc,
        "Qué es: ocultar versión, TLS (si termina HTTPS), cabeceras, no listar directorios, timeouts, quitar módulos de más. "
        "En SICOM NGINX solo habla HTTP hacia Caddy: el TLS lo hace Caddy. Aun así hay tuercas de NGINX.",
    )
    add_table(
        doc,
        ["Control típico", "Qué quiere decir", "Hoy", "Dónde"],
        [
            ["server_tokens off", "NGINX no grita “nginx/1.27” al atacante.", "Falta", "frontend/nginx.conf"],
            ["No directory listing", "Nadie lista /usr/share/nginx/html.", "Cumple (try_files SPA)", "nginx.conf"],
            ["Cabeceras de seguridad", "No iframe, no MIME sniffing.", "Cumple (oleada previa)", "nginx.conf"],
            ["TLS 1.2+ en NGINX", "No aplica: no termina TLS.", "No aplica", "Caddy lo hace"],
            ["USER nginx en Dockerfile", "El master no tiene por qué ser root si se puede evitar.", "Falta (imagen oficial)", "frontend/Dockerfile"],
        ],
        status_col=2,
    )

    add_heading(doc, "7.5 CIS Ubuntu (VM SICOM) y Windows (PCs)", 2)
    add_p(
        doc,
        "Qué es: cuentas, SSH, sudo, parches, auditd, firewall del host, USB, BitLocker, Defender, SMBv1 apagado, etc. "
        "Esto NO está en el código de la app. Vive en la VM 192.168.1.150 y en cada PC de despacho. "
        "Hoy: No medido. No hay reporte CIS-CAT. No se puede decir “cumplimos Ubuntu L1”.",
    )
    add_bullets(
        doc,
        [
            "Hace falta correr CIS-CAT Lite/Pro (o equivalente OpenSCAP) contra la VM Ubuntu y guardar el PDF de score.",
            "En PCs de despacho: baseline Windows 11 CIS Nivel 1 (cuenta local, pantalla que se bloquea, BitLocker, no admin diario).",
            "SSH de la VM: llaves, no password, no root login (típico CIS Ubuntu L1).",
            "Parches con calendario (CIS Control 7).",
        ],
    )

    add_heading(doc, "7.6 CIS Android / iOS — el teléfono de la flota", 2)
    add_p(
        doc,
        "Qué es: dos capas. (A) Cómo está escrita la app — ya lo vimos con MASVS. "
        "(B) Cómo está configurado el teléfono: cifrado, bloqueo de pantalla, depuración USB apagada, MDM, no root. "
        "CIS Android habla sobre todo de (B). La app puede ser dura y el teléfono estar en modo desarrollador: CIS reprueba el dispositivo.",
    )
    add_table(
        doc,
        ["Control", "Qué quiere decir", "Hoy"],
        [
            ["Cifrado del dispositivo + PIN", "Si pierden el radio, el disco no se lee.", "Política de flota: no está en el repo. Falta MDM."],
            ["USB debugging off", "Un cable no extrae datos.", "Flota: no medido."],
            ["allowBackup false", "Google no se lleva la sesión.", "Cumple en el manifiesto (oleada previa)."],
            ["Sin HTTP claro / sin user CA", "No MITM barato.", "Cumple en la app."],
            ["Play Integrity / no root", "El teléfono no está “tuneado”.", "Falta."],
            ["MDM (Intune / similar)", "Un admin puede borrar el teléfono perdido.", "Falta a nivel organización."],
        ],
        status_col=2,
    )

    add_heading(doc, "8. CIS Controls v8 — la organización, no solo el código", 1)
    add_p(
        doc,
        "Los 18 controles son la lista de “qué hace una organización que se toma en serio la ciberseguridad”. "
        "IG1 = higiene (toda empresa). IG2 = la que ya tiene gente de TI y datos sensibles (nos queda más cerca). "
        "IG3 = la que es blanco dirigido (inteligencia, pentest continuo).",
    )
    add_table(
        doc,
        ["#", "Control (qué quiere decir)", "Hoy en SICOM", "Hueco"],
        [
            ["1", "Inventario de equipos: saber cada PC, VM y teléfono.", "Parcial (conocemos la VM y el repo).", "Lista viva de APKs/PCs con dueño."],
            ["2", "Inventario de software: qué corre y en qué versión.", "Parcial (compose + package.json).", "SBOM y “esta lib tiene CVE”."],
            ["3", "Proteger datos: clasificar GPS/audio/chat y cifrar.", "Parcial (AES at-rest, TLS).", "GPS de subida aún JSON; DLP."],
            ["4", "Configuración segura: baselines CIS.", "Parcial (firewall, HSTS, USER node).", "CIS-CAT + cap_drop + Redis auth."],
            ["5", "Cuentas: altas, bajas, privilegios.", "Bien en la app (RBAC, lockout).", "Cuentas del SO Ubuntu/Windows no auditadas aquí."],
            ["6", "Control de acceso: MFA, sesión.", "Parcial (JWT revocable). ", "MFA y cookies HttpOnly (informe OWASP)."],
            ["7", "Vulnerabilidades: parchar a tiempo.", "Falta como proceso.", "npm audit / Trivy / calendario de imágenes."],
            ["8", "Bitácoras: guardar y revisar logs.", "Parcial (activity, login).", "SIEM, retención, reloj NTP, alertas."],
            ["9", "Navegador/correo del despacho.", "No cubierto.", "Chrome CIS, no extensión rara, no correo personal en la consola."],
            ["10", "Antimalware en PCs y VM.", "No cubierto en repo.", "Defender/Clam en hosts, no desactivar."],
            ["11", "Recuperación: respaldos que sí restauran.", "Bien (Proxmox + dump + copia a PC).", "Ensayo de restore documentado periódicamente."],
            ["12", "Red: firewall, segmentos.", "Bien en intención (Caddy 443, DB bloqueada).", "Segmentar LiveKit host-network; TURNS."],
            ["13", "Monitoreo de red.", "Falta.", "IDS/alertas si 5432 aparece publicado."],
            ["14", "Concientización.", "Falta.", "Operadores: no USB, no foto al mapa (FLAG_SECURE ayuda)."],
            ["15", "Proveedores (DuckDNS, LE, LiveKit image).", "Parcial.", "Contrato/ficha de quién tiene las llaves DNS."],
            ["16", "Seguridad de la aplicación.", "El informe OWASP: ~67/100 L2.", "MFA, pin, GPS uplink."],
            ["17", "Respuesta a incidentes.", "Hay lockdown y force-logout.", "Playbook escrito: quién llama a quién a las 3 a.m."],
            ["18", "Pentest.", "No hay informe de tercero.", "Ejercicio anual (caja gris sobre API+APK)."],
        ],
        status_col=2,
    )

    add_heading(doc, "9. Prioridad de trabajo CIS (sin mezclarlo con OWASP)", 1)
    add_p(doc, "Si se hace en este orden, se nota en un auditor CIS sin romper el radio:")
    add_table(
        doc,
        ["Pri.", "Acción", "Por qué", "Esfuerzo"],
        [
            ["P0", "requirepass + ACL en Redis; REDIS_URL con clave", "L1 Redis. Hoy cualquiera en la red Docker lee presencia.", "Bajo"],
            ["P0", "server_tokens off en NGINX", "L1 NGINX. Una línea.", "Mínimo"],
            ["P0", "Correr CIS-CAT (o OpenSCAP) en la VM Ubuntu y guardar el PDF", "Sin medición no hay “cumplimos”.", "Medio (ops)"],
            ["P1", "compose: cap_drop ALL, no-new-privileges, read_only + tmpfs", "L1/L2 Docker de los servicios API/web/redis.", "Medio (probar PTT)"],
            ["P1", "sslmode=require en Postgres y usuario de app sin SUPERUSER", "L1 PostgreSQL.", "Medio"],
            ["P1", "Pin de digest de imágenes + Trivy en CI", "Parches y cadena de suministro (Control 7 y 16).", "Medio"],
            ["P1", "MDM + política PIN/cifrado en la flota Android", "CIS Android de dispositivo, no de APK.", "Organización"],
            ["P2", "TLS Redis, límites de recursos, quitar network_mode host si se puede", "Nivel 2.", "Alto"],
            ["P2", "Pentest + playbook de incidentes", "Controls 17 y 18.", "Alto"],
        ],
    )

    add_heading(doc, "10. Relación con el informe OWASP anterior", 1)
    add_p(
        doc,
        "No hay que elegir. Un auditor serio pregunta las dos cosas:",
    )
    add_bullets(
        doc,
        [
            "OWASP ASVS/MASVS: ¿la aplicación está bien diseñada? (JWT, MFA, storage, GPS). Informe: INFORME_SEGURIDAD_BENCHMARK.docx. Avance ~67/100 hacia L2 de app.",
            "CIS Benchmarks: ¿las máquinas están endurecidas? Este informe. Avance ~35/100 hacia CIS Nivel 1 de los componentes aplicables.",
            "CIS Controls IG1/IG2: ¿la gente y el proceso existen? Inventario, respaldos (vamos bien), concientización y pentest (faltan).",
        ],
    )
    add_p(
        doc,
        "Puntaje honesto CIS: no cumplimos “todo”. Cumplimos pedazos sueltos (USER node, DB no publicada, firewall, respaldos, cabeceras). "
        "El hueco gordo es medición (CIS-CAT), Redis sin clave, Docker sin drop de capacidades y hosts Ubuntu/Windows sin baseline.",
        bold=True,
    )

    add_heading(doc, "11. Cómo se demostraría cumplimiento (cuando se pida)", 1)
    add_bullets(
        doc,
        [
            "Descargar los PDF oficiales (uso no comercial gratis) de: Ubuntu (versión de la VM), Docker, PostgreSQL 18, Redis 7, NGINX, Android, Windows 11.",
            "Elegir perfil Nivel 1 primero; marcar excepciones (LiveKit host-network) por escrito.",
            "Correr CIS-CAT Lite/Pro o un playbook Ansible/OpenSCAP; archivar el score.",
            "No afirmar “CIS compliant” sin ese PDF. El código del repo solo cubre una parte.",
        ],
    )

    add_heading(doc, "Anexo. Glosario", 1)
    add_table(
        doc,
        ["Palabra", "Significado simple"],
        [
            ["CIS", "Center for Internet Security: quien escribe las recetas de configuración."],
            ["Benchmark CIS", "PDF con casillas: “pon esto en postgresql.conf”."],
            ["CIS-CAT", "Programa que escanea un equipo y dice qué casillas faltan."],
            ["Nivel 1 / Nivel 2 (CIS)", "Fácil vs estricto. No es el L1/L2 de OWASP."],
            ["STIG", "Receta militar de EE.UU. Solo si el contrato lo pide."],
            ["CIS Controls", "18 hábitos de la organización (inventario, respaldos, pentest…)."],
            ["IG1", "Higiene mínima (56 salvaguardas). Toda organización."],
            ["IG2", "Lo que pide alguien con datos sensibles y un área de TI."],
            ["cap_drop", "Quitar poderes de Linux al contenedor."],
            ["requirepass", "Contraseña de Redis."],
            ["server_tokens off", "NGINX deja de decir su versión."],
            ["MDM", "Software para mandar sobre los teléfonos de la flota (borrar, PIN, cifrado)."],
        ],
    )

    foot = doc.add_paragraph()
    r = foot.add_run(
        "Clasificación: uso interno. No es un certificado CIS ni un escaneo CIS-CAT. "
        "Las gráficas son estimación de cobertura. Referencias: cisecurity.org/cis-benchmarks ; "
        "IBM Think “Qué son los CIS Benchmarks” (mx-es). No incluye secretos."
    )
    set_run(r, size=9, color=RGBColor(0x66, 0x66, 0x66))

    os.makedirs(os.path.dirname(OUT_DOCS), exist_ok=True)
    doc.save(OUT_DOCS)
    if os.path.isdir(os.path.dirname(OUT_SOPORTE)):
        doc.save(OUT_SOPORTE)
        return OUT_DOCS, OUT_SOPORTE
    return OUT_DOCS, None


if __name__ == "__main__":
    a, b = build()
    print(a)
    if b:
        print(b)
