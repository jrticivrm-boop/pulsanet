# TacticalPtx — Producción v1.0 (Mes 6)

## Qué incluye este hito

- Stack Docker: Postgres + Redis + LiveKit + API + web + Caddy
- API endurecida (`NODE_ENV=production`, JWT fuerte, rate limit, trust proxy)
- Auditoría (`activity_logs`), CSV de usuarios, `ptt_sessions`, registro de devices (FCM stub)
- Prep Play Store: keystore + App Bundle firmado
- Manual de usuario y política de privacidad stub

**No incluido (requiere cuentas externas / Mac):** publicación real en Play Console / App Store, FCM enviando push, builds iOS.

---

## Deploy con Docker Compose

Requiere Docker Engine + Compose v2.

```powershell
cd D:\pulsanet\infra
copy .env.prod.example .env.prod
# Editar .env.prod: POSTGRES_PASSWORD, JWT_SECRET (≥32 chars), CORS_ORIGINS, LIVEKIT_*

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

| Servicio | URL |
|----------|-----|
| Web + API (proxy) | http://localhost |
| Health | http://localhost/api/health (`ready: true` si DB+Redis+LiveKit) |
| LiveKit | `ws://localhost:7880` |

Seed de usuarios demo (después del up):

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api node src/scripts/seed.js
```

(Si el Dockerfile omitió `src/scripts`, monta el backend o ejecuta seed desde la máquina de desarrollo apuntando a `DATABASE_URL` del contenedor expuesto.)

### HTTPS

En producción, cambia el `Caddyfile` a tu dominio (Caddy obtiene certificados solos):

```
tu-dominio.example {
 encode gzip
 handle /api* { reverse_proxy api:4000 }
 handle /socket.io* { reverse_proxy api:4000 }
 handle { reverse_proxy web:80 }
}
```

Actualiza `CORS_ORIGINS` y `LIVEKIT_URL` (WSS público).

### LiveKit keys

Deben coincidir:

- [`infra/livekit.yaml`](../infra/livekit.yaml) → sección `keys`
- `.env.prod` → `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`

---

## Arranque local Windows (sin Docker)

Sigue el README: PostgreSQL + `infra/start-services.ps1` + `backend` + `web`.

Migración auditoría (BD ya existente):

```powershell
psql -U postgres -d tacticalptx_db -f database/migrations/001_activity_logs.sql
```

---

## Android — App Bundle (Play Store)

1. Keystore (una sola vez; **respaldar fuera del repo**):

```powershell
powershell -File D:\pulsanet\mobile\android\create-keystore.ps1
```

Genera `upload-keystore.jks` + `key.properties` (gitignored).

2. Build release (JDK 17):

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
cd D:\pulsanet\mobile
flutter build appbundle --release --dart-define=API_BASE=https://TU-API
```

Salida: `build/app/outputs/bundle/release/app-release.aab`

### Checklist Play Console

- [ ] Cuenta Google Play Developer
- [ ] App creada (`com.tacticalptx.app`)
- [ ] Privacy policy URL ([PRIVACY.md](PRIVACY.md) hospedada)
- [ ] Subir AAB a pista interna / cerrada
- [ ] Capturas y descripción de la ficha
- [ ] Clasificación de contenido / permisos micrófono

### iOS / App Store

Requiere **Mac + Apple Developer**. Flutter ya tiene carpeta `ios/`; build:

```bash
flutter build ipa --dart-define=API_BASE=https://TU-API
```

Luego TestFlight / App Store Connect. Política VoIP/PTT y privacy labels.

---

## Endpoints nuevos (Mes 6)

| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/api/admin/users.csv` | Export usuarios |
| GET | `/api/admin/activity` | Últimos eventos |
| POST | `/api/devices` | Registra FCM token (sin push) |

---

## Criterios de aceptación (código)

1. Compose válido y documentado 
2. Production rechaza JWT débil 
3. Login escribe `activity_logs` 
4. PTT grant/release escribe `ptt_sessions` 
5. AAB firmable con keystore local 
6. Manual + privacy publicados en `docs/`
