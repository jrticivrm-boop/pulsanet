#!/usr/bin/env bash
# Despliegue a PRODUCCIÓN en la VM SICOM (/opt/pulsanet, rama main).
# Se invoca desde la PC con infra\DEPLOY-SICOM.ps1 (vía SSH); también se puede correr a mano:
#   bash /opt/pulsanet/infra/sicom-deploy.sh [auto|api|web|all] [--migrate] [--dry-run]
#
# - auto: reconstruye solo lo que cambió entre el commit desplegado y origin/main.
# - Migraciones nuevas (database/migrations/*.sql): el deploy se detiene salvo --migrate,
#   que primero respalda la BD (pg_dump -Fc) y luego aplica cada .sql con ON_ERROR_STOP.
set -euo pipefail

REPO=/opt/pulsanet
INFRA="$REPO/infra"
BACKUPS=/opt/respaldos
LOG="$BACKUPS/deploys.log"
HEALTH_URL="https://192.168.1.150/api/health"

TARGET=auto
MIGRATE=0
DRY=0
for a in "$@"; do
  case "$a" in
    auto|api|web|all) TARGET="$a" ;;
    --migrate) MIGRATE=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "Argumento no válido: $a" >&2; exit 2 ;;
  esac
done

cd "$REPO"
mkdir -p "$BACKUPS"

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  echo "[ERROR] /opt/pulsanet está en '$branch'; producción debe estar en main." >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "[ERROR] Hay cambios locales en archivos versionados de la VM (no se edita en producción):" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

git fetch -q origin main
old=$(git rev-parse HEAD)
new=$(git rev-parse origin/main)
echo "Desplegado: $(git log -1 --format='%h %s' "$old")"
echo "Nuevo:      $(git log -1 --format='%h %s' "$new")"

changed=""
if [ "$old" != "$new" ]; then
  if ! git merge-base --is-ancestor "$old" "$new"; then
    echo "[ERROR] origin/main no avanza desde lo desplegado (historia reescrita). Revisar a mano." >&2
    exit 1
  fi
  changed=$(git diff --name-only "$old" "$new")
  echo "Archivos cambiados: $(echo "$changed" | grep -c . || true)"
fi

new_migrations=$(git diff --name-only --diff-filter=A "$old" "$new" -- 'database/migrations/*.sql' | sort || true)
if [ -n "$new_migrations" ]; then
  echo "Migraciones nuevas:"; echo "$new_migrations" | sed 's/^/  - /'
  if [ "$MIGRATE" != 1 ]; then
    echo "[ALTO] Hay migraciones de BD. Vuelve a correr con --migrate (respalda la BD antes de aplicar)." >&2
    exit 3
  fi
fi

services=""
full_stack=0
restart_proxy=0
restart_livekit=0
case "$TARGET" in
  api) services="api" ;;
  web) services="web" ;;
  all) services="api web" ;;
  auto)
    echo "$changed" | grep -q '^backend/' && services="$services api"
    echo "$changed" | grep -q '^frontend/' && services="$services web"
    echo "$changed" | grep -q '^infra/docker-compose.sicom.yml$' && full_stack=1
    echo "$changed" | grep -q '^infra/Caddyfile.sicom$' && restart_proxy=1
    echo "$changed" | grep -q '^infra/gen-sicom-env.py$' && restart_livekit=1
    ;;
esac
services=$(echo $services)

if [ "$full_stack" = 1 ]; then
  echo "Compose cambió: se recrea todo el stack (corte breve de BD/voz)"
else
  echo "Servicios a reconstruir: ${services:-ninguno}"
fi
[ "$restart_proxy" = 1 ] && echo "Caddy: recargar configuración"
[ "$restart_livekit" = 1 ] && echo "LiveKit/env: regenerar y reiniciar"

if [ "$DRY" = 1 ]; then
  echo "(dry-run: no se aplicó nada)"
  exit 0
fi

git merge -q --ff-only "$new"

cd "$INFRA"
DC=(docker compose -f docker-compose.sicom.yml --env-file .env.prod)
set -a; . ./.env.prod; set +a
PGU="${POSTGRES_USER:-tacticalptx}"
PGD="${POSTGRES_DB:-tacticalptx_db}"

if [ -n "$new_migrations" ]; then
  ts=$(date +%Y%m%d_%H%M%S)
  dump="$BACKUPS/pre_deploy_${ts}.dump"
  echo "Respaldando BD → $dump"
  "${DC[@]}" exec -T postgres pg_dump -U "$PGU" -d "$PGD" -Fc > "$dump"
  [ -s "$dump" ] || { echo "[ERROR] Respaldo vacío; no se aplican migraciones." >&2; exit 1; }
  for m in $new_migrations; do
    echo "Aplicando $m"
    "${DC[@]}" exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$PGU" -d "$PGD" < "$REPO/$m"
  done
fi

if [ "$restart_livekit" = 1 ]; then
  python3 gen-sicom-env.py
  "${DC[@]}" up -d --force-recreate livekit api
fi

if [ "$full_stack" = 1 ]; then
  "${DC[@]}" up -d --build
  services="(todo)"
elif [ -n "$services" ]; then
  # shellcheck disable=SC2086
  "${DC[@]}" up -d --build $services
fi

if [ "$restart_proxy" = 1 ]; then
  "${DC[@]}" exec -T proxy caddy reload --config /etc/caddy/Caddyfile
fi

ok=0
for _ in $(seq 1 30); do
  if curl -fsk -m 5 "$HEALTH_URL" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done

docker image prune -f >/dev/null 2>&1 || true

status=OK
[ "$ok" = 1 ] || status=FALLO_HEALTH
echo "$(date '+%F %T') $status $(git -C "$REPO" rev-parse --short "$old") -> $(git -C "$REPO" rev-parse --short HEAD) servicios=[${services}] migraciones=[$(echo $new_migrations)]" >> "$LOG"

if [ "$ok" = 1 ]; then
  echo "[OK] Producción responde: $HEALTH_URL"
else
  echo "[ERROR] /api/health no respondió en 60 s. Revisa: ${DC[*]} logs --tail 80 api" >&2
  exit 4
fi
