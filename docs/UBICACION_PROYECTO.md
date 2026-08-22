# Ubicación única del proyecto — TacticalPtx

**Carpeta canónica (todo el proyecto):** `D:\pulsanet`

No hay otra copia del producto en `C:\laragon\www\pulsanet` ni en `C:\pulsanet`.

```
D:\pulsanet\
├── backend\          API
├── web\              Despacho + Radio
├── mobile\           App Android
├── database\         SQL
├── infra\            LiveKit, Docker, BAT auxiliares
├── docs\             Docs de producto (repo)
├── Soporte\          Auxiliar (no es runtime)
│   ├── Documentos\   Bitácora, guías, checklist
│   ├── Secrets\      Firebase service account
│   ├── APK\          Builds para WhatsApp
│   ├── Brand\        Logos / variantes
│   ├── Cursor\       Copia de reglas IA
│   └── Respaldos\    Snapshots antiguos
├── LEVANTAR-TACTICALPTX.bat
└── README.md
```

## Compatibilidad

`D:\PulsaNet_Soporte` es una **unión (junction)** → `D:\pulsanet\Soporte`.

Rutas viejas siguen funcionando; lo nuevo debe escribirse bajo `D:\pulsanet\Soporte\…`.

## Herramientas externas (no son el proyecto)

| Herramienta | Ruta típica |
|-------------|-------------|
| Flutter | `C:\tools\flutter` |
| Android SDK | `D:\Android\Sdk` |
| JDK 17 | `C:\Program Files\Microsoft\jdk-…` |
| Redis (Laragon) | `C:\laragon\bin\redis\…` |
| PostgreSQL | servicio `postgresql-x64-17` |

Esas rutas son dependencias del SO, no duplicados del código.
