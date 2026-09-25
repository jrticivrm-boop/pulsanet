# Alcance 5 — Estado vigente del sistema

**24-sep-2026** · Registro de usuarios · Creación de grupos · Visualización en mapa  
Referencia de lo ya definido e implementado en TacticalPtx / SICOM.

Consolida Alcances 3–4 y los ajustes recientes de membresía en grupos.

## 1. Tres capas (no confundir)

| Capa | Qué es |
|------|--------|
| **Pertenencia** | Dónde queda anclado el usuario al alta (región / zona / unidad). |
| **Mapa** | A quién ves: matriz de roles + territorio GPS. Nadie oculta ubicación. |
| **Canal** | Grupo/radio PTT con alcance región\|zona\|unidad. Hablar = ser miembro. |

Pertenencia ≠ mapa ≠ canal.

## 2. Registro / alta de usuarios

### Quién puede crear a quién

| Quién da de alta | Puede crear |
|------------------|---------------|
| Administrador (root) | Cualquier perfil |
| Admin de región | Usuario región, admin/usuario zona, admin/usuario unidad |
| Admin de zona | Usuario zona, admin/usuario unidad |
| Admin de unidad | Solo usuario de unidad |

### Adscripción al guardar

| Perfil | Selectores | Guardado |
|--------|------------|----------|
| Administrador | — | Sin unit / scope |
| Admin / Usuario región | Solo región | Admin: `admin_scope`=región · Usuario: `unit_id`=región |
| Admin / Usuario zona | Región + zona | Admin: `admin_scope`=zona · Usuario: `unit_id`=zona |
| Admin / Usuario unidad | Región + zona + unidad | Admin: ambos = unidad · Usuario: `unit_id`=unidad |

- Región: no se fuerza zona/unidad en el alta.
- No hay «ocultar ubicación».

## 3. Creación de grupos / canales

### Alcance según creador

| Creador | Alcances |
|---------|----------|
| Root / admin región | Región · Zona · Unidad (zona/unidad opcionales) |
| Admin zona | Toda su zona o una unidad de su zona |
| Admin unidad | Solo su unidad |

### Quién agrega a quién

| Quién asigna | Puede agregar |
|--------------|---------------|
| Root / admin región | Casi cualquiera (con filtro geo) |
| Admin zona | Zona y unidad (no región) |
| Admin unidad | Solo admin/usuario de unidad |

**Ejemplo:** admin de unidad **no** puede agregar a un admin de zona.

### Encaje en el canal

- **Región / zona:** adscripción bajo el ancla; perfiles de región pueden entrar si quien asigna lo permite.
- **Unidad:** misma unidad, o **admin de zona** cuya zona contiene esa unidad. **Usuario de zona no** entra solo por ser de la zona.
- El combo «Agregar persona…» **oculta** a quien ya es miembro.
- Hablar en radio exige membresía (el mapa no abre PTT solo).

## 4. Mapa — a quién ves

### Matriz de roles

| Tú eres… | Ves (por rol) |
|----------|----------------|
| Administrador | Todos |
| Admin / usuario región | Región ↓ zona ↓ unidad (su región) |
| Admin zona | Zona ↓ unidad |
| Usuario zona | Solo pares usuario de zona |
| Admin unidad | Admin y usuarios de su unidad |
| Usuario unidad | Solo pares usuario de unidad |

### Territorio GPS

- Usuario de región: árbol de **su** región (no org entera a ciegas).
- Zona: unidades bajo su zona.
- Unidad: su unidad.
- Siempre te ves a ti mismo.

## 5. Validación rápida

1. Alta región → solo selector Región.  
2. Admin unidad + canal unidad → no sale admin zona ajeno ni usuario de zona.  
3. Root en canal unidad → sí puede salir admin de zona padre.  
4. Usuario unidad en mapa → no ve zona/región.  
5. Tras agregar a alguien → desaparece del combo Agregar.

## 6. Código de referencia

- `visibility.js` — matriz mapa  
- `orgUnits.js` → `loadTrackScope` — territorio  
- `groupPolicy.js` + `DispatchGroups.jsx` — canales  
- `DispatchUsers.jsx` → `orgScopeForSave` / `allowedRoleOptions` — alta  

— Fin · Alcance 5 —
