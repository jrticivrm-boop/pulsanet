# Flujo de trabajo en 3 fases — SICOM / TacticalPtx

| Fase | Dónde | Rama git | URL |
|------|-------|----------|-----|
| **Desarrollo** | PC · `C:\pulsanet` | `desarrollo` | API :4000 · Vite :5173 · BD `tacticalptx_db` |
| **Análisis y pruebas** | PC · `C:\pulsanet-pruebas` | `pruebas` | https://localhost:5180 · API :4200 · BD `tacticalptx_pruebas` (copia de prod) |
| **Producción** | VM SICOM (Proxmox 103) · `192.168.1.150:/opt/pulsanet` | `main` | https://pulsanet.duckdns.org · https://192.168.1.150 |

`192.168.1.67` es el host Proxmox (consola `:8006`), no la app.

## Día a día

1. **Desarrollar** en `C:\pulsanet` (rama `desarrollo`). Commit cuando algo quede listo.
   - `LEVANTAR-TACTICALPTX.bat` arranca **solo local** (sin `/edge`): no abre 80/443, no usa UPnP, no toca DuckDNS, hosts ni `.env` público; sin FCM. Los teléfonos reales no llegan a desarrollo.
   - BD de desarrollo **sin datos reales**. Datos ficticios (7 usuarios de todos los perfiles + canal de zona y de unidad): `cd backend; npm run seed:dev` (solo corre contra `tacticalptx_db` local; idempotente).
2. **Pasar a pruebas**:
   ```powershell
   .\infra\PROMOVER.ps1 -A pruebas
   .\infra\PRUEBAS.ps1               # build real + levanta :5180
   .\infra\PRUEBAS.ps1 -RefrescarBD  # si quieres datos frescos de producción (-ConMedia = + fotos/audios)
   ```
   Validar en https://localhost:5180 (o `https://<IP-PC>:5180` desde un teléfono en la LAN).
   Revisar lo que aplique de [`CHECKLIST_PRUEBAS.md`](CHECKLIST_PRUEBAS.md).
   Probar la app móvil contra pruebas: en un teléfono de prueba conectado al Wi-Fi, en inicio de sesión → *Servidor*: `https://192.168.1.77:4200` (la APK confía en el certificado de la PC solo en esa IP). Sirve para sesión, mapa, canales y mensajes; voz/video del teléfono contra pruebas no está garantizado (LiveKit de pruebas no se publica). Al terminar, borrar el servidor para volver a producción. No hay APK de pruebas separada: requiere cambios de compilación (otro `applicationId` + Firebase) y se hará cuando se pida una APK.
3. **Verificar** (automático, solo lectura; PROMOVER también lo corre):
   ```powershell
   .\infra\VERIFICAR-PRUEBAS.ps1
   ```
   Falla si pruebas no corre exactamente el commit a subir, si API/web de pruebas no responden, si hay errores de sintaxis en backend o si pruebas tuviera FCM. Avisa de migraciones, copia de BD vieja (>7 días), reversión activa y usuarios conectados en producción. Historial: `C:\pulsanet_soporte\Pruebas\verificaciones.log`.
4. **Publicar en producción** (solo cuando se decide tras el análisis):
   ```powershell
   .\infra\PROMOVER.ps1 -A produccion            # avanza main y despliega en la VM
   .\infra\PROMOVER.ps1 -A produccion -Migrate   # si hay migraciones nuevas de BD
   ```
   Secuencia: verificación automática → confirmar la lista manual (`SI`) → si es fuera de la **ventana 21:00–07:00** pide escribir `FUERA DE HORARIO` → confirmar publicación (`SI`) → despliegue → etiqueta `prod-v<versión>-<fecha>` en GitHub. Registro: `C:\pulsanet_soporte\Pruebas\despliegues.log`.
   Si hay migraciones y falta `-Migrate`, se detiene **antes** de mover `main`. `-Forzar` solo en emergencia (sube aunque la verificación falle).
5. **Si algo sale mal en producción** — reversión:
   ```powershell
   .\infra\REVERTIR-PRODUCCION.ps1 -Listar   # versiones etiquetadas anteriores
   .\infra\REVERTIR-PRODUCCION.ps1 -DryRun   # qué haría
   .\infra\REVERTIR-PRODUCCION.ps1           # vuelve a la etiqueta anterior (pide escribir REVERTIR)
   ```
   Reconstruye solo lo que cambia. No reescribe git ni toca la BD. Mientras `main` siga en la versión retirada, un deploy normal se bloquea: la corrección entra por desarrollo → pruebas → producción.
   Si además hay que regresar la BD (migración dañina): restaurar a mano el respaldo previo `/opt/respaldos/pre_deploy_<fecha>.dump` con `pg_restore --clean` dentro del contenedor `postgres` (se pierden los datos posteriores a ese respaldo; decidirlo antes).

Apagar pruebas: `.\infra\PRUEBAS.ps1 -Detener`.

## Qué hace cada script

- **`PROMOVER.ps1`**: solo avanza ramas (fast-forward) `desarrollo → pruebas → main` y las sube a GitHub. Nunca reescribe historia. Lo no commiteado no viaja.
- **`PRUEBAS.ps1`**: worktree en `pruebas`, `.env` propio (puerto 4200, Redis db 2, **sin FCM** para no notificar a teléfonos reales, sin respaldos automáticos), aplica migraciones sobre la copia (ensayo antes de prod) y compila el frontend como en producción.
- **`DEPLOY-SICOM.ps1`** → `infra/sicom-deploy.sh` en la VM:
  - Reconstruye solo lo que cambió (`frontend/` → web, `backend/` → api, `Caddyfile.sicom` → recarga Caddy, compose → ambos).
  - Migraciones nuevas en `database/migrations/`: se detiene salvo `-Migrate`, que primero hace `pg_dump` a `/opt/respaldos/pre_deploy_*.dump`.
  - Verifica `/api/health` y registra en `/opt/respaldos/deploys.log`.
  - Opciones: `-Target api|web|all`, `-DryRun`.
  - `--ref=prod-*` (lo usa REVERTIR-PRODUCCION): regresa a una etiqueta anterior; anota en `/opt/respaldos/migraciones_aplicadas.txt` las migraciones que quedan aplicadas (para no repetirlas al volver a avanzar) y crea `/opt/respaldos/ROLLBACK_ACTIVO` hasta el siguiente despliegue con una versión nueva.
- **`VERIFICAR-PRUEBAS.ps1`**: chequeo previo a producción (ver paso 3). `PRUEBAS.ps1` deja `backend\data\pruebas-estado.json` en el worktree con el commit levantado y la fecha de la copia de BD.
- **`REVERTIR-PRODUCCION.ps1`**: reversión a una etiqueta `prod-*` (ver paso 5). Siempre pide confirmación.

## Respaldos

- **Dentro del ProLiant:** Proxmox respalda la VM completa cada noche (02:00, conserva 3) y la app genera un ZIP diario (BD + multimedia, conserva 14) en `/opt/pulsanet/backend/data/backups`.
- **Fuera del ProLiant:** la tarea `SICOM-Respaldo-a-PC` (03:30 y al iniciar sesión) copia esos ZIP a `C:\pulsanet_soporte\Respaldos\SICOM` con `infra\RESPALDO-SICOM-A-PC.ps1`. Revisar `respaldo.log` ahí mismo.

## Reglas

- **Nada sube a producción sin orden explícita** después del análisis en pruebas (regla `.cursor/rules/produccion-solo-con-orden.mdc`). Commits y promociones a `pruebas` no afectan al servidor; la VM solo cambia con `PROMOVER -A produccion`, `DEPLOY-SICOM` o `REVERTIR-PRODUCCION`.
- Desarrollo = datos ficticios; pruebas = copia de producción (no sacarla de la PC); producción = datos reales.
- En la VM **no se edita código**: el deploy se niega si hay cambios locales en archivos versionados.
- La configuración de producción (`infra/.env.prod`, `.env.sicom`, `livekit.sicom.yaml`, `infra/secrets/`) vive solo en la VM y está fuera de git.
- APK: se compila solo cuando se pide; no es parte del deploy del servidor.
