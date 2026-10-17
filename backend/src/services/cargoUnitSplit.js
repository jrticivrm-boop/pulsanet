/**
 * Separa nombres de unidad/zona embebidos en users.cargo (texto libre).
 * Ej.: «Cmte. 29/o. R.C.» → servicio «Cmte.» + unidad «29/o. R.C.»
 * Acepta variaciones humanas: «8/a Z.M.» ≈ «8/a. Z.M.»
 */

/** Normaliza para comparar (quita acentos y puntos de abreviatura). */
export function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/cía/g, 'cia')
    .replace(/\./g, '')
    .replace(/[^\w/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex flexible: puntos opcionales, espacios flexibles (error humano de tipeo). */
function unitTailRegex(unitName) {
  const flex = escapeRegExp(unitName)
    .replace(/\\\./g, '\\.?')
    .replace(/\\\s+/g, '\\s*')
    .replace(/cía/gi, 'c[ií]a');
  return new RegExp(`(?:^|[\\s,·\\-/]+)${flex}\\.?\\s*$`, 'i');
}

/**
 * @param {string} cargoRaw
 * @param {Array<{ id: string, name: string, kind?: string }>} units
 * @returns {{ unitId: string, unitName: string, servicio: string|null }|null}
 */
export function splitCargoUnit(cargoRaw, units) {
  const cargo = String(cargoRaw || '').trim();
  if (!cargo || !Array.isArray(units) || !units.length) return null;

  const cNorm = normKey(cargo);
  const sorted = [...units].sort(
    (a, b) =>
      normKey(b.name).length - normKey(a.name).length ||
      String(a.name).localeCompare(String(b.name), 'es')
  );

  for (const u of sorted) {
    const name = String(u.name || '').trim();
    if (!name) continue;
    const uNorm = normKey(name);
    if (uNorm.length < 4) continue;

    if (cNorm === uNorm) {
      return { unitId: u.id, unitName: name, servicio: null };
    }

    const asSuffix = cNorm.endsWith(uNorm) || cNorm.endsWith(` ${uNorm}`);
    if (!asSuffix && !cNorm.includes(` ${uNorm}`)) continue;
    // Evitar falsos positivos cortos en medio del texto
    if (!cNorm.endsWith(uNorm) && !cNorm.endsWith(` ${uNorm}`)) continue;

    const re = unitTailRegex(name);
    let m = cargo.match(re);
    if (!m) {
      // Reintento: nombre del catálogo con puntos opcionales ya en flex;
      // si el cargo trae menos puntos, probar con el tramo final del cargo.
      const words = cargo.trim().split(/\s+/);
      for (let take = Math.min(words.length, 6); take >= 1; take -= 1) {
        const tail = words.slice(-take).join(' ');
        if (normKey(tail) === uNorm) {
          const servicio = words.slice(0, -take).join(' ').replace(/[,\s·\-/]+$/g, '').trim();
          return {
            unitId: u.id,
            unitName: name,
            servicio: servicio || null,
          };
        }
      }
      continue;
    }

    const servicio = cargo
      .slice(0, m.index)
      .replace(/[,\s·\-/]+$/g, '')
      .trim();
    return {
      unitId: u.id,
      unitName: name,
      servicio: servicio || null,
    };
  }
  return null;
}

/**
 * Indicativo: «Grado Apellido[, Servicio · Unidad]»
 */
export function formatCallSignParts({ grade, paternalSurname, cargo, unitName }) {
  const g = String(grade || '').trim();
  const surname = String(paternalSurname || '').trim();
  const servicio = String(cargo || '').trim();
  const unit = String(unitName || '').trim();
  if (!g || !surname) return '';
  const base = `${g} ${surname}`;
  const tail = [servicio, unit].filter(Boolean).join(' · ');
  return tail ? `${base}, ${tail}` : base;
}
