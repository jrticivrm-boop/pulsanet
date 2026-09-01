# Ubicación única del proyecto — TacticalPtx

**Producto:** TacticalPtx  
**Única carpeta del proyecto en disco (canónica):** `C:\pulsanet`

**Regla:** no debe existir copia, junction ni material del producto fuera de `C:\pulsanet`.  
Todo el código, docs, Soporte (APK, secretos, brand, bitácora, respaldos) vive **solo** ahí.  
Si aparece `D:\pulsanet` en docs antiguas o en `.env`, corregir a `C:\pulsanet` (D: a menudo no existe y rompe TLS/FCM/scripts).

```
C:\pulsanet\
├── backend\          API Node.js (REST + Socket.IO + Redis + LiveKit)
├── web\              React (Radio + despacho)
├── mobile\           Flutter (Android; iOS con Mac)
├── database\         PostgreSQL (schema + migraciones)
├── infra\            LiveKit, Caddy, Docker, scripts ops
├── docs\             Docs de producto (repo)
├── Soporte\          Auxiliar del producto (no es runtime)
│   ├── Documentos\   Bitácora, guías, checklist
│   ├── Secrets\      Firebase / secretos ops (gitignored)
│   ├── APK\          Builds firmados
│   ├── Brand\        Logos / variantes
│   ├── Cursor\       Copia de reglas IA
│   └── Respaldos\    Snapshots
├── .cursor\          Reglas Cursor del workspace
├── LEVANTAR-TACTICALPTX.bat
└── README.md
```

## Tecnologías del producto (todas bajo `C:\pulsanet`)

| Área | Tecnología | Carpeta |
|------|------------|---------|
| API | Node.js, Express, Socket.IO | `backend/` |
| Tiempo real / PTT | LiveKit, Redis | `backend/` + `infra/` |
| Datos | PostgreSQL (SQL) | `database/` |
| Web | React (Vite) | `web/` |
| Móvil | Flutter (Dart) | `mobile/` |
| Ops / borde | Caddy, scripts PowerShell | `infra/` |
| Auxiliar | Docs, APK, brand, secretos | `Soporte/` |

## Qué NO es el proyecto (herramientas del equipo)

Instalaciones del sistema operativo; **no** se duplican dentro de `C:\pulsanet`:

| Herramienta | Ruta típica en esta máquina |
|-------------|------------------------------|
| Flutter SDK | `C:\tools\flutter` |
| Android SDK | `C:\Android\Sdk` (fallback histórico `D:\Android\Sdk`) |
| JDK 17 | `C:\Program Files\Microsoft\jdk-…` |
| Node.js | `C:\Program Files\nodejs` |
| PostgreSQL | servicio `postgresql-x64-17` |
| Redis (Laragon) | `C:\laragon\bin\redis\…` |

Los scripts del repo (`Publish-ApkUpdate.ps1`, `LEVANTAR-TACTICALPTX.bat`, etc.) **apuntan** a esas herramientas; el producto en sí permanece solo en `C:\pulsanet`.

## Prohibido

- Junctions tipo `D:\PulsaNet_Soporte` → usar solo `C:\pulsanet\Soporte`
- Copias del repo en Laragon, Desktop u otras unidades
- Dejar logos / APK / bitácora en Documentos o Descargas
- Paths absolutos a `D:\pulsanet\…` en `.env` / launchers (preferir `C:\pulsanet` o rutas relativas al script)

## Base de datos

PostgreSQL: `tacticalptx_db` (servicio del sistema; esquema y migraciones en `C:\pulsanet\database`).
