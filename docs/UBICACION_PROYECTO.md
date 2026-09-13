# Ubicación única del proyecto — TacticalPtx

**Producto:** TacticalPtx  
**Carpeta canónica del producto:** `C:\pulsanet`  
**Worktree de desarrollo:** `C:\pulsanet-dev` (rama `develop`; UI `frontend\` :5273)  
**Auxiliar (opcional):** `C:\pulsanet_soporte`

**Regla:** el programa debe poder copiarse a otra máquina **solo** con la carpeta de producto. Soporte no es runtime.

```
C:\pulsanet\
├── backend\          API Node.js
├── frontend\         React producción (Vite :5173) — OBLIGATORIA
├── mobile\           Flutter
├── database\         PostgreSQL schema + migraciones
├── infra\            LiveKit, Caddy, scripts; secrets\ local
├── docs\             Docs de producto + bitácora
├── LEVANTAR-TACTICALPTX.bat
├── CREAR-O-ACTUALIZAR-BD.bat
└── README.md

C:\pulsanet-dev\       mismo repo (worktree)
├── frontend\         UI de desarrollo (Vite :5273)
├── LEVANTAR-DEV.bat
└── CREAR-O-ACTUALIZAR-BD.bat

C:\pulsanet_soporte\   NO va en la copia “solo programa”
├── Documentos\ Cursor\ APK\ Logs\ Brand\ Scripts\ Archivo\
```

Detalle de soporte: [SOPORTE.md](SOPORTE.md)

## Tecnologías del producto

| Área | Tecnología | Carpeta |
|------|------------|---------|
| API | Node.js, Express, Socket.IO | `backend/` |
| Tiempo real / PTT | LiveKit, Redis | `backend/` + `infra/` |
| Datos | PostgreSQL (SQL) | `database/` |
| Web producción | React (Vite :5173) | `C:\pulsanet\frontend\` |
| Web desarrollo | React (Vite :5273) | `C:\pulsanet-dev\frontend\` |
| Móvil | Flutter (Dart) | `mobile/` |
| Ops / borde | Caddy, scripts PowerShell | `infra/` |
| Auxiliar | Docs Word/PPT, APK, dumps | `C:\pulsanet_soporte\` |

## Qué NO es el producto

Instalaciones del sistema (no se duplican dentro de `C:\pulsanet`): Node.js, PostgreSQL, Redis, Flutter SDK, Android SDK.

## Base de datos

PostgreSQL: `tacticalptx_db` (producción) / `tacticalptx_dev` (worktree).  
Crear o actualizar **sin borrar datos:** `CREAR-O-ACTUALIZAR-BD.bat`
