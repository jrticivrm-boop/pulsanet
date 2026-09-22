# Soporte auxiliar — TacticalPtx

El **producto portable** es `C:\pulsanet` (y el worktree `C:\pulsanet-dev`). No necesita esta carpeta de soporte para arrancar.

## Dónde está el auxiliar

Reglas de editor/IA, documentos Word/PPT, APK históricas, logs de archivo y dumps viven en:

**`C:\pulsanet_soporte\`**

Reglas Cursor (copia completa): `C:\pulsanet_soporte\Cursor\rules`

En el repo solo quedan **reglas mínimas** en `.cursor\rules` (anti-regresión + documentar cambios) para que los agentes no pisen features.

## Qué NO mover fuera del producto

| Carpeta | Por qué |
|---------|---------|
| `backend\` | API |
| `frontend\` | UI React (prod en `C:\pulsanet` :5173; DEV en `C:\pulsanet-dev` :5273). **Obligatoria.** |
| `mobile\` | App Flutter |
| `database\` | schema + migraciones |
| `infra\` | Caddy, LiveKit, scripts de arranque, `infra\secrets` |
| `docs\` | Changelog y bitácora de producto |
| `LEVANTAR-*.bat` | Arranque |

No debe existir una carpeta `web\` paralela en producción: el nombre canónico es `frontend\` en ambos árboles. Si aparece un leftover `web\`, moverlo a `C:\pulsanet_soporte\Archivo\` tras confirmar que Vite usa `frontend\`.

Secretos runtime: `infra\secrets\` (van con la carpeta copiada a otra máquina; **no** versionar; **no** pegar contenidos en docs). Plantilla: `backend\.env.example`.

APK versionadas (archivo): `C:\pulsanet_soporte\APK\` (vía `Publish-ApkUpdate.ps1` + `Resolve-AuxRoot.ps1`). OTA en caliente: `backend\app-updates\`.

## Máquina nueva (resumen)

1. Instalar Node LTS, PostgreSQL, Redis.
2. Copiar `C:\pulsanet` (y opcionalmente `pulsanet-dev`).
3. Copiar `backend\.env.example` → `backend\.env` y ajustar (sin compartir el archivo).
4. `CREAR-O-ACTUALIZAR-BD.bat` (crea BD si falta; no borra datos).
5. `LEVANTAR-TACTICALPTX.bat` → API https://127.0.0.1:4000 y Web https://127.0.0.1:5173
6. Desarrollo aislado: `C:\pulsanet-dev\LEVANTAR-DEV.bat` → :4100 / :5273 / :7980
