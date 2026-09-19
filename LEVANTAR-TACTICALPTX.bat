@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title TacticalPtx - Levantar servicios

REM =============================================================================
REM LEVANTAR-TACTICALPTX.bat - stack local + borde publico (v4 una sola ventana)
REM PostgreSQL + Redis + LiveKit + Firewall + API (:4000) + Web (:5173)
REM + Supervisor (autorearranque, sin CMD extra) + Caddy/UPnP
REM Uso: LEVANTAR-TACTICALPTX.bat
REM      LEVANTAR-TACTICALPTX.bat /nopause
REM      LEVANTAR-TACTICALPTX.bat /strict   (exit 1 si API o Web fallan)
REM      LEVANTAR-TACTICALPTX.bat /noedge   (solo LAN, sin Caddy/UPnP)
REM =============================================================================

set "NO_PAUSE="
set "STRICT="
set "NO_EDGE="
if /I "%~1"=="/nopause" set "NO_PAUSE=1"
if /I "%~1"=="-nopause" set "NO_PAUSE=1"
if /I "%~2"=="/nopause" set "NO_PAUSE=1"
if /I "%~3"=="/nopause" set "NO_PAUSE=1"
if /I "%~1"=="/strict" set "STRICT=1"
if /I "%~2"=="/strict" set "STRICT=1"
if /I "%~1"=="-strict" set "STRICT=1"
if /I "%~1"=="/noedge" set "NO_EDGE=1"
if /I "%~2"=="/noedge" set "NO_EDGE=1"
if /I "%~3"=="/noedge" set "NO_EDGE=1"

REM Preferir la carpeta del .bat (portable); luego C:/D: legacy.
REM %~dp0 SIEMPRE trae barra final. NUNCA usar if ...=="\" (rompe el parseo CMD → error «"f"»).
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
if not exist "%ROOT%\backend\package.json" set "ROOT="
if not defined ROOT if exist "C:\pulsanet\backend\package.json" set "ROOT=C:\pulsanet"
if not defined ROOT if exist "D:\pulsanet\backend\package.json" set "ROOT=D:\pulsanet"
if not defined ROOT (
  set "ROOT=%~dp0"
  set "ROOT=%ROOT:~0,-1%"
)
if not defined ROOT (
  echo ERROR: no se encontro el repo TacticalPtx
  if not defined NO_PAUSE pause
  exit /b 1
)
cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo ERROR: no se puede entrar a "%ROOT%"
  if not defined NO_PAUSE pause
  exit /b 1
)
if not exist "%ROOT%\backend\package.json" (
  echo ERROR: no parece un repo TacticalPtx - falta backend\package.json
  if not defined NO_PAUSE pause
  exit /b 1
)

REM PATH portable: Node + PG 15-18 + Redis + Git (si existen)
set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\PostgreSQL\16\bin;C:\Program Files\PostgreSQL\15\bin;C:\Program Files\Redis;C:\Program Files\Git\cmd;%SystemRoot%\System32;%PATH%"
for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%~D\bin\psql.exe" set "PATH=%%~D\bin;!PATH!"
set "API_OK="
set "API_SCHEME=http"
set "WEB_OK="
set "LK_OK="
set "EDGE_OK="
set "WATCH_OK="
set "LAN_IP="
set "PUBLIC_HOST="
set "PUBLIC_DOMAIN="
set "PG_SVC="
set "PG_OK="
set "REDIS_OK="
set "EXIT_CODE=0"

set "AUX_ROOT=C:\pulsanet_soporte"
if not exist "%AUX_ROOT%" set "AUX_ROOT=%ROOT%\var"
if not exist "%AUX_ROOT%\Logs" mkdir "%AUX_ROOT%\Logs" >nul 2>&1
if not exist "%ROOT%\var\logs" mkdir "%ROOT%\var\logs" >nul 2>&1
for /f "usebackq delims=" %%T in (`powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "LOG_TS=%%T"
if not defined LOG_TS set "LOG_TS=manual"
set "LOG_FILE=%AUX_ROOT%\Logs\levantar-!LOG_TS!.log"
>>"%LOG_FILE%" echo [%DATE% %TIME%] Inicio LEVANTAR root=%ROOT%

echo.
echo === TacticalPtx: stack local + borde publico (1 ventana) ===
echo Root: %ROOT%
echo UI:   frontend\  ^(Vite HTTPS puerto 5173^)   API: backend\  ^(puerto 4000^)
echo Log:  %LOG_FILE%
echo %DATE% %TIME%
echo.

echo --- Limpieza logs / cache ---
if exist "%ROOT%\infra\Clear-StackCache.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Clear-StackCache.ps1" -RepoRoot "%ROOT%"
) else (
 echo AVISO: falta Clear-StackCache.ps1
)
REM Cerrar CMD/PowerShell huerfanos de arranques previos (API/Web/Watch)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$me=$PID; Get-CimInstance Win32_Process -EA SilentlyContinue | Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -and ($_.CommandLine -match 'start-api\.cmd|start-web\.cmd|Watch-Stack\.ps1|Run-StackSupervisor\.ps1|TacticalPtx API|TacticalPtx Web|TacticalPtx Watch') } | ForEach-Object { try { taskkill.exe /F /T /PID $_.ProcessId 2>$null | Out-Null } catch {} }" >nul 2>&1
echo.

where.exe node.exe >nul 2>&1
if errorlevel 1 (
 echo ERROR: Node.js no esta en PATH. Instala LTS o agrega C:\Program Files\nodejs
 goto fin_error
)
where.exe npm.cmd >nul 2>&1
if errorlevel 1 (
 echo ERROR: npm.cmd no encontrado
 goto fin_error
)
where.exe curl.exe >nul 2>&1
if errorlevel 1 (
 echo AVISO: curl.exe no encontrado - el health check puede fallar
)

if exist "%ROOT%\backend\.env" (
 for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /I /R "^PUBLIC_DOMAIN= ^LIVEKIT_PUBLIC_HOST=" "%ROOT%\backend\.env" 2^>nul`) do (
  if /I "%%A"=="PUBLIC_DOMAIN" (
   set "PUBLIC_DOMAIN=%%B"
   set "PUBLIC_DOMAIN=!PUBLIC_DOMAIN:"=!"
   set "PUBLIC_DOMAIN=!PUBLIC_DOMAIN:'=!"
  )
  if /I "%%A"=="LIVEKIT_PUBLIC_HOST" (
   set "PUBLIC_HOST=%%B"
   set "PUBLIC_HOST=!PUBLIC_HOST:"=!"
   set "PUBLIC_HOST=!PUBLIC_HOST:'=!"
  )
 )
) else (
 echo AVISO: falta backend\.env - copia .env.example
)
if not defined PUBLIC_DOMAIN if defined PUBLIC_HOST set "PUBLIC_DOMAIN=!PUBLIC_HOST!.sslip.io"

call :detect_lan
REM Sin IP inventada (antes 192.168.1.66 rompia otras redes).
REM Canonico host Ethernet: 192.168.1.77 (APK SERVER_LAN_IP). Si DHCP dio otra, avisar.
if defined LAN_IP if /I not "!LAN_IP!"=="192.168.1.77" (
 echo AVISO: LAN=!LAN_IP!  ^(canonico del proyecto: 192.168.1.77^)
 echo        Para fijarla: powershell -File infra\Set-StableLanIp.ps1
 >>"%LOG_FILE%" echo [%DATE% %TIME%] AVISO LAN=!LAN_IP! no es .77
)

echo --- Preflight puertos ---
call :preflight
echo.

echo [1/8] PostgreSQL + base de datos
call :ensure_postgres
if errorlevel 1 (
 echo AVISO: PostgreSQL no confirma RUNNING - la API puede fallar al conectar DB
 >>"%LOG_FILE%" echo [%DATE% %TIME%] AVISO PostgreSQL
) else (
 set "PG_OK=1"
 echo OK: PostgreSQL listo
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK PostgreSQL
)
if defined PG_OK if exist "%ROOT%\CREAR-O-ACTUALIZAR-BD.bat" goto apply_bd
goto after_bd

:apply_bd
echo Aplicando esquema/migraciones ^(idempotente: no borra datos^)
call "%ROOT%\CREAR-O-ACTUALIZAR-BD.bat" /nopause
if errorlevel 1 (
 echo AVISO: CREAR-O-ACTUALIZAR-BD reporto error - revisa backend\.env DATABASE_URL
 >>"%LOG_FILE%" echo [%DATE% %TIME%] AVISO BD apply
) else (
 echo OK: base de datos al dia
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK BD apply
)

:after_bd

echo [2/8] Redis + LiveKit start-services
if not exist "%ROOT%\infra\start-services.ps1" (
 echo ERROR: falta infra\start-services.ps1
 goto fin_error
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\start-services.ps1"
if errorlevel 1 (
 echo AVISO: start-services.ps1 reporto error - revisa LiveKit/Redis
 >>"%LOG_FILE%" echo [%DATE% %TIME%] AVISO start-services
) else (
 echo OK: Redis/LiveKit procesados
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK start-services
)

call :ensure_redis
if defined REDIS_OK (
 echo OK: Redis puerto 6379
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK Redis
) else (
 echo AVISO: Redis no responde - la API no arrancara sin Redis
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL Redis
)

call :wait_port 7880 20
call :port_busy 7880
if defined PORT_BUSY (
 set "LK_OK=1"
 echo OK: LiveKit escuchando puerto 7880
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK LiveKit
) else (
 echo AVISO: LiveKit puerto 7880 no escucha aun
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL LiveKit
)

echo [3/8] Firewall LAN reglas TacticalPtx
if exist "%ROOT%\infra\Ensure-Firewall.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Ensure-Firewall.ps1" >nul 2>&1
 if errorlevel 1 (echo AVISO: firewall no aplicado - ejecuta como Admin si hace falta) else (echo OK: reglas firewall revisadas)
) else if exist "%ROOT%\infra\ENSURE-FIREWALL.cmd" (
 call "%ROOT%\infra\ENSURE-FIREWALL.cmd" >nul 2>&1
 echo OK: firewall via ENSURE-FIREWALL.cmd
) else (
 echo AVISO: falta Ensure-Firewall.ps1 / ENSURE-FIREWALL.cmd
)

echo [4/8] Dependencias API/Web ^(sin abrir ventanas^)
call :ensure_api_deps
if errorlevel 1 goto fin_error
call :ensure_web_deps
if errorlevel 1 goto fin_error

echo [5/8] Arranque inicial API + Web ^(oculto^)
REM Limpiar PORT residual de :port_busy / :wait_port (nunca debe ser 7880 aqui)
set "PORT="
>>"%LOG_FILE%" echo [%DATE% %TIME%] BEGIN API/Web bootstrap
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Run-StackSupervisor.ps1" -Once -SkipEdge -NoBrowser
if errorlevel 1 (
  echo AVISO: bootstrap API/Web incompleto - el supervisor reintentara
  >>"%LOG_FILE%" echo [%DATE% %TIME%] AVISO bootstrap
) else (
  echo OK: API/Web respondieron
  >>"%LOG_FILE%" echo [%DATE% %TIME%] OK bootstrap
)

echo [6/8] Borde publico HTTPS Caddy 80/443 + UPnP
if defined NO_EDGE (
 echo Omitido ^(/noedge^) - solo stack local
 >>"%LOG_FILE%" echo [%DATE% %TIME%] SKIP Edge
) else (
 REM Si Caddy no escucha 443, forzar borde (no depender solo del supervisor /noedge).
 call :port_busy 443
 if not defined PORT_BUSY (
  echo Caddy :443 caido - arrancando borde publico
  >>"%LOG_FILE%" echo [%DATE% %TIME%] Caddy 443 down - START edge
 )
 call :ensure_edge
 if defined EDGE_OK (
  echo OK: Edge publico health OK
  >>"%LOG_FILE%" echo [%DATE% %TIME%] OK Edge
 ) else (
  echo AVISO: borde publico sin health WAN/UPnP - APK 4G puede fallar
  echo        1^) Activa UPnP en el router / port-forward 80+443
  echo        2^) Luego el supervisor reintentara solo
  echo        Nota: desde esta misma PC el WAN puede dar 000 ^(hairpin Telmex^);
  echo        prueba LOCAL con --resolve o desde 4G.
  >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL Edge
 )
)

echo [7/8] Supervisor unico ^(vigilancia + autorearranque^)
echo       Esta ventana se queda vigilando. Ctrl+C para detener.
>>"%LOG_FILE%" echo [%DATE% %TIME%] BEGIN Supervisor
if not exist "%ROOT%\infra\Run-StackSupervisor.ps1" (
 echo ERROR: falta infra\Run-StackSupervisor.ps1
 goto fin_error
)

REM Resumen previo al bloqueo del supervisor
echo.
echo ========== ARRANQUE / ESTADO BASE ==========
if defined PG_OK (echo [OK] PostgreSQL) else (echo [--] PostgreSQL)
if defined REDIS_OK (echo [OK] Redis puerto 6379) else (echo [--] Redis puerto 6379)
if defined LK_OK (echo [OK] LiveKit puerto 7880) else (echo [--] LiveKit puerto 7880)
if defined EDGE_OK (
 echo [OK] Edge https://!PUBLIC_DOMAIN!
) else (
 if defined NO_EDGE (echo [--] Edge omitido /noedge) else (echo [--] Edge pendiente / reintento en supervisor)
)
echo Consola: https://127.0.0.1:5173
echo API:     https://127.0.0.1:4000/api/health
if defined LAN_IP echo LAN IP:  !LAN_IP!
echo Logs:    %AUX_ROOT%\Logs\  ^(api-out, web-out, watch-stack.log^)
echo ============================================
echo.
>>"%LOG_FILE%" echo [%DATE% %TIME%] Hand-off supervisor

REM Misma consola: no start, no ventanas extra.
if defined NO_EDGE (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Run-StackSupervisor.ps1" -IntervalSec 12 -EdgeEveryN 5 -SkipEdge
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Run-StackSupervisor.ps1" -IntervalSec 12 -EdgeEveryN 5
)
set "EXIT_CODE=!ERRORLEVEL!"
>>"%LOG_FILE%" echo [%DATE% %TIME%] Supervisor exit=!EXIT_CODE!
goto fin

REM --- deps (antes abrían ventanas; ahora solo npm install) ---
:ensure_api_deps
if not exist "%ROOT%\backend\node_modules" goto ensure_api_npm
goto ensure_api_deps_ok

:ensure_api_npm
echo Instalando dependencias API
pushd "%ROOT%\backend"
call npm.cmd install --no-fund --no-audit
if errorlevel 1 (
 echo ERROR: npm install en backend fallo
 popd
 exit /b 1
)
popd

:ensure_api_deps_ok
if not exist "%ROOT%\backend\.env" (
 echo AVISO: falta backend\.env - copia .env.example y configura
)
exit /b 0

:ensure_web_deps
if not exist "%ROOT%\frontend\node_modules" goto ensure_web_npm
exit /b 0

:ensure_web_npm
echo Instalando dependencias Web frontend
pushd "%ROOT%\frontend"
call npm.cmd install --no-fund --no-audit
if errorlevel 1 (
 echo ERROR: npm install en frontend fallo
 popd
 exit /b 1
)
popd
exit /b 0

:ensure_api
call :ensure_api_deps
exit /b %ERRORLEVEL%

:ensure_web
call :ensure_web_deps
exit /b %ERRORLEVEL%

:start_api_window
REM Compat: ya no abre ventana; el supervisor gestiona API
exit /b 0

:start_web_window
exit /b 0

:ensure_watch_stack
REM Compat: supervisor unico sustituye Watch-Stack en ventana aparte
set "WATCH_OK=1"
exit /b 0

:ensure_edge
set "EDGE_OK="
if not exist "%ROOT%\infra\caddy\caddy.exe" (
 echo AVISO: falta infra\caddy\caddy.exe - START-PUBLIC-EDGE lo descargara
)
REM Un solo arranque de borde (antes podia llamar START dos veces si faltaba PUBLIC_DOMAIN).
if exist "%ROOT%\infra\ENSURE-PUBLIC-EDGE.cmd" (
 call "%ROOT%\infra\ENSURE-PUBLIC-EDGE.cmd"
) else if exist "%ROOT%\infra\ENSURE-PUBLIC-EDGE.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\ENSURE-PUBLIC-EDGE.ps1"
) else if exist "%ROOT%\infra\START-PUBLIC-EDGE.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\START-PUBLIC-EDGE.ps1"
) else (
 echo AVISO: falta script de borde publico
 exit /b 1
)
REM Alinear hosts locales al LAN actual (evita .77 viejo → dominio muerto en este PC)
if exist "%ROOT%\infra\Fix-DuckdnsHairpin.ps1" (
 if defined LAN_IP (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Fix-DuckdnsHairpin.ps1" -LanIp "!LAN_IP!"
 ) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Fix-DuckdnsHairpin.ps1"
 )
)
call :check_edge
if defined EDGE_OK exit /b 0
echo Reintento borde publico...
if exist "%ROOT%\infra\START-PUBLIC-EDGE.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\START-PUBLIC-EDGE.ps1"
)
if exist "%ROOT%\infra\Fix-DuckdnsHairpin.ps1" (
 if defined LAN_IP (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Fix-DuckdnsHairpin.ps1" -LanIp "!LAN_IP!"
 ) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Fix-DuckdnsHairpin.ps1"
 )
)
call :check_edge
exit /b 0

:preflight
call :port_busy 5432
if defined PORT_BUSY (echo  puerto 5432 PostgreSQL  LISTEN) else (echo  puerto 5432 PostgreSQL  ---)
call :port_busy 6379
if defined PORT_BUSY (echo  puerto 6379 Redis       LISTEN) else (echo  puerto 6379 Redis       ---)
call :port_busy 7880
if defined PORT_BUSY (echo  puerto 7880 LiveKit     LISTEN) else (echo  puerto 7880 LiveKit     ---)
call :port_busy 4000
if defined PORT_BUSY (echo  puerto 4000 API         LISTEN) else (echo  puerto 4000 API         ---)
call :port_busy 5173
if defined PORT_BUSY (echo  puerto 5173 Web         LISTEN) else (echo  puerto 5173 Web         ---)
exit /b 0

:check_edge
set "EDGE_OK="
set "EDGE_LOCAL_OK="
set "EDGE_UPNP_OK="
if not defined PUBLIC_DOMAIN exit /b 1
REM 1) Health local sin hairpin (--resolve a LAN o 127.0.0.1)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ". '%ROOT%\infra\Sync-PublicIp.ps1'; $s=Get-TpxEdgeStatus -Root '%ROOT%'; if($s.LocalOk){exit 0}else{exit 1}" >nul 2>&1
if not errorlevel 1 (
 set "EDGE_LOCAL_OK=1"
 set "EDGE_OK=1"
)
REM 2) UPnP IGD (necesario para 4G)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ". '%ROOT%\infra\Sync-PublicIp.ps1'; if(Test-TpxUPnPAvailable){exit 0}else{exit 1}" >nul 2>&1
if not errorlevel 1 set "EDGE_UPNP_OK=1"
REM 3) WAN directo (puede fallar por hairpin desde LAN)
curl.exe -sk --connect-timeout 6 --max-time 12 "https://!PUBLIC_DOMAIN!/api/health" 2>nul | findstr /I "tacticalptx-api" >nul
if not errorlevel 1 (
 set "EDGE_OK=1"
 exit /b 0
)
if defined EDGE_LOCAL_OK (
 if not defined EDGE_UPNP_OK (
  echo AVISO: Edge LOCAL OK pero UPnP/WAN ROTO - APK 4G fallara
  echo        Abre en el router TCP 80 y 443 hacia la IP LAN Wi-Fi
  set "EDGE_OK="
 )
 exit /b 0
)
exit /b 0

:wait_api
set /a n=0
set /a max=%~1
if "%~1"=="" set /a max=45
:wait_api_loop
call :check_api
if defined API_OK exit /b 0
set /a n+=1
if !n! GEQ !max! exit /b 1
if !n! EQU 1 echo Esperando API
ping -n 2 127.0.0.1 >nul
goto wait_api_loop

:wait_web
set /a n=0
set /a max=%~1
if "%~1"=="" set /a max=45
:wait_web_loop
call :check_web
if defined WEB_OK exit /b 0
set /a n+=1
if !n! GEQ !max! exit /b 1
if !n! EQU 1 echo Esperando Web
ping -n 2 127.0.0.1 >nul
goto wait_web_loop

:wait_port
set "WP=%~1"
set /a wn=0
set /a wmax=%~2
if "%~2"=="" set /a wmax=15
:wait_port_loop
call :port_busy !WP!
if defined PORT_BUSY exit /b 0
set /a wn+=1
if !wn! GEQ !wmax! exit /b 1
ping -n 2 127.0.0.1 >nul
goto wait_port_loop

:fin_error
echo.
echo ========== FALLO ==========
echo Revisa los mensajes de arriba.
echo Log: %LOG_FILE%
echo.
>>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL fatal
if not defined NO_PAUSE pause
endlocal
exit /b 1

:fin
echo.
echo Supervisor detenido. Para volver a levantar: LEVANTAR-TACTICALPTX.bat
set "EC=!EXIT_CODE!"
if not defined EC set "EC=0"
if defined STRICT if not "!EC!"=="0" (
 echo Modo /strict: codigo !EC!
 if not defined NO_PAUSE pause
 endlocal & exit /b 1
)
if not defined NO_PAUSE pause
endlocal & exit /b %EC%

REM -----------------------------------------------------------------------------
:detect_lan
set "LAN_IP="
REM Host estable: preferir Ethernet 192.168.1.x (cable); mesh 68.x solo si no hay 1.x
for /f "tokens=2 delims=:" %%A in ('ipconfig.exe 2^>nul ^| findstr /R /C:"IPv4"') do (
 set "_ip=%%A"
 set "_ip=!_ip: =!"
 echo !_ip! | findstr /B "192.168.1." >nul
 if not errorlevel 1 (
 set "LAN_IP=!_ip!"
 goto :eof
 )
)
for /f "tokens=2 delims=:" %%A in ('ipconfig.exe 2^>nul ^| findstr /R /C:"IPv4"') do (
 set "_ip=%%A"
 set "_ip=!_ip: =!"
 echo !_ip! | findstr /B "192.168.68." >nul
 if not errorlevel 1 (
 set "LAN_IP=!_ip!"
 goto :eof
 )
)
for /f "tokens=2 delims=:" %%A in ('ipconfig.exe 2^>nul ^| findstr /R /C:"IPv4"') do (
 set "_ip=%%A"
 set "_ip=!_ip: =!"
 echo !_ip! | findstr /B "192.168." >nul
 if not errorlevel 1 (
 set "LAN_IP=!_ip!"
 goto :eof
 )
)
for /f "tokens=2 delims=:" %%A in ('ipconfig.exe 2^>nul ^| findstr /R /C:"IPv4"') do (
 set "_ip=%%A"
 set "_ip=!_ip: =!"
 echo !_ip! | findstr /B "10." >nul
 if not errorlevel 1 (
 set "LAN_IP=!_ip!"
 goto :eof
 )
)
goto :eof

:ensure_redis
set "REDIS_OK="
call :port_busy 6379
if not defined PORT_BUSY exit /b 1
where.exe redis-cli.exe >nul 2>&1
if errorlevel 1 (
 set "REDIS_OK=1"
 exit /b 0
)
redis-cli.exe ping 2>nul | findstr /I "PONG" >nul
if not errorlevel 1 set "REDIS_OK=1"
exit /b 0

:ensure_postgres
set "PG_SVC="
for %%S in (postgresql-x64-18 postgresql-x64-17 postgresql-x64-16 postgresql-x64-15) do (
 sc.exe query "%%S" >nul 2>&1
 if not errorlevel 1 (
  set "PG_SVC=%%S"
  goto pg_found
 )
)
REM Descubrir por nombre parcial (otra instalacion / edition)
for /f "tokens=1,*" %%A in ('powershell.exe -NoProfile -Command "Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name" 2^>nul') do (
 if not "%%A"=="" (
  set "PG_SVC=%%A"
  goto pg_found
 )
)
call :port_busy 5432
if defined PORT_BUSY (
 echo OK: PostgreSQL escuchando puerto 5432 ^(servicio no detectado por nombre^)
 exit /b 0
)
echo AVISO: no se encontro servicio PostgreSQL
exit /b 1

:pg_found
echo Servicio PostgreSQL: %PG_SVC%
sc.exe query "%PG_SVC%" 2>nul | find "RUNNING" >nul
if not errorlevel 1 exit /b 0
echo Iniciando %PG_SVC%...
sc.exe config "%PG_SVC%" start= demand >nul 2>&1
net start "%PG_SVC%" >nul 2>&1
ping -n 3 127.0.0.1 >nul
sc.exe query "%PG_SVC%" 2>nul | find "RUNNING" >nul
if not errorlevel 1 exit /b 0
call :port_busy 5432
if defined PORT_BUSY (
 echo OK: puerto 5432 LISTEN tras intento de arranque
 exit /b 0
)
echo No se pudo iniciar %PG_SVC% - prueba como Administrador o services.msc
exit /b 1

:check_api
set "API_OK="
set "API_SCHEME=http"
curl.exe -sk --connect-timeout 3 --max-time 10 "https://127.0.0.1:4000/api/health" 2>nul | findstr /I "tacticalptx-api" >nul
if not errorlevel 1 (
 set "API_OK=1"
 set "API_SCHEME=https"
 exit /b 0
)
curl.exe -s --connect-timeout 3 --max-time 10 "http://127.0.0.1:4000/api/health" 2>nul | findstr /I "tacticalptx-api" >nul
if not errorlevel 1 (
 set "API_OK=1"
 set "API_SCHEME=http"
 exit /b 0
)
curl.exe -sk --connect-timeout 3 --max-time 10 "https://127.0.0.1:4000/api/health" 2>nul | findstr /I "\"ok\":true" >nul
if not errorlevel 1 (
 set "API_OK=1"
 set "API_SCHEME=https"
 exit /b 0
)
curl.exe -s --connect-timeout 3 --max-time 10 "http://127.0.0.1:4000/api/health" 2>nul | findstr /I "\"ok\":true" >nul
if not errorlevel 1 (
 set "API_OK=1"
 set "API_SCHEME=http"
 exit /b 0
)
exit /b 1

:check_web
set "WEB_OK="
curl.exe -sk --connect-timeout 2 --max-time 6 "https://127.0.0.1:5173/" >nul 2>&1
if not errorlevel 1 (
 set "WEB_OK=1"
 exit /b 0
)
curl.exe -sk --connect-timeout 2 --max-time 6 "https://localhost:5173/" >nul 2>&1
if not errorlevel 1 (
 set "WEB_OK=1"
 exit /b 0
)
curl.exe -s --connect-timeout 2 --max-time 6 "http://127.0.0.1:5173/" >nul 2>&1
if not errorlevel 1 (
 set "WEB_OK=1"
 exit /b 0
)
exit /b 1

:free_port
REM NUNCA usar variable PORT aqui: contamina el entorno y la API hereda PORT=7880 (LiveKit).
set "CHK_PORT=%~1"
REM Evitar Get-NetTCPConnection (puede colgar el BAT). No usar $PID (reservado en PS).
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=%CHK_PORT%; $lines = netstat -ano | Select-String -Pattern (':'+ $p + '\s+.+\s+LISTENING'); foreach ($l in $lines) { if ($l -match '(\d+)\s*$') { $procId=[int]$Matches[1]; if ($procId -gt 0) { try { Stop-Process -Id $procId -Force -ErrorAction Stop } catch {} } } }" >nul 2>&1
set "CHK_PORT="
ping -n 2 127.0.0.1 >nul
exit /b 0

:port_busy
set "PORT_BUSY="
REM CHK_PORT (no PORT): si queda PORT=7880, node/dotenv lo usa y la API pisa LiveKit.
set "CHK_PORT=%~1"
netstat -ano 2>nul | findstr /R /C:":%CHK_PORT% .*LISTENING" >nul
if not errorlevel 1 set "PORT_BUSY=1"
set "CHK_PORT="
exit /b 0
