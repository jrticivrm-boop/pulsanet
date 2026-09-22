/**
 * Usuario de acceso (login) a partir del nombre civil:
 *   Guadalupe Gómez de la Cruz → ggomezd2
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
 * Indicativo: «Sgto. 1/o. Gomez» o «Sgto. 1/o. Gomez, desarrollador».
 * Usa grado + apellido; si hay cargo/puesto, lo agrega tras coma.
 */
export function buildCallSign(p) {
  const grade = String(p.grade || '').trim();
  const surname = formatSurnameCall(p.paternalSurname);
  const cargo = String(p.cargo || '').trim();

  if (!grade) {
    throw new Error('Grado es requerido');
  }
  if (!surname) {
    throw new Error('Apellido paterno es requerido');
  }

  const base = `${grade} ${surname}`;
  return cargo ? `${base}, ${cargo}` : base;
}

/** Misma regla que buildCallSign (sin overrides). */
export function suggestCallSign(p) {
  try {
    return buildCallSign(p);
  } catch {
    return '';
  }
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

  for (let n = 2; n <= 999; n += 1) {
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
      username: `${base}2`.slice(0, 20),
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
