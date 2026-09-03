@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title TacticalPtx - Levantar servicios

REM =============================================================================
REM LEVANTAR-TACTICALPTX.bat - stack local + borde publico (reforzado v2)
REM PostgreSQL + Redis + LiveKit + Firewall + API (:4000) + Web (:5173)
REM + Watch-Stack (auto-repara) + Caddy/UPnP (HTTPS publico)
REM Uso: LEVANTAR-TACTICALPTX.bat
REM      LEVANTAR-TACTICALPTX.bat /nopause
REM      LEVANTAR-TACTICALPTX.bat /strict   (exit 1 si API o Web fallan)
REM =============================================================================

set "NO_PAUSE="
set "STRICT="
if /I "%~1"=="/nopause" set "NO_PAUSE=1"
if /I "%~1"=="-nopause" set "NO_PAUSE=1"
if /I "%~2"=="/nopause" set "NO_PAUSE=1"
if /I "%~1"=="/strict" set "STRICT=1"
if /I "%~2"=="/strict" set "STRICT=1"
if /I "%~1"=="-strict" set "STRICT=1"

set "ROOT="
if exist "C:\pulsanet\backend\package.json" set "ROOT=C:\pulsanet"
if not defined ROOT if exist "D:\pulsanet\backend\package.json" set "ROOT=D:\pulsanet"
if not defined ROOT (
 set "ROOT=%~dp0"
 if "!ROOT:~-1!"=="\" set "ROOT=!ROOT:~0,-1!"
)
cd /d "%ROOT%" 2>nul
if errorlevel 1 (
 echo ERROR: no se puede entrar a %ROOT%
 if not defined NO_PAUSE pause
 exit /b 1
)
if not exist "%ROOT%\backend\package.json" (
 echo ERROR: no parece un repo TacticalPtx - falta backend\package.json
 if not defined NO_PAUSE pause
 exit /b 1
)

set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\Git\cmd;%SystemRoot%\System32;%PATH%"
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

if not exist "%ROOT%\Soporte\Logs" mkdir "%ROOT%\Soporte\Logs" >nul 2>&1
for /f "usebackq delims=" %%T in (`powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "LOG_TS=%%T"
if not defined LOG_TS set "LOG_TS=manual"
set "LOG_FILE=%ROOT%\Soporte\Logs\levantar-!LOG_TS!.log"
>>"%LOG_FILE%" echo [%DATE% %TIME%] Inicio LEVANTAR root=%ROOT%

echo.
echo === TacticalPtx: levantando servicios reforzado v2 ===
echo Root: %ROOT%
echo Log:  %LOG_FILE%
echo %DATE% %TIME%
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
if not defined LAN_IP set "LAN_IP=192.168.1.66"

echo --- Preflight puertos ---
call :preflight
echo.

echo [1/8] PostgreSQL...
call :ensure_postgres
if errorlevel 1 (
 echo AVISO: PostgreSQL no confirma RUNNING - la API puede fallar al conectar DB
 >>"%LOG_FILE%" echo [%DATE% %TIME%] AVISO PostgreSQL
) else (
 set "PG_OK=1"
 echo OK: PostgreSQL listo
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK PostgreSQL
)

echo [2/8] Redis + LiveKit start-services...
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
 echo OK: Redis :6379
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK Redis
) else (
 echo AVISO: Redis no responde - la API no arrancara sin Redis
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL Redis
)

call :wait_port 7880 20
call :port_busy 7880
if defined PORT_BUSY (
 set "LK_OK=1"
 echo OK: LiveKit escuchando :7880
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK LiveKit
) else (
 echo AVISO: LiveKit :7880 no escucha aun
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL LiveKit
)

echo [3/8] Firewall LAN reglas TacticalPtx...
if exist "%ROOT%\infra\Ensure-Firewall.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Ensure-Firewall.ps1" >nul 2>&1
 if errorlevel 1 (echo AVISO: firewall no aplicado - ejecuta como Admin si hace falta) else (echo OK: reglas firewall revisadas)
) else if exist "%ROOT%\infra\ENSURE-FIREWALL.cmd" (
 call "%ROOT%\infra\ENSURE-FIREWALL.cmd" >nul 2>&1
 echo OK: firewall via ENSURE-FIREWALL.cmd
) else (
 echo AVISO: falta Ensure-Firewall.ps1 / ENSURE-FIREWALL.cmd
)

echo [4/8] API :4000...
call :ensure_api
if errorlevel 1 goto fin_error
call :wait_api 60
if not defined API_OK (
 echo Reintento API espera extra sin matar proceso en :4000...
 call :wait_api 30
)
if not defined API_OK (
 echo Reintento API ultimo: liberar puerto + reiniciar...
 call :free_port 4000
 call :start_api_window
 call :wait_api 60
)
if defined API_OK (
 echo OK: API !API_SCHEME!://127.0.0.1:4000
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK API
) else (
 echo AVISO: API aun no responde - mira ventana TacticalPtx API
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL API
 set "EXIT_CODE=1"
)

echo [5/8] Web Vite :5173 HTTPS...
call :ensure_web
if errorlevel 1 goto fin_error
call :wait_web 45
if not defined WEB_OK (
 echo Reintento Web liberar puerto + reiniciar...
 call :free_port 5173
 call :start_web_window
 call :wait_web 45
)
if defined WEB_OK (
 echo OK: Web https://127.0.0.1:5173
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK Web
) else (
 echo AVISO: Web aun no responde - mira ventana TacticalPtx Web
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL Web
 set "EXIT_CODE=1"
)

echo [6/8] Watch-Stack auto-repara API/Web/Edge...
call :ensure_watch_stack
if defined WATCH_OK (
 echo OK: Watch-Stack activo
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK Watch-Stack
) else (
 echo AVISO: no se confirmo Watch-Stack
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL Watch-Stack
)

echo [7/8] Borde publico HTTPS Caddy 80/443 + UPnP...
if not defined API_OK (
 echo AVISO: API no lista - se intenta borde de todos modos
)
call :ensure_edge
if defined EDGE_OK (
 echo OK: Edge https://!PUBLIC_DOMAIN!/api/health
 >>"%LOG_FILE%" echo [%DATE% %TIME%] OK Edge
) else (
 echo AVISO: borde publico sin health 200 - APK 4G puede fallar
 echo        Ejecuta: infra\ENSURE-PUBLIC-EDGE.cmd
 >>"%LOG_FILE%" echo [%DATE% %TIME%] FAIL Edge
)

echo [8/8] Auto-chequeo final API/Web tras edge...
call :check_api
call :check_web
if not defined API_OK (
 echo AVISO: API cayo tras edge - reintentando ventana API...
 >>"%LOG_FILE%" echo [%DATE% %TIME%] RECOVER API
 call :start_api_window
 call :wait_api 45
)
if not defined WEB_OK (
 echo AVISO: Web cayo tras edge - reintentando ventana Web...
 >>"%LOG_FILE%" echo [%DATE% %TIME%] RECOVER Web
 call :start_web_window
 call :wait_web 30
)
if defined API_OK if defined WEB_OK (
 echo OK: API + Web estables tras edge
) else (
 set "EXIT_CODE=1"
)

goto resumen

:preflight
call :port_busy 5432
if defined PORT_BUSY (echo  :5432 PostgreSQL  LISTEN) else (echo  :5432 PostgreSQL  ---)
call :port_busy 6379
if defined PORT_BUSY (echo  :6379 Redis       LISTEN) else (echo  :6379 Redis       ---)
call :port_busy 7880
if defined PORT_BUSY (echo  :7880 LiveKit     LISTEN) else (echo  :7880 LiveKit     ---)
call :port_busy 4000
if defined PORT_BUSY (echo  :4000 API         LISTEN) else (echo  :4000 API         ---)
call :port_busy 5173
if defined PORT_BUSY (echo  :5173 Web         LISTEN) else (echo  :5173 Web         ---)
exit /b 0

:ensure_api
call :check_api
if defined API_OK (
 echo OK: API ya respondia !API_SCHEME!
 exit /b 0
)
if not exist "%ROOT%\backend\node_modules\" (
 echo Instalando dependencias API...
 pushd "%ROOT%\backend"
 call npm.cmd install --no-fund --no-audit
 if errorlevel 1 (
  echo ERROR: npm install en backend fallo
  popd
  exit /b 1
 )
 popd
)
if not exist "%ROOT%\backend\.env" (
 echo AVISO: falta backend\.env - copia .env.example y configura
)
if not exist "%ROOT%\infra\start-api.cmd" (
 echo ERROR: falta infra\start-api.cmd
 exit /b 1
)
call :port_busy 4000
if defined PORT_BUSY (
 call :check_api
 if defined API_OK (
  echo OK: API ya respondia en :4000 !API_SCHEME!
  exit /b 0
 )
 echo Puerto 4000 ocupado - esperando health no matar aun...
 call :wait_api 25
 if defined API_OK exit /b 0
 echo AVISO: :4000 ocupado sin health - liberando zombie...
 call :free_port 4000
)
call :start_api_window
exit /b 0

:start_api_window
start "TacticalPtx API" /MIN /D "%ROOT%\backend" cmd /k call "%ROOT%\infra\start-api.cmd"
echo Ventana TacticalPtx API abierta
exit /b 0

:ensure_web
call :check_web
if defined WEB_OK (
 echo OK: Web ya respondia
 exit /b 0
)
if not exist "%ROOT%\web\node_modules\" (
 echo Instalando dependencias Web...
 pushd "%ROOT%\web"
 call npm.cmd install --no-fund --no-audit
 if errorlevel 1 (
  echo ERROR: npm install en web fallo
  popd
  exit /b 1
 )
 popd
)
if not exist "%ROOT%\infra\start-web.cmd" (
 echo ERROR: falta infra\start-web.cmd
 exit /b 1
)
call :port_busy 5173
if defined PORT_BUSY (
 call :check_web
 if defined WEB_OK (
  echo OK: Web ya respondia en :5173
  exit /b 0
 )
 echo Puerto 5173 ocupado sin health - liberando zombie...
 call :free_port 5173
)
call :start_web_window
exit /b 0

:start_web_window
start "TacticalPtx Web" /MIN /D "%ROOT%\web" cmd /k call "%ROOT%\infra\start-web.cmd"
echo Ventana TacticalPtx Web abierta
exit /b 0

:ensure_watch_stack
set "WATCH_OK="
if not exist "%ROOT%\infra\Watch-Stack.ps1" (
 echo AVISO: falta infra\Watch-Stack.ps1
 exit /b 1
)
start "TacticalPtx Watch-Stack" /MIN powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Watch-Stack.ps1"
ping -n 3 127.0.0.1 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$m=New-Object System.Threading.Mutex($false,'Global\TacticalPtxWatchStack'); if(-not $m.WaitOne(0)){ exit 0 }; $m.ReleaseMutex(); $m.Dispose(); exit 1" >nul 2>&1
if not errorlevel 1 (
 set "WATCH_OK=1"
 exit /b 0
)
start "TacticalPtx Watch-Stack" /MIN powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Watch-Stack.ps1"
ping -n 3 127.0.0.1 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$m=New-Object System.Threading.Mutex($false,'Global\TacticalPtxWatchStack'); if(-not $m.WaitOne(0)){ exit 0 }; $m.ReleaseMutex(); $m.Dispose(); exit 1" >nul 2>&1
if not errorlevel 1 set "WATCH_OK=1"
exit /b 0

:ensure_edge
set "EDGE_OK="
if not defined PUBLIC_DOMAIN (
 if exist "%ROOT%\infra\START-PUBLIC-EDGE.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\START-PUBLIC-EDGE.ps1"
 )
)
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
call :check_edge
if defined EDGE_OK exit /b 0
echo Reintento borde publico...
if exist "%ROOT%\infra\START-PUBLIC-EDGE.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\START-PUBLIC-EDGE.ps1"
)
call :check_edge
exit /b 0

:check_edge
set "EDGE_OK="
if not defined PUBLIC_DOMAIN exit /b 1
curl.exe -sk --connect-timeout 6 --max-time 12 "https://!PUBLIC_DOMAIN!/api/health" 2>nul | findstr /I "tacticalptx-api" >nul
if not errorlevel 1 (
 set "EDGE_OK=1"
 exit /b 0
)
curl.exe -sk --connect-timeout 6 --max-time 12 "https://!PUBLIC_DOMAIN!/api/health" 2>nul | findstr /I "ready" >nul
if not errorlevel 1 set "EDGE_OK=1"
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
if !n! EQU 1 echo Esperando API...
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
if !n! EQU 1 echo Esperando Web...
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

:resumen
echo.
echo ========== LISTO / ESTADO ==========
if defined PG_OK (echo [OK] PostgreSQL) else (echo [--] PostgreSQL)
if defined REDIS_OK (echo [OK] Redis :6379) else (echo [--] Redis :6379)
if defined LK_OK (echo [OK] LiveKit :7880) else (echo [--] LiveKit :7880)
if defined API_OK (
 echo [OK] API  !API_SCHEME!://127.0.0.1:4000/api/health
) else (
 echo [!!] API  sin respuesta - consola/APK mostraran Error del servidor 500
 echo      Revisa ventana TacticalPtx API o Soporte\Logs\watch-stack.log
 set "EXIT_CODE=1"
)
if defined WEB_OK (
 echo [OK] Web  https://127.0.0.1:5173  - NO uses http://
) else (
 echo [!!] Web  sin respuesta
 set "EXIT_CODE=1"
)
if defined WATCH_OK (echo [OK] Watch-Stack) else (echo [--] Watch-Stack)
if defined EDGE_OK (
 echo [OK] Edge https://!PUBLIC_DOMAIN!
) else (
 echo [!!] Edge publico caido/sin health
)
echo.
if defined LAN_IP (
 echo Movil Wi-Fi:  API_BASE=!API_SCHEME!://!LAN_IP!:4000
 echo Consola LAN:  https://!LAN_IP!:5173
)
if defined PUBLIC_DOMAIN (
 echo Movil 4G/APK: https://!PUBLIC_DOMAIN!
 echo                API_BASE=https://!PUBLIC_DOMAIN!
)
echo LiveKit:       ws://127.0.0.1:7880  UDP 7882
if exist "%ROOT%\Soporte\APK\TacticalPtx-latest.apk" (
 echo APK:           Soporte\APK\TacticalPtx-latest.apk
)
echo Log watchdog:  Soporte\Logs\watch-stack.log
echo Log levantar:  %LOG_FILE%
echo ====================================
>>"%LOG_FILE%" echo [%DATE% %TIME%] Fin EXIT=!EXIT_CODE! API=!API_OK! WEB=!WEB_OK! EDGE=!EDGE_OK!
echo.

if defined WEB_OK if defined API_OK (
 start "" "https://127.0.0.1:5173"
) else (
 echo No se abrio el navegador: API o Web aun no listas
)
goto fin

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
set "EC=!EXIT_CODE!"
if defined STRICT if not "!EC!"=="0" (
 echo Modo /strict: fallaron servicios criticos API/Web
 if not defined NO_PAUSE pause
 endlocal & exit /b 1
)
if not defined NO_PAUSE pause
endlocal & exit /b %EC%

REM -----------------------------------------------------------------------------
:detect_lan
set "LAN_IP="
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
for %%S in (postgresql-x64-18 postgresql-x64-17 postgresql-x64-16 postgresql-x64-15) do (
 sc.exe query "%%S" >nul 2>&1
 if not errorlevel 1 (
  set "PG_SVC=%%S"
  goto pg_found
 )
)
call :port_busy 5432
if defined PORT_BUSY (
 echo OK: PostgreSQL escuchando en :5432 servicio no detectado por nombre
 exit /b 0
)
echo AVISO: no se encontro servicio PostgreSQL
exit /b 1

:pg_found
sc.exe query "%PG_SVC%" 2>nul | find "RUNNING" >nul
if not errorlevel 1 exit /b 0
echo Iniciando %PG_SVC%...
sc.exe config "%PG_SVC%" start= demand >nul 2>&1
net start "%PG_SVC%" >nul 2>&1
ping -n 3 127.0.0.1 >nul
sc.exe query "%PG_SVC%" 2>nul | find "RUNNING" >nul
if not errorlevel 1 exit /b 0
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
set "PORT=%~1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=%PORT%; Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop } catch {} }" >nul 2>&1
ping -n 2 127.0.0.1 >nul
exit /b 0

:port_busy
set "PORT_BUSY="
set "PORT=%~1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=%PORT%; $c=@(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue); if($c.Count -gt 0){ exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 set "PORT_BUSY=1"
exit /b 0
