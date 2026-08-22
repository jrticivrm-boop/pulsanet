# Docker producción — estado en esta PC

## Qué significa

Hoy PulsaNet en desarrollo corre “a mano” (Postgres Windows + Redis Laragon + LiveKit .exe + Node + Vite).

**Docker Compose prod** empaqueta todo en contenedores:

- Postgres, Redis, LiveKit, API, web estática, Caddy (proxy puerto 80)

Así lo levantas en un **servidor/VPS** o en esta PC con un solo comando, sin instalar cada pieza aparte.

## Estado

- Archivos listos: `infra/docker-compose.prod.yml`, `.env.prod` (secretos generados)
- **Docker Desktop** no quedó instalado automáticamente (el instalador falló / pide UAC admin)

## Qué hacer tú (una vez)

1. Instala [Docker Desktop](https://www.docker.com/products/docker-desktop/) (acepta WSL2 si lo pide) y **reinicia** si lo solicita  
2. Abre Docker Desktop hasta que diga “Engine running”  
3. Luego:

```powershell
cd D:\pulsanet\infra
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

4. Abre http://localhost — web + API detrás de Caddy  
5. Seed:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api node src/scripts/seed.js
```

Detalle: [PRODUCCION_MES6.md](PRODUCCION_MES6.md)
