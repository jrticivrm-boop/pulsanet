/**
 * Usuario de acceso (login) a partir del nombre civil:
 *   Guadalupe Gómez de la Cruz → ggomezd2
 *
 * Indicativo al aire (display_name) — lo que se ve en chat / PTT:
 *   SGTO GOMEZ
 *   B.O. LINARES
 *   S.O. IV R.M. (SALA DE OPERACIONES IV R.M.)
 *
 * Regla login:
 *   1) inicial del primer nombre
 *   2) apellido paterno completo (minúsculas, sin acentos)
 *   3) inicial del apellido materno
 *   4) número secuencial desde 2
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

/** Apellido / texto de indicativo en mayúsculas (conserva ñ). */
export function formatSurnameCall(paternalSurname) {
  const raw = String(paternalSurname || '').trim();
  if (!raw) return '';
  return raw.toLocaleUpperCase('es');
}

/** @deprecated alias — mayúscula inicial; preferir formatSurnameCall */
export function formatPaternalShort(paternalSurname) {
  const raw = String(paternalSurname || '').trim().split(/\s+/)[0] || '';
  if (!raw) return '';
  return raw.charAt(0).toLocaleUpperCase('es') + raw.slice(1).toLocaleLowerCase('es');
}

function stripOuterParens(s) {
  return String(s || '')
    .trim()
    .replace(/^\(+/, '')
    .replace(/\)+$/, '')
    .trim();
}

/**
 * Indicativo al aire / al publicar.
 * - Automático: Grado + apellido (MAYÚSCULAS) → «SGTO GOMEZ»
 * - Override: callSign libre → «S.O. IV R.M.» o «B.O. LINARES»
 * - Detalle: callSignDetail → «S.O. IV R.M. (SALA DE OPERACIONES IV R.M.)»
 * - Cargo corto sin detalle: «CAP. LUNA, JFE. RGNL. TIC»
 */
export function buildCallSign(p) {
  const grade = String(p.grade || '').trim();
  const override = String(p.callSign || '').trim();
  const detail = stripOuterParens(p.callSignDetail || '');
  const cargo = String(p.cargo || p.specialty || '').trim();

  let base = override;
  if (!base) {
    const surname = formatSurnameCall(p.paternalSurname);
    if (!grade) {
      throw new Error('Grado es requerido');
    }
    if (!surname) {
      throw new Error('Apellido paterno es requerido');
    }
    base = `${grade} ${surname}`;
  }

  if (detail) {
    return `${base} (${detail})`;
  }

  if (cargo && !override) {
    // Expansiones institucionales → paréntesis; cargo corto → coma
    if (/sala|r\.?\s*m\.?|operaci|dependenc|batall[oó]n|base\b/i.test(cargo) || cargo.length > 24) {
      return `${base} (${cargo.toLocaleUpperCase('es')})`;
    }
    return `${base}, ${cargo}`;
  }

  return base;
}

/**
 * Sugerencia corta de indicativo (sin paréntesis), para el campo editable.
 */
export function suggestCallSign(p) {
  const override = String(p.callSign || '').trim();
  if (override) return override;
  const grade = String(p.grade || '').trim();
  const surname = formatSurnameCall(p.paternalSurname);
  if (!grade || !surname) return '';
  return `${grade} ${surname}`;
}

/**
 * @param {{ givenNames: string, paternalSurname: string, maternalSurname?: string, grade?: string, cargo?: string, specialty?: string, callSign?: string, callSignDetail?: string }} p
 * @param {(candidate: string) => Promise<boolean>|boolean} isTaken
 * @returns {Promise<{ username: string, displayName: string, fullName: string, callSign: string, callSignShort: string, base: string }>}
 */
export async function buildUsername(p, isTaken) {
  const base = buildUsernameBase(p);
  const fullName = buildDisplayName(p);
  const callSignShort = suggestCallSign(p);
  const callSign = p.grade || p.callSign
    ? buildCallSign(p)
    : fullName;
  const displayName = callSign;

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

/** @deprecated usar buildUsername — se mantiene el nombre por compatibilidad de imports */
export async function buildRfcUsername(p, isTaken) {
  if (typeof isTaken !== 'function') {
    const base = buildUsernameBase(p);
    const fullName = buildDisplayName(p);
    const callSign = p.grade || p.callSign ? buildCallSign(p) : fullName;
    return {
      username: `${base}2`.slice(0, 20),
      displayName: callSign,
      fullName,
      callSign,
      callSignShort: suggestCallSign(p),
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
