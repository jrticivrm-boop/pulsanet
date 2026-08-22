# PulsaNet — Piloto y carga (Mes 5)

## Objetivo

Soportar ~**100 usuarios** concurrentes en señalización (Socket.IO / floor / chat / presencia) y dejar checklist de piloto.

## Validación previa (API)

Comprobado en local:

- Login, grupos, token LiveKit, chat, overview despacho, ubicaciones mapa

## App Android en móvil

APK debug (requiere **JDK 17**, no el JBR Java 25 de Android Studio):

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
cd D:\pulsanet\mobile
flutter build apk --debug --dart-define=API_BASE=http://192.168.1.66:4000
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

O USB: `flutter run --dart-define=API_BASE=http://192.168.1.66:4000`  
(Actualiza la IP Wi‑Fi si cambia; firewall TCP **4000** y **7880**.)

Ver [ANDROID_ALPHA_MES3.md](ANDROID_ALPHA_MES3.md).

## Preparar carga

```powershell
cd D:\pulsanet\backend
npm run seed          # demo base
npm run seed:load     # loaduser001…100
```

Password: `demo1234`

## Ejecutar load test

Con API + Redis arriba:

```powershell
cd D:\pulsanet\backend
npm run loadtest
# o: USERS=100 CONCURRENCY=25 ROUNDS=5 npm run loadtest
```

El script:

1. Login de N usuarios  
2. Conexión Socket.IO + `ptt:join`  
3. Ráfaga de chat  
4. Varias rondas PTT (contendientes → granted/denied)  
5. Imprime stats + `/api/metrics`

Umbral OK: ≥90% sockets conectados, ≥1 grant, sin errores de login/connect.

## Métricas

`GET http://localhost:4000/api/metrics`

Incluye sockets activos, presencia/floors Redis, contadores PTT/chat, memoria.

Rate limit: `RATE_LIMIT_MAX=5000` en `.env` para no cortar el piloto.

## Checklist piloto de campo

- [ ] 5–10 móviles reales en la misma Wi‑Fi / 4G
- [ ] Despacho web abierto (`despacho@pulsanet.local`)
- [ ] PTT: un hablante; denegado si ocupado
- [ ] Chat visible en todos los del canal
- [ ] Presencia “en línea” coherente
- [ ] Reconexión tras apagar Wi‑Fi 10 s y volver
- [ ] Latencia percibida &lt; 1 s en condiciones normales
- [ ] `npm run loadtest` en verde antes del piloto

## Fuera de Mes 5

Play/App Store, FCM, grabación 24/7, multi-tenant (Mes 6 / v2).
