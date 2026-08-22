# TacticalPtx — Validación en campo (escalón 1)

Checklist tras APK **1.8.1+5** y servicios locales.

## 0. Previo (PC) — automatizable

- [x] `LEVANTAR-TACTICALPTX.bat` / servicios arriba
- [x] Health OK: http://127.0.0.1:4000/api/health → `ready`, `db`, `redis`, `livekit`, `fcm` (re-verificado 2026-08-22 ~06:18)
- [x] Web: http://127.0.0.1:5173 responde **200**
- [ ] Login root (`ggomezd2`), rail de módulos + flecha miniatura + iconos visibles
- [ ] Barra radio: **En altavoz** (no Silenciada) y un clic en la página (desbloquea audio)

## 1. Instalar APK — humano

- [x] APK: `mobile/build/app/outputs/flutter-apk/app-release.apk` (rebuild en escalón 3 si falta)
- [ ] Desinstalar versión anterior si firma distinta
- [ ] Instalar e iniciar sesión **Pedro** (`psanchezt2`)
- [ ] Permisos: **micrófono** + **ubicación**
- [ ] Canal: **Jfa. T.I.C. (S.T.I.) IV R.M.**

## 2. Voz PTT (Pedro → Consola) — humano

- [ ] Consola PC: **Operaciones** o dock de radio
- [ ] Pedro mantiene PTT 5–10 s
- [ ] PC **oye** la voz (no solo «al aire»)
- [ ] Dock muestra a Pedro hablando

## 3. GPS (Pedro → mapa) — humano

- [ ] GPS activo en app
- [ ] ≤ 10 s: **Seguimiento** con Pedro «En vivo»
- [ ] **Mapa en vivo** + KPI «Con GPS» > 0

## 4. Redes

| Escenario | Qué usar |
|-----------|----------|
| Wi‑Fi | Misma LAN que la PC |
| 4G/5G | Tailscale o `EXPOSE-PUBLIC` / API pública |

- [ ] Al menos un escenario Wi‑Fi

## 5. Resultado

| Ítem | Estado |
|------|--------|
| Fecha | 2026-08-22 |
| PC / API | OK |
| Web 5173 | OK (HTTP) |
| Voz Pedro | **pendiente humano** |
| GPS Pedro | **pendiente humano** |

**Siguiente escalón (si PC OK):** Git init + primer commit → rebuild APK → preparar Docker/Play.
