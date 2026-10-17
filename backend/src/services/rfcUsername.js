/**
 * Usuario de acceso (login) a partir del nombre civil:
 *   Guadalupe Gómez de la Cruz → ggomezd + número de 2 dígitos propio del nombre (p. ej. ggomezd47)
 *
 * Indicativo (display_name) en chat / PTT:
 *   Sgto. 1/o. Gomez, desarrollador
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

/** Apellido paterno en título (Gomez). */
export function formatSurnameCall(paternalSurname) {
  const raw = String(paternalSurname || '').trim().split(/\s+/)[0] || '';
  if (!raw) return '';
  return raw.charAt(0).toLocaleUpperCase('es') + raw.slice(1).toLocaleLowerCase('es');
}

/** @deprecated alias */
export function formatPaternalShort(paternalSurname) {
  return formatSurnameCall(paternalSurname);
}

/**
 * Pertenencia del indicativo: unidad | zona | región.
 * Solo root sin adscripción usa «Administrador» (no rellena huecos de otros roles).
 */
export function callSignAffiliation(p) {
  const aff = String(p?.affiliationLabel || p?.unitName || '').trim();
  if (aff) return aff;
  const role = String(p?.role || '').trim().toLowerCase();
  return role === 'root' ? 'Administrador' : '';
}

/**
 * Indicativo corto (listas/chat/mapa L1): «Sgto. 1/o. Gomez» | «…, 25/o. R.C.».
 * Pertenencia = adscripción. Catálogo y nombre libre van aparte (mapa L2).
 */
export function buildCallSign(p) {
  const grade = String(p.grade || '').trim();
  const surname = formatSurnameCall(p.paternalSurname);
  const affiliation = callSignAffiliation(p);

  if (!grade) {
    throw new Error('Grado es requerido');
  }
  if (!surname) {
    throw new Error('Apellido paterno es requerido');
  }

  const base = `${grade} ${surname}`;
  return affiliation ? `${base}, ${affiliation}` : base;
}

/** Misma regla que buildCallSign (sin overrides). */
export function suggestCallSign(p) {
  try {
    return buildCallSign(p);
  } catch {
    return '';
  }
}

function nameSeed(s) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Sufijos 10–99 y luego 100–999, en un orden propio de cada nombre:
 * la vista previa y el alta dan el mismo usuario, pero no todos terminan en «2».
 */
function* usernameSuffixes(seed) {
  for (let i = 0; i < 90; i += 1) yield 10 + ((seed + i * 37) % 90);
  for (let i = 0; i < 900; i += 1) yield 100 + ((seed + i * 7) % 900);
}

/**
 * @param {{ givenNames: string, paternalSurname: string, maternalSurname?: string, grade?: string, cargo?: string, specialty?: string }} p
 * @param {(candidate: string) => Promise<boolean>|boolean} isTaken
 */
export async function buildUsername(p, isTaken) {
  const base = buildUsernameBase(p);
  const fullName = buildDisplayName(p);
  const callSign = p.grade ? buildCallSign(p) : fullName;
  const displayName = callSign;
  const callSignShort = callSign;
  const seed = nameSeed(`${base}|${toAsciiLower(fullName)}`);

  for (const n of usernameSuffixes(seed)) {
    const candidate = `${base}${n}`.slice(0, 20);
    const taken = await isTaken(candidate);
    if (!taken) {
      return {
        username: candidate,
        displayName,
        fullName,
        callSign,
        callSignShort,
        base,
      };
    }
  }
  throw new Error('No se pudo generar un usuario único');
}

/** @deprecated usar buildUsername */
export async function buildRfcUsername(p, isTaken) {
  if (typeof isTaken !== 'function') {
    const base = buildUsernameBase(p);
    const fullName = buildDisplayName(p);
    const callSign = p.grade ? buildCallSign(p) : fullName;
    return {
      username: `${base}${usernameSuffixes(nameSeed(`${base}|${toAsciiLower(fullName)}`)).next().value}`.slice(0, 20),
      displayName: callSign,
      fullName,
      callSign,
      callSignShort: callSign,
      base,
    };
  }
  return buildUsername(p, isTaken);
}

export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
