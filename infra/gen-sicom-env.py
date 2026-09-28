#!/usr/bin/env python3
"""Genera infra/.env.sicom y infra/livekit.sicom.yaml a partir de backend/.env (VM SICOM).

Conserva las llaves (JWT, CONTENT/WIRE_ENCRYPTION_KEY, LiveKit...) tal cual: si cambian,
el chat cifrado y las sesiones existentes dejan de ser válidas.
Solo ajusta lo que depende del host (IP LAN, IPv6, CORS). docker-compose.sicom.yml
sobrescribe además rutas Windows, DATABASE_URL, REDIS_URL y LIVEKIT_URL.
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "backend", ".env")
OUT_ENV = os.path.join(HERE, ".env.sicom")
OUT_LK = os.path.join(HERE, "livekit.sicom.yaml")

LAN_IP = os.environ.get("SICOM_LAN_IP", "192.168.1.150")


def global_ipv6():
    try:
        out = subprocess.run(["ip", "-6", "-o", "addr", "show", "scope", "global"],
                             capture_output=True, text=True, check=True).stdout
    except Exception:
        return ""
    for line in out.splitlines():
        if "temporary" in line or "docker" in line or " br-" in line:
            continue
        m = re.search(r"inet6 ([0-9a-f:]+)/", line)
        if m:
            return m.group(1)
    return ""


def unquote(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


lines = open(SRC, encoding="utf-8-sig").read().splitlines()
env = {}
order = []
for raw in lines:
    s = raw.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    k = k.strip()
    if k not in env:
        order.append(k)
    env[k] = unquote(v)

for req in ("LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "JWT_SECRET", "CONTENT_ENCRYPTION_KEY",
            "WIRE_ENCRYPTION_KEY", "LIVEKIT_E2EE_SECRET", "APP_UPDATE_SECRET"):
    if not env.get(req):
        sys.exit(f"FALTA {req} en backend/.env")

# LiveKit fuera de --dev rechaza secretos < 32; los tokens los firma este mismo API,
# así que un secreto propio del servidor es transparente para los clientes.
if len(env["LIVEKIT_API_SECRET"]) < 32:
    secret_file = os.path.join(HERE, ".livekit_secret_sicom")
    if not os.path.exists(secret_file):
        import secrets as _secrets
        with open(secret_file, "w", encoding="utf-8") as f:
            f.write(_secrets.token_urlsafe(36))
        os.chmod(secret_file, 0o600)
    env["LIVEKIT_API_SECRET"] = open(secret_file, encoding="utf-8").read().strip()
    if env["LIVEKIT_API_KEY"] == "devkey":
        env["LIVEKIT_API_KEY"] = "tacticalptxkey"

ipv6 = global_ipv6()
env["LIVEKIT_LAN_HOST"] = LAN_IP
env["PUBLIC_LAN_IP"] = LAN_IP
if ipv6:
    env["PUBLIC_LAN_IPV6"] = ipv6
else:
    env.pop("PUBLIC_LAN_IPV6", None)

cors = [o.strip() for o in env.get("CORS_ORIGINS", "").split(",") if o.strip()]
# Orígenes de la PC de desarrollo (localhost, otras IP LAN) no aplican en la VM.
cors = [o for o in cors
        if not re.match(r"^https?://(localhost|127\.0\.0\.1|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)", o, re.I)]
for o in (f"https://{LAN_IP}", f"http://{LAN_IP}"):
    if o not in cors:
        cors.append(o)
env["CORS_ORIGINS"] = ",".join(cors)

# Rutas Windows: las define el compose (o no aplican en Linux).
for k in ("FIREBASE_SERVICE_ACCOUNT", "TLS_CERT", "TLS_KEY", "PG_DUMP_BIN", "PSQL_BIN"):
    env.pop(k, None)

for k in ("LIVEKIT_LAN_HOST", "PUBLIC_LAN_IP", "PUBLIC_LAN_IPV6", "CORS_ORIGINS"):
    if k in env and k not in order:
        order.append(k)

with open(OUT_ENV, "w", encoding="utf-8", newline="\n") as f:
    f.write("# Generado por gen-sicom-env.py desde backend/.env — no editar a mano.\n")
    for k in order:
        if k in env:
            v = env[k].replace("\n", "\\n")
            f.write(f"{k}={v}\n")
os.chmod(OUT_ENV, 0o600)

public_ip = env.get("LIVEKIT_PUBLIC_HOST") or env.get("PUBLIC_HOST") or ""
lk = [
    "# Generado por gen-sicom-env.py — claves = LIVEKIT_API_KEY/SECRET de backend/.env",
    "port: 7880",
    "bind_addresses:",
    '  - "0.0.0.0"',
    "rtc:",
    "  tcp_port: 7881",
    "  udp_port: 7882",
    "  use_external_ip: false",
]
if public_ip:
    lk.append(f"  node_ip: {public_ip}")
lk += [
    "  advertise_internal_ip: true",
    "  congestion_control:",
    "    enabled: true",
    "    allow_pause: false",
]
if public_ip:
    lk += ["turn:", "  enabled: true", f"  domain: {public_ip}", "  udp_port: 3478"]
lk += [
    "keys:",
    f"  {env['LIVEKIT_API_KEY']}: {env['LIVEKIT_API_SECRET']}",
    "logging:",
    "  level: info",
]
with open(OUT_LK, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lk) + "\n")
os.chmod(OUT_LK, 0o644)

print(f"OK {OUT_ENV} ({len(order)} claves) y {OUT_LK}; LAN={LAN_IP} IPv6={ipv6 or '-'} node_ip={public_ip or '-'}")
