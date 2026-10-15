<#
.SYNOPSIS
  Buscador propio (Photon) en la VM SICOM: calles, colonias, direcciones y lugares de México (OpenStreetMap).

.DESCRIPTION
  Corre como contenedor APARTE (sicom-photon) en la red Docker de SICOM (tacticalptx_default,
  alias "photon"); no publica puertos al exterior ni toca la app, la BD ni otros contenedores.
  La API lo usa como respaldo/complemento del Photon público cuando .env.sicom tiene
  GEOCODER_LOCAL_URL=http://photon:2322 (y se recrea la API en un despliegue).

  -Accion instalar   Descarga el índice de México ya preparado por GraphHopper (Photon 1.x, se
                     publica cada semana, ~0.8 GB) y (re)levanta el contenedor. También sirve para
                     ACTUALIZAR: el índice nuevo se prepara aparte y solo al final se cambia.
                     Corre en segundo plano en la VM (~5-10 min); ver avance con -Accion estado.
  -Accion estado     Avance, estado del contenedor, fecha del índice y una búsqueda de prueba.
  -Accion programar  Actualización automática semanal (cron del usuario pulsanet, domingo 03:30).
                     Mientras se cambia el índice (~1 min) la consola usa el buscador en línea.
  -Accion quitar     Detiene y elimina el contenedor y la actualización programada (los datos quedan en disco).

  Modifica la VM: solo con orden explícita del usuario.

.EXAMPLE
  .\infra\PHOTON-SICOM.ps1 -Accion instalar
  .\infra\PHOTON-SICOM.ps1 -Accion estado
#>
param(
  [ValidateSet('instalar', 'estado', 'programar', 'quitar')]
  [string]$Accion = 'estado'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object Text.UTF8Encoding $false
[Console]::OutputEncoding = $OutputEncoding
$VmHost = 'pulsanet@192.168.1.150'
$Key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_sicom'
$SshOpts = @('-i', $Key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10')
$Dir = '/opt/pulsanet_soporte/photon'

$build = @'
#!/usr/bin/env bash
set -euo pipefail
D=/opt/pulsanet_soporte/photon
VER=1.3.0
JAR_URL=https://github.com/komoot/photon/releases/download/$VER/photon-$VER.jar
JAR_SHA=a89707c0045e4807b2a1180e132e68e108d998709f48b6c94b98a6e281f571a5
DB_URL=https://download1.graphhopper.com/public/north-america/mexico/photon-db-mexico-1.0-latest.tar.bz2
IMG=eclipse-temurin:21-jre
NET=tacticalptx_default
NAME=sicom-photon
cd "$D"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Inicio. Photon $VER"
FREE_GB=$(df -BG --output=avail "$D" | tail -1 | tr -dc '0-9')
if [ "$FREE_GB" -lt 10 ]; then
  log "ERROR: solo ${FREE_GB} GB libres en disco (se necesitan 10 para preparar el índice nuevo). No se tocó el actual."
  exit 1
fi
docker pull -q "$IMG" >/dev/null
docker pull -q alpine:3.20 >/dev/null
if [ ! -f "photon-$VER.jar" ] || ! echo "$JAR_SHA  photon-$VER.jar" | sha256sum -c --quiet; then
  log "Descargando photon-$VER.jar…"
  curl -fsSL --retry 3 -o "photon-$VER.jar.tmp" "$JAR_URL"
  echo "$JAR_SHA  photon-$VER.jar.tmp" | sha256sum -c --quiet
  mv "photon-$VER.jar.tmp" "photon-$VER.jar"
fi

docker run --rm -v "$D:/w" alpine:3.20 sh -c 'rm -rf /w/build'
mkdir build
log "Descargando índice de México (GraphHopper, semanal)…"
curl -fsSL --retry 3 -o build/db.tar.bz2 "$DB_URL"
curl -fsSL --retry 3 -o build/db.tar.bz2.md5 "$DB_URL.md5"
( cd build && echo "$(awk '{print $1}' db.tar.bz2.md5)  db.tar.bz2" | md5sum -c --quiet )
log "Descargado y verificado: $(du -h build/db.tar.bz2 | cut -f1). Descomprimiendo…"
docker run --rm --user "$(id -u):$(id -g)" -v "$D/build:/b" alpine:3.20 sh -c \
  'cd /b && tar -xjf db.tar.bz2 && rm db.tar.bz2 db.tar.bz2.md5' \
  || docker run --rm -v "$D/build:/b" alpine:3.20 sh -c \
  "apk add -q --no-cache tar lbzip2 && cd /b && tar -I lbzip2 -xf db.tar.bz2 && rm db.tar.bz2 db.tar.bz2.md5 && chown -R $(id -u):$(id -g) /b"
test -d build/photon_data || { log "ERROR: el índice no trae photon_data"; ls -la build; exit 1; }
date -Iseconds > build/INDICE_FECHA
log "Índice listo: $(du -sh build/photon_data | cut -f1)"

log "Cambiando al índice nuevo…"
rm -rf data.old
if [ -d data ]; then mv data data.old; fi
mv build data
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  --network "$NET" --network-alias photon --memory 4g --memory-swap 4g \
  -e JAVA_TOOL_OPTIONS="-Xmx2g" \
  -v "$D/data:/photon" -v "$D/photon-$VER.jar:/photon.jar:ro" -w /photon "$IMG" \
  java -jar /photon.jar serve -data-dir /photon -listen-ip 0.0.0.0 -listen-port 2322 > /dev/null
for i in $(seq 1 60); do
  if docker exec tacticalptx-api-1 node -e "fetch('http://photon:2322/api?q=tampico&limit=1').then(r=>r.json()).then(j=>{const p=j.features[0].properties;console.log('Prueba:',p.name,'·',p.state);process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; then
    rm -rf data.old
    log "FIN OK — buscador propio listo en http://photon:2322 (red $NET)"
    exit 0
  fi
  sleep 5
done
log "ERROR: Photon no respondió en 5 min. Últimas líneas:"
docker logs --tail 30 "$NAME" 2>&1 || true
if [ -d data.old ]; then
  log "Regresando al índice anterior…"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf data.bad; mv data data.bad; mv data.old data
  docker run -d --name "$NAME" --restart unless-stopped \
    --network "$NET" --network-alias photon --memory 4g --memory-swap 4g \
    -e JAVA_TOOL_OPTIONS="-Xmx2g" \
    -v "$D/data:/photon" -v "$D/photon-$VER.jar:/photon.jar:ro" -w /photon "$IMG" \
    java -jar /photon.jar serve -data-dir /photon -listen-ip 0.0.0.0 -listen-port 2322 > /dev/null
fi
exit 1
'@

function Invoke-Vm([string]$cmd) {
  & ssh @SshOpts $VmHost $cmd
  if ($LASTEXITCODE -ne 0) { throw "Falló en la VM (código $LASTEXITCODE)." }
}

switch ($Accion) {
  'instalar' {
    $running = (& ssh @SshOpts $VmHost "pgrep -f '[p]hoton-build.sh' >/dev/null && echo SI || echo NO").Trim()
    if ($running -eq 'SI') { Write-Host 'Ya hay una instalación en curso. Usa -Accion estado.'; break }
    Write-Host "Copiando script a la VM ($Dir)…"
    Invoke-Vm "mkdir -p $Dir"
    ($build -replace "`r`n", "`n") | & ssh @SshOpts $VmHost "sed '1s/^\xEF\xBB\xBF//' > $Dir/photon-build.sh && chmod +x $Dir/photon-build.sh"
    & ssh -n @SshOpts $VmHost "cd $Dir && (setsid bash ./photon-build.sh > photon-build.log 2>&1 < /dev/null &)"
    Write-Host 'Instalación iniciada en segundo plano (5-10 min). Avance: .\infra\PHOTON-SICOM.ps1 -Accion estado'
  }
  'estado' {
    Invoke-Vm @"
cd $Dir 2>/dev/null || { echo 'Photon no instalado.'; exit 0; }
echo '== Instalación =='
if pgrep -f '[p]hoton-build.sh' >/dev/null; then echo 'EN CURSO'; else echo 'sin instalación activa'; fi
tail -n 8 photon-build.log 2>/dev/null || true
echo '== Contenedor =='
docker ps -a --filter name=sicom-photon --format '{{.Names}} {{.Status}}' || true
test -f data/INDICE_FECHA && echo "Índice descargado: `$(cat data/INDICE_FECHA)"
du -sh data 2>/dev/null || true
docker stats --no-stream --format '{{.Name}} RAM {{.MemUsage}}' sicom-photon 2>/dev/null || true
"@
  }
  'programar' {
    Invoke-Vm "test -f $Dir/data/INDICE_FECHA || { echo 'Primero: -Accion instalar'; exit 1; }"
    ($build -replace "`r`n", "`n") | & ssh @SshOpts $VmHost "sed '1s/^\xEF\xBB\xBF//' > $Dir/photon-build.sh && chmod +x $Dir/photon-build.sh"
    $cron = @"
LINE='30 3 * * 0 cd $Dir && ! pgrep -f "^bash \./(osrm|photon)-build\.sh" >/dev/null && bash ./photon-build.sh > photon-build.log 2>&1'
{ crontab -l 2>/dev/null | grep -v -e 'photon-build.sh' -e 'pulsanet_soporte/photon`$' || true; echo "`$LINE"; } | crontab -
crontab -l | grep photon-build
"@
    $cron | & ssh @SshOpts $VmHost "tr -d '\015' | bash"
    if ($LASTEXITCODE -ne 0) { throw "Falló en la VM (código $LASTEXITCODE)." }
    Write-Host 'Actualización semanal programada (domingo 03:30).'
  }
  'quitar' {
    Invoke-Vm "(crontab -l 2>/dev/null | grep -v 'photon-build.sh') | crontab -; docker rm -f sicom-photon >/dev/null 2>&1; echo 'Contenedor sicom-photon eliminado (datos en $Dir/data).'"
  }
}
