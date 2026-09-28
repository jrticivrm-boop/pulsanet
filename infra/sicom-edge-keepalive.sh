#!/usr/bin/env bash
# TacticalPtx / SICOM — reemplazo Linux de ENSURE-PUBLIC-EDGE (tarea TacticalPtx-EdgeKeepalive).
# 1) UPnP: 80/443 (Caddy) + LiveKit media 7881/tcp, 7882/udp, 3478/udp -> IP LAN de esta VM.
# 2) DuckDNS: actualiza el A-record con la IP pública actual.
# 3) LiveKit: si la IP pública cambió, actualiza node_ip en infra/livekit.sicom.yaml y reinicia el contenedor.
# Cron (cada 10 min):  */10 * * * * /opt/pulsanet/infra/sicom-edge-keepalive.sh >> /var/log/sicom-edge.log 2>&1
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAN_IP="${SICOM_LAN_IP:-$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')}"
echo "== $(date -Is) LAN=$LAN_IP"

if command -v upnpc >/dev/null 2>&1 && [ -n "$LAN_IP" ] && upnpc -s >/dev/null 2>&1; then
  while read -r port proto desc; do
    [ -z "$port" ] && continue
    upnpc -d "$port" "$proto" >/dev/null 2>&1 || true
    if upnpc -e "$desc" -a "$LAN_IP" "$port" "$port" "$proto" 0 >/dev/null 2>&1; then
      echo "UPnP OK $proto/$port -> $LAN_IP:$port"
    else
      echo "UPnP FALLO $proto/$port"
    fi
  done <<'MAPS'
80 TCP TacticalPtx-HTTPS-80
443 TCP TacticalPtx-HTTPS-443
7881 TCP TacticalPtx-LiveKit-RTC
7882 UDP TacticalPtx-LiveKit-Media
3478 UDP TacticalPtx-LiveKit-TURN
MAPS
else
  echo "UPnP omitido (router sin IGD/UPnP, sin upnpc o sin IP LAN): reenvío manual en el router"
fi

SECRETS=""
for f in "$ROOT/infra/secrets/stable-domain.env" "$ROOT/Soporte/Secrets/stable-domain.env"; do
  [ -f "$f" ] && { SECRETS="$f"; break; }
done
if [ -n "$SECRETS" ]; then
  SUB="$(grep -E '^DUCKDNS_SUBDOMAIN=' "$SECRETS" | head -1 | cut -d= -f2- | tr -d '\r\357\273\277 ')"
  TOKEN="$(grep -E '^DUCKDNS_TOKEN=' "$SECRETS" | head -1 | cut -d= -f2- | tr -d '\r ')"
  if [ -n "$SUB" ] && [ -n "$TOKEN" ]; then
    R="$(curl -fsS --max-time 20 "https://www.duckdns.org/update?domains=${SUB}&token=${TOKEN}&ip=" || echo ERR)"
    echo "DuckDNS $SUB -> $R"
  fi
else
  echo "DuckDNS omitido (sin stable-domain.env en infra/secrets ni Soporte/Secrets)"
fi

LK_YAML="$ROOT/infra/livekit.sicom.yaml"
if [ -f "$LK_YAML" ]; then
  PUB_IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || curl -fsS --max-time 10 https://ifconfig.me/ip 2>/dev/null || true)"
  CUR_IP="$(grep -E '^\s*node_ip:' "$LK_YAML" | head -1 | awk '{print $2}')"
  if ! echo "$PUB_IP" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    echo "LiveKit node_ip: IP pública no disponible, sin cambios ($CUR_IP)"
  elif [ "$PUB_IP" = "$CUR_IP" ]; then
    echo "LiveKit node_ip OK ($CUR_IP)"
  else
    # Escritura in situ: el archivo está montado como bind de archivo único en el contenedor.
    NEW_CONTENT="$(sed -E "s/^(\s*node_ip:).*/\1 $PUB_IP/" "$LK_YAML")"
    printf '%s\n' "$NEW_CONTENT" > "$LK_YAML"
    if docker restart tacticalptx-livekit-1 >/dev/null 2>&1; then
      echo "LiveKit node_ip $CUR_IP -> $PUB_IP (contenedor reiniciado)"
    else
      echo "LiveKit node_ip $CUR_IP -> $PUB_IP (FALLO al reiniciar contenedor)"
    fi
  fi
fi
