# Manual del semáforo de presencia (mapa)

**Para quién es:** cualquier persona que use la consola de despacho.  
**Qué explica:** de qué color se pinta cada pin y por qué.

---

## 1. La idea en una frase

El mapa es un **semáforo** que dice si alguien está disponible, un rato sin mirar el teléfono, o ya no manda señal.

```
  🟢 Verde     → «Aquí estoy, app abierta»
  🟡 Amarillo  → «App abierta pero mirando otra cosa / minimizada» (opcional)
  ⚪ Gris      → «Se acabó de desconectar» (opcional)
  🔴 Rojo      → «Hace rato que no sabemos de él» (siempre)
```

---

## 2. Dibujo del camino (como un videojuego)

```
                    ┌─────────────────┐
                    │  App ABIERTA    │
                    │  (primer plano) │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   🟢 VERDE      │
                    │   En línea      │
                    └────────┬────────┘
                             │
              minimiza / bloquea / cierra
              (pero el servicio sigue vivo)
                             │
                             ▼
              ¿Está activado el AMARILLO?
                    /              \
                  SÍ                NO
                  │                 │
                  ▼                 ▼
         espera N minutos     se queda 🟢
         (tiempo de ausencia)
                  │
                  ▼
         ┌─────────────────┐
         │  🟡 AMARILLO    │
         │  Ausente        │
         └────────┬────────┘
                  │
         se pierde la señal
         (ya no hay “ping”)
                  │
                  ▼
         ¿Está activado el GRIS?
               /            \
             SÍ              NO
             │               │
             ▼               ▼
    ┌──────────────┐   ┌──────────────┐
    │ ⚪ GRIS      │   │ 🔴 ROJO     │
    │ Desconectado │   │ Fuera línea │
    └──────┬───────┘   └──────────────┘
           │
           │ pasa M minutos
           │ (tiempo fuera de línea)
           ▼
    ┌──────────────┐
    │ 🔴 ROJO      │
    │ Fuera línea  │
    └──────────────┘
```

---

## 3. Los 4 colores (qué significan)

| Color | Nombre en el mapa | ¿Qué está pasando? | ¿Siempre existe? |
|-------|-------------------|--------------------|------------------|
| 🟢 Verde | En línea | La app está abierta y enviando “estoy vivo”. | **Sí** |
| 🟡 Amarillo | Ausente | La app sigue viva pero en 2º plano / cerrada hace un rato. | Solo si activas el check |
| ⚪ Gris | Desconectado | Ya no manda presencia; aún no llega al tiempo del rojo. | Solo si activas el check |
| 🔴 Rojo | Fuera de línea | Hace demasiado que no hay señal de vida. | **Sí** |

> **Alerta** (antes «pánico») es otra cosa. No es un color del semáforo de presencia.

---

## 4. Los interruptores (Configuración → Presencia)

Hay **dos checks independientes**:

1. **Mostrar Ausente (amarillo)**  
2. **Mostrar Desconectado (gris)**  

### Tabla mágica (qué verás)

| Amarillo | Gris | Colores en mapa / leyenda / filtro |
|----------|------|-------------------------------------|
| ☐ Off | ☐ Off | 🟢 Verde · 🔴 Rojo |
| ☑ On | ☐ Off | 🟢 Verde · 🟡 Amarillo · 🔴 Rojo |
| ☐ Off | ☑ On | 🟢 Verde · ⚪ Gris · 🔴 Rojo |
| ☑ On | ☑ On | 🟢 Verde · 🟡 Amarillo · ⚪ Gris · 🔴 Rojo |

### Qué pasa si apagas un color

- **Sin amarillo:** aunque minimicen la app, el pin **sigue verde** hasta que de verdad se desconecta.  
- **Sin gris:** al desconectarse **salta directo a rojo** (no hay etapa gris).  
- **Sin ambos:** solo verde y rojo (modo simple).

Si un color está apagado:

- **No** aparece en la **leyenda**.  
- **No** se pinta ese color en el **pin**.  
- **No** sale como opción en el filtro **Estado**.

---

## 5. Los relojes (minutos)

En la misma pantalla de Presencia hay dos números:

| Reloj | Para qué sirve | Solo aplica si… |
|-------|----------------|-----------------|
| **Tiempo de ausencia** | Cuántos minutos en 2º plano antes de volverse amarillo | El check **amarillo** está ON |
| **Tiempo fuera de línea** | Cuántos minutos en gris antes de volverse rojo | El check **gris** está ON |

Trucos:

- **0 en ausencia** = nunca amarillo (igual que apagar el check amarillo).  
- **0 en fuera de línea** = al desconectar, rojo al instante (igual que apagar el check gris).

---

## 6. Ejemplo con amigos imaginarios

Imagina 3 compañeros:

1. **Ana** — tiene la app abierta → 🟢  
2. **Beto** — metió la tablet al bolsillo hace 20 min (amarillo ON, umbral 15) → 🟡  
3. **Carla** — apagó datos hace 1 hora (gris ON, rojo a los 30 min) → 🔴  

Si apagas el **amarillo** en configuración:

- Beto ya no se pone 🟡: se queda 🟢 mientras el servicio siga vivo.  

Si apagas el **gris**:

- Cuando Carla se desconecta, no pasa por ⚪: va a 🔴.

---

## 7. Dónde se configura

1. Entra a la **consola de despacho**.  
2. Ve a **Configuración → Presencia**.  
3. Marca o desmarca:
   - ☐ Mostrar Ausente (amarillo)  
   - ☐ Mostrar Desconectado (gris)  
4. Ajusta los minutos si hace falta.  
5. Pulsa **Guardar presencia**.  
6. El mapa se actualiza al refrescar ubicaciones (unos segundos).

Es un ajuste de **organización**: todos los despachos de esa org ven el mismo semáforo.

---

## 8. Filtro “Estado” en el mapa

En la pestaña **Operadores** del mapa hay un multi-select **Estado** con checks.

Solo lista los colores **activos**.  
Puedes marcar varios a la vez (ej. solo verdes y rojos).

---

## 9. Resumen ultra corto (para memorizar)

```
🟢 = vivo y mirando
🟡 = vivo pero distraído   (si lo dejaste encendido)
⚪ = acaba de irse         (si lo dejaste encendido)
🔴 = lleva rato perdido    (siempre)
```

**Apagar un color no borra a la persona del mapa:** solo la pinta con el color “siguiente” de la cadena (amarillo→verde, gris→rojo).

---

*Documento de producto TacticalPtx / SICOM — semáforo de presencia.*
