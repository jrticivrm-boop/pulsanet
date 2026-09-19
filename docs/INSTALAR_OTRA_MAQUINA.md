# Instalar TacticalPtx / SICOM en otra máquina

Guía corta para clonar el Host (consola + API + PTT) en un PC nuevo, restaurando **datos + multimedia**.

## 0. Inventario y checklist (2026-09)

En el PC **origen**, antes de copiar:

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File infra\Inventario-Migracion.ps1
```

Genera reporte en `C:\pulsanet_soporte\Documentos\INVENTARIO_MIGRACION_*.md` (y CSV).

Checklist humano + prompt Cursor:

- `C:\pulsanet_soporte\Documentos\CHECKLIST_COPIA_3_CARPETAS.md`
- `C:\pulsanet_soporte\Documentos\PROMPT_AGENTE_OTRA_MAQUINA.md`

### Las 3 cosas a copiar

| # | Qué | Ruta |
|---|-----|------|
| 1 | Producto completo (no solo git) | `C:\pulsanet` |
| 2 | Auxiliar | `C:\pulsanet_soporte` |
| 3 | ZIP fresco BD+uploads | `backend\data\backups\tacticalptx_*.zip` (el más reciente) |

**Suele olvidarse (está en `.gitignore`):** `backend\.env`, `upload-keystore.jks`, `key.properties`, `google-services.json`, `infra\secrets\*.json`, `infra\certs\*.pem`.

## 1. Qué llevar del PC origen

| Ítem | Dónde | Obligatorio |
|------|--------|-------------|
| Repo completo | `C:\pulsanet` (o carpeta del proyecto) | Sí |
| `backend\.env` | secretos JWT, LiveKit, cifrado chat, FCM, dominio | Sí (mismas claves) |
| Respaldo `.zip` reciente | Panel → Config → Respaldos **o** `backend\data\backups\` | Sí |
| Certificados LAN | `infra\certs\lan-*.pem` | Recomendado |
| Firebase JSON | `infra\secrets\` + `FIREBASE_SERVICE_ACCOUNT` en `.env` | Si hay APK con FCM |
| Keystore APK | `mobile\android\upload-keystore.jks` + `key.properties` | Si firmas APK |
| APK / dominio público | `pulsanet_soporte\APK`, DuckDNS | Solo 4G |

**Importante:** si cambias `CONTENT_ENCRYPTION_KEY` en el destino, el chat cifrado de la BD **no se podrá leer**. Copia el `.env` tal cual (luego ajusta solo IPs/dominio).

## 2. Software a instalar en el PC nuevo

1. **Windows 10/11**
2. **Node.js LTS** (18+) — [nodejs.org](https://nodejs.org)
3. **PostgreSQL** 15–18 — servicio escuchando en `:5432`
4. **Redis** (Laragon Redis o Redis for Windows) — `:6379`
5. **Git** (recomendado)
6. LiveKit: viene en `infra\livekit\livekit-server.exe` (no hace falta instalar aparte)

Opcional: Caddy + UPnP (borde HTTPS / APK 4G), Tailscale, Flutter (solo si compilas APK ahí).

## 3. Pasos de puesta en marcha

```bat
:: 1) Copiar el repo a C:\pulsanet (recomendado) o cualquier carpeta
:: 2) Copiar backend\.env del origen (ya debe ir dentro del árbol copiado)
:: 3) Abrir PostgreSQL (services.msc) y Redis

CREAR-O-ACTUALIZAR-BD.bat
:: Crea la BD vacía + esquema (no borra si ya existe)

LEVANTAR-TACTICALPTX.bat
:: o sin borde publico: LEVANTAR-TACTICALPTX.bat /noedge

:: 4) Abrir https://127.0.0.1:5173 → Config → Respaldos
::    → Subir el .zip (BD + multimedia) → Restaurar (escribir RESTAURAR)
:: 5) Reiniciar API/Web (cerrar ventanas TacticalPtx API/Web y volver a LEVANTAR)
```

Tras restaurar, avatares, audios/fotos de chat y grabaciones deben coincidir con el origen.

## 4. Qué incluye el respaldo `.zip`

- `database.sql` — toda la información en PostgreSQL  
- `uploads/` — multimedia (`backend/uploads`: avatares, chat, grabaciones, sitios, etc.)  
- `meta.json` — versión / fecha / flags  

**No** incluye: `.env`, certificados, Caddy, Redis en memoria, APKs.

## 5. Checklist rápido si algo falla

| Síntoma | Qué mirar |
|---------|-----------|
| API 500 / no arranca | Redis `:6379`, `DATABASE_URL`, ventana **TacticalPtx API** |
| Web no abre | Ventana **TacticalPtx Web**, certs en `infra\certs` |
| PTT sin audio | LiveKit `:7880`, `LIVEKIT_*` en `.env` |
| Chat ilegible | Misma `CONTENT_ENCRYPTION_KEY` que el origen |
| Fotos rotas | Restaurar ZIP nuevo (con multimedia), no un `.sql` legado |
| APK 4G | `PUBLIC_DOMAIN` + port-forward modem (doble NAT Telmex/Deco) + `ENSURE-PUBLIC-EDGE` |

## 6. Flags útiles

```bat
LEVANTAR-TACTICALPTX.bat /nopause
LEVANTAR-TACTICALPTX.bat /strict
LEVANTAR-TACTICALPTX.bat /noedge
```

## 7. Anti-regresión en la otra PC

Pegar en Cursor el prompt de `PROMPT_AGENTE_OTRA_MAQUINA.md`.  
Regla fija: **no revertir ni reescribir módulos grandes** sin que el usuario diga explícitamente revertir/rollback.
