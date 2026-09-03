/**
 * Grados del Ejército Mexicano (Art. 129 LOEFAM), orden jerárquico decreciente.
 * `value` = abreviatura al aire (indicativo), ej. Cap. 1/o. Gomez
 */
export const EJERCITO_MEXICANO_GRADE_GROUPS = [
  {
    label: 'Generales',
    options: [
      { value: 'Gral. Div.', label: 'General de División' },
      { value: 'Gral. Bgda.', label: 'General de Brigada' },
      { value: 'Gral. Brig.', label: 'General Brigadier' },
    ],
  },
  {
    label: 'Jefes',
    options: [
      { value: 'Cor.', label: 'Coronel' },
      { value: 'Tte. Cor.', label: 'Teniente Coronel' },
      { value: 'Myr.', label: 'Mayor' },
    ],
  },
  {
    label: 'Oficiales',
    options: [
      { value: 'Cap. 1/o.', label: 'Capitán Primero' },
      { value: 'Cap. 2/o.', label: 'Capitán Segundo' },
      { value: 'Tte.', label: 'Teniente' },
      { value: 'Sbtte.', label: 'Subteniente' },
    ],
  },
  {
    label: 'Tropa',
    options: [
      { value: 'SGTO', label: 'Sargento (indicativo SGTO)' },
      { value: 'Sgto. 1/o.', label: 'Sargento Primero' },
      { value: 'Sgto. 2/o.', label: 'Sargento Segundo' },
      { value: 'Cabo', label: 'Cabo' },
      { value: 'Sld.', label: 'Soldado' },
    ],
  },
  {
    label: 'Puestos / salas',
    options: [
      { value: 'B.O.', label: 'Base / Batallón de Operaciones' },
      { value: 'S.O.', label: 'Sala de Operaciones' },
      { value: 'C.G.', label: 'Cuartel General' },
    ],
  },
];

export const EJERCITO_MEXICANO_GRADES = EJERCITO_MEXICANO_GRADE_GROUPS.flatMap(
  (g) => g.options
);
