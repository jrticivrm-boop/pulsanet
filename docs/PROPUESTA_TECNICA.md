# TacticalPtx — Propuesta técnica (1 página)

## Resumen

**TacticalPtx** es una plataforma PTT (*Push-to-Talk*) sobre internet para equipos de campo. Replica lo esencial de soluciones enterprise (voz instantánea por grupos, chat, mapa, despacho web) usando celular/Wi‑Fi, sin radios físicos ni infraestructura de carrier.

| Parámetro | Valor |
|-----------|-------|
| Usuarios | 1,000 |
| Plataformas | Web + Android + iOS |
| Plazo | 6 meses |
| Presupuesto | ~$500,000 MXN |
| Modelo | Producto independiente, despliegue propio |

---

## Stack tecnológico

| Capa | Tecnología | Motivo |
|------|------------|--------|
| App móvil | **Flutter** | Una codebase → Android + iOS |
| Web despacho | **React + Vite** | Panel rico, mapas, admin |
| API | **Node.js + Express** | WebSocket nativo, ecosistema RTC |
| Tiempo real voz | **LiveKit** (SFU) | PTT de baja latencia sin reinventar WebRTC |
| Tiempo real señales | **Socket.IO** | PTT floor, presencia, chat |
| Base de datos | **PostgreSQL** | Relacional, robusto para 1K+ usuarios |
| Cache / presencia | **Redis** | Online/offline, sesiones, pub/sub |
| Push | **Firebase Cloud Messaging** | Android + iOS |
| Mapas | **Leaflet + OpenStreetMap** | Sin costo por tile en v1 |
| Auth | **JWT + refresh tokens** | Stateless, multi-dispositivo |

---

## Arquitectura

```
[Apps Flutter] ──► [API REST + Socket.IO] ──► [PostgreSQL]
[Web React] ──► │ ──► [Redis]
 ▼
 [LiveKit Cloud/Self]
 (audio PTT por grupo)
```

- **Señalización PTT** (quién habla, botón presionado): Socket.IO 
- **Audio**: LiveKit rooms (1 room = 1 grupo PTT) 
- **Floor control**: solo 1 `speaker` activo por room; backend valida 

---

## Presupuesto (6 meses)

| Concepto | MXN |
|----------|-----|
| Desarrollo (1 dev senior × 6 meses) | 330,000 |
| UI/UX + QA | 50,000 |
| Infraestructura (servidor, BD, Redis) | 40,000 |
| LiveKit / voz en tiempo real | 30,000 |
| Contingencia | 50,000 |
| **Total** | **~500,000** |

**Operación mensual post-lanzamiento:** ~$15,000–$30,000 MXN (hosting + voz según uso).

---

## Equipo mínimo

- 1 desarrollador full-stack senior (Flutter + Node + WebRTC)
- 1 diseñador UI/UX (parcial)
- Product owner / cliente (pruebas, usuarios piloto)

---

## Entregables v1.0

1. API documentada (OpenAPI)
2. App Android (Play Store)
3. App iOS (App Store)
4. Panel web de despacho
5. Manual de instalación y usuario
6. Esquema BD + scripts de migración

---

## Próximo paso inmediato

1. Aprobar alcance v1 (`docs/ALCANCE_V1.md`)
2. Provisionar servidor de desarrollo (Laragon local + staging cloud)
3. Mes 1: auth + grupos + demo PTT con 5 usuarios

---

*TacticalPtx — Propuesta téchnica v1 — 2026*
