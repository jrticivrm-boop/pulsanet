# Flujo de trabajo en 3 fases — SICOM / TacticalPtx

| Fase | Dónde | Rama git | URL |
|------|-------|----------|-----|
| **Desarrollo** | PC · `C:\pulsanet` | `desarrollo` | API :4000 · Vite :5173 · BD `tacticalptx_db` |
| **Análisis y pruebas** | PC · `C:\pulsanet-pruebas` | `pruebas` | https://localhost:5180 · API :4200 · BD `tacticalptx_pruebas` (copia de prod) |
| **Producción** | VM SICOM (Proxmox 103) · `192.168.1.150:/opt/pulsanet` | `main` | https://pulsanet.duckdns.org · https://192.168.1.150 |

`192.168.1.67` es el host Proxmox (consola `:8006`), no la app.

## Día a día

1. **Desarrollar** en `C:\pulsanet` (rama `desarrollo`). Commit cuando algo quede listo.
2. **Pasar a pruebas**:
   ```powershell
   .\infra\PROMOVER.ps1 -A pruebas
   .\infra\PRUEBAS.ps1               # build real + levanta :5180
   .\infra\PRUEBAS.ps1 -RefrescarBD  # si quieres datos frescos de producción (-ConMedia = + fotos/audios)
   ```
   Validar en https://localhost:5180 (o `https://<IP-PC>:5180` desde un teléfono en la LAN).
3. **Publicar en producción** (pide escribir `SI`):
   ```powershell
   .\infra\PROMOVER.ps1 -A produccion            # avanza main y despliega en la VM
   .\infra\PROMOVER.ps1 -A produccion -Migrate   # si hay migraciones nuevas de BD
   ```

Apagar pruebas: `.\infra\PRUEBAS.ps1 -Detener`.

## Qué hace cada script

- **`PROMOVER.ps1`**: solo avanza ramas (fast-forward) `desarrollo → pruebas → main` y las sube a GitHub. Nunca reescribe historia. Lo no commiteado no viaja.
- **`PRUEBAS.ps1`**: worktree en `pruebas`, `.env` propio (puerto 4200, Redis db 2, **sin FCM** para no notificar a teléfonos reales, sin respaldos automáticos), aplica migraciones sobre la copia (ensayo antes de prod) y compila el frontend como en producción.
- **`DEPLOY-SICOM.ps1`** → `infra/sicom-deploy.sh` en la VM:
  - Reconstruye solo lo que cambió (`frontend/` → web, `backend/` → api, `Caddyfile.sicom` → recarga Caddy, compose → ambos).
  - Migraciones nuevas en `database/migrations/`: se detiene salvo `-Migrate`, que primero hace `pg_dump` a `/opt/respaldos/pre_deploy_*.dump`.
  - Verifica `/api/health` y registra en `/opt/respaldos/deploys.log`.
  - Opciones: `-Target api|web|all`, `-DryRun`.

## Respaldos

- **Dentro del ProLiant:** Proxmox respalda la VM completa cada noche (02:00, conserva 3) y la app genera un ZIP diario (BD + multimedia, conserva 14) en `/opt/pulsanet/backend/data/backups`.
- **Fuera del ProLiant:** la tarea `SICOM-Respaldo-a-PC` (03:30 y al iniciar sesión) copia esos ZIP a `C:\pulsanet_soporte\Respaldos\SICOM` con `infra\RESPALDO-SICOM-A-PC.ps1`. Revisar `respaldo.log` ahí mismo.

## Reglas

- En la VM **no se edita código**: el deploy se niega si hay cambios locales en archivos versionados.
- La configuración de producción (`infra/.env.prod`, `.env.sicom`, `livekit.sicom.yaml`, `infra/secrets/`) vive solo en la VM y está fuera de git.
- APK: se compila solo cuando se pide; no es parte del deploy del servidor.
