/** Mismos id y nombre que el catálogo de Configuración → Estados. */
export const MX_STATES = [
  { id: 'AGS', name: 'Aguascalientes' },
  { id: 'BC', name: 'Baja California' },
  { id: 'BCS', name: 'Baja California Sur' },
  { id: 'CAM', name: 'Campeche' },
  { id: 'CHIS', name: 'Chiapas' },
  { id: 'CHIH', name: 'Chihuahua' },
  { id: 'CDMX', name: 'Ciudad de México' },
  { id: 'COAH', name: 'Coahuila de Zaragoza' },
  { id: 'COL', name: 'Colima' },
  { id: 'DGO', name: 'Durango' },
  { id: 'MEX', name: 'Estado de México' },
  { id: 'GTO', name: 'Guanajuato' },
  { id: 'GRO', name: 'Guerrero' },
  { id: 'HGO', name: 'Hidalgo' },
  { id: 'JAL', name: 'Jalisco' },
  { id: 'MICH', name: 'Michoacán de Ocampo' },
  { id: 'MOR', name: 'Morelos' },
  { id: 'NAY', name: 'Nayarit' },
  { id: 'NL', name: 'Nuevo León' },
  { id: 'OAX', name: 'Oaxaca' },
  { id: 'PUE', name: 'Puebla' },
  { id: 'QRO', name: 'Querétaro' },
  { id: 'QROO', name: 'Quintana Roo' },
  { id: 'SLP', name: 'San Luis Potosí' },
  { id: 'SIN', name: 'Sinaloa' },
  { id: 'SON', name: 'Sonora' },
  { id: 'TAB', name: 'Tabasco' },
  { id: 'TM', name: 'Tamaulipas' },
  { id: 'TLAX', name: 'Tlaxcala' },
  { id: 'VER', name: 'Veracruz de Ignacio de la Llave' },
  { id: 'YUC', name: 'Yucatán' },
  { id: 'ZAC', name: 'Zacatecas' },
];

export const MX_STATE_BY_ID = new Map(MX_STATES.map((s) => [s.id, s]));

export const IV_RM_STATE_IDS = ['NL', 'TM', 'SLP'];

/** Regiones militares y sus estados. Las que ya existen no se recrean. */
export const MX_MILITARY_REGIONS = [
  { name: 'I R.M.', code: 'PV-R-62', externalId: 62, sortOrder: 20, states: ['CDMX', 'MEX', 'HGO', 'MOR'] },
  { name: 'II R.M.', code: 'PV-R-68', externalId: 68, sortOrder: 70, states: ['BC', 'BCS', 'SON'] },
  { name: 'III R.M.', code: 'PV-R-66', externalId: 66, sortOrder: 50, states: ['SIN', 'DGO'] },
  { name: 'IV R.M.', code: 'PV-R-1', externalId: 1, sortOrder: 10, states: ['NL', 'SLP', 'TM'] },
  { name: 'V R.M.', code: 'PV-R-67', externalId: 67, sortOrder: 60, states: ['AGS', 'COL', 'JAL', 'NAY', 'ZAC'] },
  { name: 'VI R.M.', code: 'PV-R-64', externalId: 64, sortOrder: 30, states: ['PUE', 'TLAX', 'VER'] },
  { name: 'VII R.M.', code: 'PV-R-69', externalId: 69, sortOrder: 80, states: ['CHIS', 'TAB'] },
  { name: 'VIII R.M.', code: 'PV-R-70', externalId: 70, sortOrder: 90, states: ['OAX'] },
  { name: 'IX R.M.', code: 'PV-R-71', externalId: 71, sortOrder: 100, states: ['GRO'] },
  { name: 'X R.M.', code: 'PV-R-65', externalId: 65, sortOrder: 40, states: ['CAM', 'QROO', 'YUC'] },
  { name: 'XI R.M.', code: 'PV-R-72', externalId: 72, sortOrder: 110, states: ['CHIH', 'COAH'] },
  { name: 'XII R.M.', code: 'PV-R-73', externalId: 73, sortOrder: 120, states: ['GTO', 'MICH', 'QRO'] },
];
