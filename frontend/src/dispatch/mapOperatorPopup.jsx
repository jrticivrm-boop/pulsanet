/**
 * Globo de operador en mapa:
 * L1 Grado Apellido, unidad|zona|región (root: «…, Administrador» o solo «Administrador» sin grado)
 * L2 catálogo · nombre libre (omite si ambos vacíos)
 * L3 teléfono (omite si vacío)
 * luego fecha, coords, acciones — sin texto de presencia.
 */

export function affiliationLabelFromLoc(loc) {
  const fromOrg =
    String(loc?.unitName || '').trim() ||
    String(loc?.zoneName || '').trim() ||
    String(loc?.regionName || '').trim() ||
    String(loc?.affiliationLabel || '').trim();
  if (fromOrg) return fromOrg;
  const role = String(loc?.role || '').trim().toLowerCase();
  return role === 'root' ? 'Administrador' : '';
}

export function mapPopupTitleLine(loc) {
  const fromDisplay = String(loc?.displayName || '').trim();
  const aff = affiliationLabelFromLoc(loc);
  const role = String(loc?.role || '').trim().toLowerCase();
  if (role === 'root') {
    if (!String(loc?.grade || '').trim()) return 'Administrador';
    const base = (fromDisplay.split(',')[0] || fromDisplay).trim();
    return base ? `${base}, ${aff}` : aff;
  }
  // display_name ya debería ser «Grado Apellido[, pertenencia]».
  if (fromDisplay.includes(',')) return fromDisplay;
  if (fromDisplay && aff) return `${fromDisplay}, ${aff}`;
  return fromDisplay || aff || 'Operador';
}

export function mapPopupServiceLine(loc) {
  const catalog = String(loc?.cargo || '').trim();
  const nombre = String(loc?.serviceNombre || '').trim();
  return [catalog, nombre].filter(Boolean).join(' · ');
}

export function mapPopupPhoneLine(loc) {
  return String(loc?.phone || '').trim();
}

/** Texto indexable para búsqueda de operadores en mapa. */
export function mapOperatorSearchBlob(loc) {
  return [
    loc?.displayName,
    loc?.grade,
    loc?.cargo,
    loc?.serviceNombre,
    loc?.phone,
    loc?.unitName,
    loc?.zoneName,
    loc?.regionName,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function OperatorMapPopupBody({ loc, recordedLabel, children }) {
  const title = mapPopupTitleLine(loc);
  const service = mapPopupServiceLine(loc);
  const phone = mapPopupPhoneLine(loc);
  return (
    <>
      <strong>{title}</strong>
      {service ? (
        <>
          <br />
          {service}
        </>
      ) : null}
      {phone ? (
        <>
          <br />
          {phone}
        </>
      ) : null}
      {recordedLabel ? (
        <>
          <br />
          <small>{recordedLabel}</small>
        </>
      ) : null}
      {children}
    </>
  );
}
