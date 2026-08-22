# PulsaNet — Alcance v1.0

**Producto:** Comunicación Push-to-Talk (PTT) por internet  
**Usuarios objetivo:** 1,000  
**Plataformas:** Web (despacho), Android, iOS  
**Plazo:** 6 meses  
**Presupuesto referencia:** ~$500,000 MXN  

---

## Objetivo

Sistema propio de comunicación instantánea por grupos, vía celular o Wi‑Fi, con voz PTT, mensajería y ubicación en mapa. Producto **independiente**, sin relación con Birretón ni otros proyectos.

---

## Incluido en v1.0

### Autenticación y usuarios
- Registro/login (correo + contraseña)
- Perfiles: administrador, despachador, operador
- Activar/desactivar usuarios
- Sesión en múltiples dispositivos (1 móvil + web)

### Grupos (canales PTT)
- Crear, editar, archivar grupos
- Asignar usuarios a uno o varios grupos
- Roles por grupo: líder, miembro, solo escucha
- Grupos públicos (toda la org) y privados

### Push-to-Talk (voz)
- Botón PTT: presionar para hablar, soltar para cortar
- Un hablante activo por grupo (floor control)
- Indicador visual: quién está hablando
- Reconexión automática si cae la red
- Latencia objetivo: < 500 ms en condiciones normales 4G/Wi‑Fi

### Mensajería
- Texto por grupo
- Envío de fotos (hasta 10 MB) e archivos (hasta 25 MB) — **v1.1**
- Historial consultable (últimos 90 días)
- *(DM individual: pendiente)*

### Ubicación
- Compartir ubicación en tiempo real (opt-in) — web + Android **v1.1**
- Mapa en panel web con posición de usuarios
- Historial de rutas (polyline) en despacho — **v1.1**
- Última ubicación conocida si está offline

### Panel web (despacho)
- Dashboard: usuarios online, grupos activos
- Mapa en vivo
- Gestión de usuarios y grupos
- Ver historial de mensajes

### Apps móviles (Android + iOS)
- Lista de grupos
- PTT con botón grande
- Chat del grupo
- Notificaciones push (llamada PTT entrante, mensajes)
- Modo background (PTT con app minimizada)

### Administración
- Panel de configuración de la organización
- Logs de actividad (login, cambios de grupo)
- Exportación básica de usuarios (CSV)

---

## Excluido de v1.0 (fases futuras)

| Función | Fase |
|---------|------|
| Integración con radios físicos (MOTOTRBO, etc.) | v2+ |
| Grabación legal/certificada de audio 24/7 | v2 |
| Videollamada / video PTT | v2 |
| Geocercas con alertas automáticas | v2 |
| Mensajería DM (1:1) | v1.2 |
| Multi-organización (SaaS multi-tenant) | v2 |
| Facturación / suscripciones integradas | v2 |
| Intercomunicación entre organizaciones | v3 |
| App de escritorio nativa (Windows/Mac) | v2 (web basta en v1) |
| Mensajes de voz pregrabados | v2 |
| Traducción simultánea | v3 |
| Notificaciones push FCM | v1.2 |
| PTT en background | v1.2 |

---

## Criterios de aceptación v1.0

1. **1,000 usuarios** registrados sin degradación notable del servicio
2. **50 usuarios simultáneos** hablando en grupos distintos en prueba de carga
3. PTT funcional en **Android 10+**, **iOS 15+** y **Chrome/Edge/Firefox** recientes
4. Tiempo de reconexión tras pérdida de red **< 10 segundos**
5. Panel web operativo para despacho con mapa
6. Documentación de instalación y manual de usuario básico

---

## Hitos por mes

| Mes | Hito |
|-----|------|
| 1 | Auth, usuarios, grupos, demo PTT 5 usuarios |
| 2 | PTT multipersona, chat, presencia online |
| 3 | App Android alpha |
| 4 | Panel web despacho + iOS TestFlight |
| 5 | Piloto 100 usuarios, pruebas de carga |
| 6 | v1.0 producción, Play Store + App Store |

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Latencia alta en 4G débil | Servidor en región cercana; LiveKit SFU |
| Batería en background | Optimizar keep-alive; PTT solo cuando app activa en v1 |
| Rechazo App Store | Cumplir políticas de VoIP; privacy policy |
| Presupuesto ajustado | Flutter (1 codebase móvil); servicios administrados |

---

*Documento v1 — PulsaNet — 2026*
