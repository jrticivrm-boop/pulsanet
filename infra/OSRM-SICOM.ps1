<#
.SYNOPSIS
  Servidor de rutas propio (OSRM) en la VM SICOM: mapa de México de OpenStreetMap.

.DESCRIPTION
  Corre como contenedor APARTE (sicom-osrm) en la red Docker de SICOM (tacticalptx_default,
  alias "osrm"); no publica puertos al exterior ni toca la app, la BD ni otros contenedores.
  La API lo usa cuando .env.prod tiene ROUTING_OSRM_URL=http://osrm:5000 (y se reinicia la API).

  -Accion instalar   Descarga México (Geofabrik), lo procesa (extract/partition/customize, MLD)
                     y (re)levanta el contenedor. También sirve para ACTUALIZAR el mapa (cada 1-3 meses):
                     mientras procesa, el contenedor anterior sigue respondiendo.
                     Corre en segundo plano en la VM (~20-40 min); ver avance con -Accion estado.
  -Accion estado     Avance del procesamiento, estado del contenedor y una ruta de prueba.
  -Accion quitar     Detiene y elimina el contenedor (los datos quedan en disco).

  Modifica la VM: solo con orden explícita del usuario.

.EXAMPLE
  .\infra\OSRM-SICOM.ps1 -Accion instalar
  .\infra\OSRM-SICOM.ps1 -Accion estado
#>
param(
  [ValidateSet('instalar', 'estado', 'quitar')]
  [string]$Accion = 'estado'
)

$ErrorActionPreference = 'Stop'
$VmHost = 'pulsanet@192.168.1.150'
$Key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_sicom'
$SshOpts = @('-i', $Key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10')
$Dir = '/opt/pulsanet_soporte/osrm'

$build = @'
#!/usr/bin/env bash
set -euo pipefail
D=/opt/pulsanet_soporte/osrm
IMG=ghcr.io/project-osrm/osrm-backend:v6.0.0
NET=tacticalptx_default
NAME=sicom-osrm
PBF_URL=https://download.geofabrik.de/north-america/mexico-latest.osm.pbf
cd "$D"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Inicio. Imagen $IMG"
docker pull -q "$IMG"
# Restos de una corrida anterior (pueden ser de root si la imagen corrió sin --user).
docker run --rm -v "$D:/w" "$IMG" sh -c 'rm -rf /w/build.old; [ -d /w/build ] && mv /w/build /w/build.old || true'
mkdir build
# Reusar el mapa descargado hace menos de 2 días (reintentos tras un fallo).
if [ -f build.old/mexico.osm.pbf ] && [ -n "$(find build.old/mexico.osm.pbf -mtime -2)" ]; then
  mv build.old/mexico.osm.pbf build/mexico.osm.pbf
  log "Reusando mapa ya descargado: $(du -h build/mexico.osm.pbf | cut -f1)"
else
  log "Descargando mapa de México (Geofabrik)…"
  curl -fsSL --retry 3 -o build/mexico.osm.pbf "$PBF_URL"
  log "Descargado: $(du -h build/mexico.osm.pbf | cut -f1)"
fi
docker run --rm -v "$D:/w" "$IMG" rm -rf /w/build.old

# Topes para no quitarle CPU/RAM a SICOM mientras procesa (México pide ~11 GB en extract).
RUN="docker run --rm --user $(id -u):$(id -g) --cpus 4 --memory 13g --memory-swap 13g -v $D/build:/data $IMG"
log "1/3 osrm-extract (perfil vehículo)…"
nice -n 10 $RUN osrm-extract -p /opt/car.lua /data/mexico.osm.pbf > build/extract.log 2>&1 || { tail -20 build/extract.log; exit 1; }
log "2/3 osrm-partition…"
nice -n 10 $RUN osrm-partition /data/mexico.osrm > build/partition.log 2>&1 || { tail -20 build/partition.log; exit 1; }
log "3/3 osrm-customize…"
nice -n 10 $RUN osrm-customize /data/mexico.osrm > build/customize.log 2>&1 || { tail -20 build/customize.log; exit 1; }
rm -f build/mexico.osm.pbf
date -Iseconds > build/MAPA_FECHA

log "Cambiando al mapa nuevo…"
rm -rf data.old
if [ -d data ]; then mv data data.old; fi
mv build data
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  --network "$NET" --network-alias osrm --memory 6g \
  -v "$D/data:/data" "$IMG" \
  osrm-routed --algorithm mld --max-table-size 200 --max-alternatives 3 /data/mexico.osrm > /dev/null
sleep 20
docker exec tacticalptx-api-1 node -e "fetch('http://osrm:5000/route/v1/driving/-97.8573,22.2165;-97.8366,22.2485?overview=false').then(r=>r.json()).then(j=>console.log('Prueba Tampico:', j.code, Math.round(j.routes[0].distance)+' m')).catch(e=>{console.log('Prueba falló:', e.message);process.exit(1)})"
rm -rf data.old
log "FIN OK — servidor de rutas propio listo en http://osrm:5000 (red $NET)"
'@

function Invoke-Vm([string]$cmd) {
  & ssh @SshOpts $VmHost $cmd
  if ($LASTEXITCODE -ne 0) { throw "Falló en la VM (código $LASTEXITCODE)." }
}

switch ($Accion) {
  'instalar' {
    $running = (& ssh @SshOpts $VmHost "pgrep -f '[o]srm-build.sh' >/dev/null && echo SI || echo NO").Trim()
    if ($running -eq 'SI') { Write-Host 'Ya hay un procesamiento en curso. Usa -Accion estado.'; break }
    Write-Host "Copiando script a la VM ($Dir)…"
    Invoke-Vm "mkdir -p $Dir"
    ($build -replace "`r`n", "`n") | & ssh @SshOpts $VmHost "sed '1s/^\xEF\xBB\xBF//' > $Dir/osrm-build.sh && chmod +x $Dir/osrm-build.sh"
    & ssh -n @SshOpts $VmHost "cd $Dir && (setsid bash ./osrm-build.sh > osrm-build.log 2>&1 < /dev/null &)"
    Write-Host 'Procesamiento iniciado en segundo plano (20-40 min). Avance: .\infra\OSRM-SICOM.ps1 -Accion estado'
  }
  'estado' {
    Invoke-Vm @"
cd $Dir 2>/dev/null || { echo 'OSRM no instalado.'; exit 0; }
echo '== Procesamiento =='
if pgrep -f '[o]srm-build.sh' >/dev/null; then echo 'EN CURSO'; else echo 'sin procesamiento activo'; fi
tail -n 8 osrm-build.log 2>/dev/null || true
echo '== Contenedor =='
docker ps -a --filter name=sicom-osrm --format '{{.Names}} {{.Status}}' || true
test -f data/MAPA_FECHA && echo "Mapa procesado: `$(cat data/MAPA_FECHA)"
du -sh data 2>/dev/null || true
docker stats --no-stream --format '{{.Name}} RAM {{.MemUsage}}' sicom-osrm 2>/dev/null || true
"@
  }
  'quitar' {
    Invoke-Vm "docker rm -f sicom-osrm >/dev/null 2>&1; echo 'Contenedor sicom-osrm eliminado (datos en $Dir/data).'"
  }
}
