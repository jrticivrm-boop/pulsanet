# Plan escalonado TacticalPtx 1.8.x

Orden fijo. No saltar a Docker/Play sin cerrar 1→3.

## Escalón 1 — Validación campo
- **Estado PC:** OK (API ready, web 5173, LiveKit/FCM).
- **Estado humano:** pendiente voz + GPS con Pedro (`psanchezt2`).
- Checklist: `Soporte/Documentos/VALIDACION_CAMPO_1_8_0.md`

## Escalón 2 — Git
- **Hecho:** repo en `D:\pulsanet`, rama `main`, commit inicial `027fb0d` (287 archivos, sin secretos).
- Identidad del commit vía env (sin `git config`): `TacticalPtx <dev@tacticalptx.local>`.
- Si quieres tu nombre real: configura tú `user.name` / `user.email` y siguientes commits usarán eso.

## Escalón 3 — APK 1.8.1
- **Hecho:** rebuild release OK (89.3 MB), `API_BASE=http://192.168.1.66:4000`
- Salida: `mobile/build/app/outputs/flutter-apk/app-release.apk`
- Copia: `Soporte/APK/TacticalPtx-1.8.1+5-release.apk` (no versionada)

## Escalón 4 — Docker / Play (cuando toque)
- **No ejecutar aún** hasta voz/GPS OK.
- Docker Desktop: **no instalado** en esta PC → ver [docs/DOCKER_PROD.md](../../docs/DOCKER_PROD.md)
- Play: [docs/PLAY_STORE.md](../../docs/PLAY_STORE.md) — cuenta + AAB; keystore fuera de Git

## Cómo continuar
1. Tú: completar secciones 1–3 del checklist Pedro (marcar Voz/GPS OK).
2. Avisar → se marca escalón 1 cerrado y se corta release/changelog 1.8.1.
3. Solo entonces: `docker compose …` o `flutter build appbundle`.
