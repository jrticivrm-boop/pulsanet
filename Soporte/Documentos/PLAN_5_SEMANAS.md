# TacticalPtx — Plan de 5 semanas (Ciclo de Vida del Desarrollo de Sistemas)

**Canónico:** `C:\pulsanet\Soporte\Documentos\PLAN_5_SEMANAS.md`  
**Presentación:** `C:\pulsanet\Soporte\Documentos\TACTICALPTX_CVDS_5_SEMANAS.pptx`  
**Generar PPT:** `python Soporte/Scripts/build_plan_5_semanas_pptx.py`  
**Referencias:** [PLAN_DE_TRABAJO.md](PLAN_DE_TRABAJO.md) · [ALCANCE_V1](../../docs/ALCANCE_V1.md) · [ARQUITECTURA](../../docs/ARQUITECTURA.md)

**Versiones alineadas (repo):** APK **1.8.46+55** · API **1.8.21** · Ago 2026

**Identidad visual PPT:** blanco institucional · verde Defensa `#002F2A` / `#1E5B4F` · acento oro `#A57F2C` · navegación por hipervínculos (Menú / S1–S5).

---

## Marco (CVDS)

**184.** Etapas para concebir y entregar como producto final un sistema de información, sin importar el área donde se requiera.

**185.** Cada etapa se compone de fases; cada fase, de iteraciones. Cada iteración produce una **nueva versión** del producto.

### Etapas

| | Etapa | Contenido |
|---|--------|-----------|
| **A** | Análisis | Requerimientos de usuarios/unidades; casos de uso; diccionarios de datos; diagramas de flujo y de clases |
| **B** | Diseño | Vistas a programar; consultas; reportes; pantallas de captura; niveles de acceso |
| **C** | Desarrollo | Programación de los requerimientos con base en análisis y diseño |
| **D** | Pruebas | Pruebas por módulos y de forma global |
| **E** | Implementación | Entrega al Centro de Informática; instalación en servidores; entorno BD; publicación internet/intranet |
| **F** | Mantenimiento | A lo largo de toda la vida útil del sistema |

**G.** Los nuevos requerimientos recorren todas las etapas hasta volver a Mantenimiento.  
**H.** Si los cambios son sustanciales: análisis completo de nuevo → todas las etapas → **nueva versión** etiquetada.

---

## Desglose en 5 semanas

| Semana | Etapa CVDS | Foco |
|--------|------------|------|
| **1** | **A · Análisis** | Requerimientos, alcance, casos de uso, diccionario, diagramas |
| **2** | **B · Diseño** | Vistas, pantallas, consultas/reportes, niveles de acceso |
| **3** | **C · Desarrollo** | Código (API, web, APK) según análisis y diseño |
| **4** | **D · Pruebas** | Módulos + global + validación de campo |
| **5** | **E+F · Implementación y Mantenimiento** | Entrega/publicación + vida útil; ciclo G/H |

> Las seis etapas del CVDS se cubren en cinco semanas agrupando **Implementación** y **Mantenimiento** en la Semana 5 (entrega + operación continua).

---

### Semana 1 — Análisis (A)

- Levantamiento de requerimientos (unidades, dependencias, instalaciones)
- Casos de uso (PTT, chat, GPS, pánico, despacho)
- Diccionario de datos
- Diagramas de flujo y de clases / arquitectura lógica
- Alcance: incluido / excluido / criterios de éxito

### Semana 2 — Diseño (B)

- Vistas y pantallas (Radio, Chats, Seguimiento, Login, consola)
- Consultas y reportes
- Pantallas de captura (usuarios, canales, catálogos)
- Niveles de acceso: root, admin, despachador, operador

### Semana 3 — Desarrollo (C)

- Programación según análisis y diseño
- Backend, consola web, app Android
- Integración PTT / chat / GPS / edge
- Cada iteración = versión del producto

### Semana 4 — Pruebas (D)

- Pruebas por módulo (PTT, chat, GPS, pánico, radio 1:1)
- Prueba global punta a punta
- Validación en campo (LAN / 4G)
- Corrección previa a implementación

### Semana 5 — Implementación (E) y Mantenimiento (F)

**Implementación**
- Entrega al Centro de Informática (o instancia operativa equivalente)
- Instalación en servidores, entorno de BD
- Publicación internet / intranet (Caddy edge, APK OTA)

**Mantenimiento**
- Soporte durante la vida útil
- Nuevos requerimientos → ciclo completo (G)
- Cambios sustanciales → nuevo análisis y **nueva versión** (H)

---

## Relación con el plan largo

El [PLAN_DE_TRABAJO.md](PLAN_DE_TRABAJO.md) sigue siendo la referencia de sprints históricos.  
Este documento aplica el **CVDS institucional** en un **ciclo ejecutivo de 5 semanas**.

---

*Actualizado: 2026-08-31 — alineado a CVDS (Análisis…Mantenimiento)*
