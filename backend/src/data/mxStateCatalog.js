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
