/**
 * Usuario corporativo a partir del nombre (estilo institucional):
 *   Guadalupe Gómez de la Cruz → ggomezd2
 *
 * Regla:
 *   1) inicial del primer nombre
 *   2) apellido paterno completo (minúsculas, sin acentos)
 *   3) inicial del apellido materno (p. ej. "de la Cruz" → d)
 *   4) número secuencial desde 2 (ggomezd2, ggomezd3, …) para unicidad
 */

function toAsciiLower(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')
    .toLowerCase();
}

function lettersOnly(s) {
  return toAsciiLower(s).replace(/[^a-z]/g, '');
}

function firstGivenToken(givenNames) {
  const parts = toAsciiLower(givenNames)
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z]/g, ''))
    .filter(Boolean);
  return parts[0] || '';
}

/**
 * Base sin número: g + gomez + d → ggomezd
 * @param {{ givenNames: string, paternalSurname: string, maternalSurname?: string }} p
 */
export function buildUsernameBase(p) {
  const givenNames = String(p.givenNames || '').trim();
  const paternalSurname = String(p.paternalSurname || '').trim();
  const maternalSurname = String(p.maternalSurname || '').trim();

  if (!givenNames || !paternalSurname) {
    throw new Error('Nombre(s) y apellido paterno son requeridos');
  }

  const given = firstGivenToken(givenNames);
  const paternal = lettersOnly(paternalSurname);
  if (!given || !paternal) {
    throw new Error('Nombre o apellido paterno inválidos');
  }

  const maternalInitial = maternalSurname ? lettersOnly(maternalSurname)[0] || '' : '';
  // Reserva espacio para el número (hasta 3 dígitos) dentro de VARCHAR(20)
  const maxStem = 17;
  let stem = `${given[0]}${paternal}${maternalInitial}`;
  if (stem.length > maxStem) {
    stem = stem.slice(0, maxStem);
  }
  return stem;
}

export function buildDisplayName(p) {
  return [p.givenNames, p.paternalSurname, p.maternalSurname]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * @param {{ givenNames: string, paternalSurname: string, maternalSurname?: string }} p
 * @param {(candidate: string) => Promise<boolean>|boolean} isTaken
 * @returns {Promise<{ username: string, displayName: string, base: string }>}
 */
export async function buildUsername(p, isTaken) {
  const base = buildUsernameBase(p);
  const displayName = buildDisplayName(p);

  for (let n = 2; n <= 999; n += 1) {
    const candidate = `${base}${n}`.slice(0, 20);
    const taken = await isTaken(candidate);
    if (!taken) {
      return { username: candidate, displayName, base };
    }
  }
  throw new Error('No se pudo generar un usuario único');
}

/** @deprecated usar buildUsername — se mantiene el nombre por compatibilidad de imports */
export async function buildRfcUsername(p, isTaken) {
  if (typeof isTaken !== 'function') {
    // Sin checker: solo base+2 (preview local)
    const base = buildUsernameBase(p);
    return {
      username: `${base}2`.slice(0, 20),
      displayName: buildDisplayName(p),
      base,
    };
  }
  return buildUsername(p, isTaken);
}

/** Normaliza lo que el usuario escribe en login (minúsculas). */
export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
