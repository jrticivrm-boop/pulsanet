/**
 * Organigrama IV R.M. — importado del catálogo institucional
 * (Control Tóner / dependencias IV R.M.).
 *
 * ParqueVehicular no está en esta máquina; esta es la fuente operativa.
 *
 * Jerarquía:
 * - Región (administrador maestro): oye y da seguimiento a todos.
 * - C.G. de Región (zona tipo cg): unidades / organismos subordinados directos.
 * - Zonas (Z.M. / apoyo): administran sus unidades; oyen y dan seguimiento.
 * - Unidades: administran servicios desplegados (usuarios); oyen y dan seguimiento.
 */
export const IV_RM_ORG = {
  region: { externalId: 1, name: 'IV R.M.', code: 'IV-RM' },
  zones: [
    {
      externalId: 101,
      name: 'C.G. IV R.M.',
      code: 'CG-IVRM',
      zoneType: 'cg',
      units: [
        { externalId: 1, name: 'C.G. (S-1 E.M.) IV R.M.', code: 'CG-S1-EM-IVRM' },
        { externalId: 2, name: 'C.G. (S-2 E.M.) IV R.M.', code: 'CG-S2-EM-IVRM' },
        { externalId: 3, name: 'C.G. (S-3 E.M.) IV R.M.', code: 'CG-S3-EM-IVRM' },
        { externalId: 4, name: 'C.G. (S-4 E.M.) IV R.M.', code: 'CG-S4-EM-IVRM' },
        { externalId: 5, name: 'Grupo Control Financiero', code: 'GPO-CTRL-FIN' },
        { externalId: 6, name: 'Pgdria. Gral. IV R.M.', code: 'PGDRIA-GRAL-IVRM' },
        { externalId: 69, name: 'Asesoría Jurídica IV R.M.', code: 'ASES-JUR-IVRM' },
        { externalId: 7, name: 'Arch. C.G. IV R.M.', code: 'ARCH-CG-IVRM' },
        { externalId: 8, name: 'Ofna. enlace G.N.', code: 'OFNA-ENL-GN' },
        { externalId: 9, name: 'CE.CO. Rio Bravo IV R.M.', code: 'CECO-RBRAVO-IVRM' },
        { externalId: 70, name: 'Comis. Insp. Regional IV R.M.', code: 'COM-INSP-IVRM' },
        { externalId: 10, name: 'Coordinadora Vols.', code: 'COORD-VOLS-IVRM' },
        { externalId: 11, name: 'Jfa. Rgnl. C/Intl. IV R.M.', code: 'JFR-CINTL-IVRM' },
        { externalId: 12, name: 'GAOI IV R.M.', code: 'GAOI-IVRM' },
        { externalId: 13, name: 'G.A.E. IV R.M.', code: 'GAE-IVRM' },
        { externalId: 14, name: 'Escuadra M.G. IV R.M.', code: 'ESC-MG-IVRM' },
        { externalId: 15, name: 'Sec. TIC. IV R.M. (Trans.)', code: 'SEC-TIC-IVRM-TR' },
        { externalId: 16, name: '4/a. S.R.C.E.', code: '4A-SRCE' },
        { externalId: 17, name: 'Cía. Rgnl. Manto. IV R.M.', code: 'CIA-RGNL-MNT-IVRM' },
        { externalId: 18, name: '4/a. Cia. S.M.N.', code: '4A-CIA-SMN' },
        { externalId: 19, name: 'C.A.R. IV R.M.', code: 'CAR-IVRM' },
        { externalId: 20, name: 'C.A.C.I.R. IV R.M.', code: 'CACIR-IVRM' },
        { externalId: 21, name: 'Cia. Manto. Autz. IV R.M.', code: 'CIA-MNT-AUTZ-IVRM' },
        { externalId: 22, name: 'Banda de música IV R.M.', code: 'BANDA-MUS-IVRM' },
        { externalId: 23, name: 'Jfa. Rgnl. TIC. (Trans.).', code: 'JFR-TIC-TR' },
        { externalId: 24, name: 'Jfa. Rgnl. Svs. Admon. e I.', code: 'JFR-SVS-ADMON' },
        { externalId: 25, name: 'Jfa. Rgnl. Sv. TIC (Inftca.)', code: 'JFR-SV-INF' },
        { externalId: 26, name: 'Jfa. Rgnl. Sv. Snd.', code: 'JFR-SV-SND' },
        { externalId: 27, name: 'Jfa. Rgnl. Sv. Tptes.', code: 'JFR-SV-TPT' },
        { externalId: 28, name: 'Jfa. Rgnl. Sv. Arch.', code: 'JFR-SV-ARCH' },
        { externalId: 29, name: 'O.T.C.A.', code: 'OTCA' },
        { externalId: 30, name: 'Jfa. Rgnl. Sv. M.G.', code: 'JFR-SV-MG' },
        { externalId: 31, name: 'V.F.M. Monterrey', code: 'VFM-MTY' },
        { externalId: 32, name: 'Jfa. Rgnl. Sv. Ings.', code: 'JFR-SV-ING' },
      ],
    },
    {
      externalId: 102,
      name: '7/a. Z.M.',
      code: '7ZM',
      zoneType: 'zm',
      units: [
        { externalId: 33, name: 'C.G. 7/a. Z.M.', code: 'CG-7ZM' },
        { externalId: 34, name: 'Sec. TIC. 7/a. Z.M.', code: 'SEC-TIC-7ZM' },
        { externalId: 35, name: '16/o. B.I.', code: '16BI' },
        { externalId: 36, name: '22/o. B.I. y P.T. 22/o. B.I.', code: '22BI-PT' },
        { externalId: 37, name: '27/o. R.C.', code: '27RC' },
        { externalId: 38, name: 'CEN. D.I. No. 8', code: 'CEN-DI-8' },
      ],
    },
    {
      externalId: 103,
      name: '8/a. Z.M.',
      code: '8ZM',
      zoneType: 'zm',
      units: [
        { externalId: 39, name: 'C.G. 8/a.Z.M.', code: 'CG-8ZM' },
        { externalId: 40, name: 'SEC. TIC. 8/a. Z.M.', code: 'SEC-TIC-8ZM' },
        { externalId: 41, name: 'Gn. Mil. Matamoros', code: 'GN-MIL-MAT' },
        { externalId: 42, name: 'Gn. Mil. Nvo. Laredo', code: 'GN-MIL-NL' },
        { externalId: 43, name: '8/o. R.C. (S.P.A.A. y Trans).', code: '8RC-SPAAT' },
        { externalId: 44, name: '25/o. R.C.', code: '25RC' },
        { externalId: 45, name: '29/o. R.C.', code: '29RC' },
        { externalId: 46, name: '16/o. R.C. y U.E.P.', code: '16RC-UEP' },
        { externalId: 47, name: '19/o. R.C.', code: '19RC' },
      ],
    },
    {
      externalId: 104,
      name: '48/a. Z.M.',
      code: '48ZM',
      zoneType: 'zm',
      units: [
        { externalId: 48, name: 'C.G. 48/a. Z.M.', code: 'CG-48ZM' },
        { externalId: 49, name: 'Sec. TIC Ap. 48/a. Z.M.', code: 'SEC-TIC-48ZM' },
        { externalId: 50, name: '77/o. B.I.', code: '77BI' },
        { externalId: 51, name: '15/o. Btn. Inf. y Trans.', code: '15BI-TR' },
      ],
    },
    {
      externalId: 105,
      name: '12/a. Z.M.',
      code: '12ZM',
      zoneType: 'zm',
      units: [
        { externalId: 52, name: 'C.G. 12/a. Z.M.', code: 'CG-12ZM' },
        { externalId: 53, name: 'Sec. TIC. C.G. 12/a. Z.M.', code: 'SEC-TIC-CG12ZM' },
        { externalId: 54, name: '36/o. Btn. Inf. y Ptn. Trans.', code: '36BI-PT' },
        { externalId: 55, name: '40/o. Btn. Inf.', code: '40BI' },
        { externalId: 56, name: 'U.E.P. No. 26', code: 'UEP-26' },
      ],
    },
    {
      externalId: 106,
      name: 'Sv. Sanidad',
      code: 'SANIDAD',
      zoneType: 'support',
      units: [
        { externalId: 57, name: 'H.M.R.E. Mty. N.L.', code: 'HMRE-MTY' },
        { externalId: 58, name: 'H.M.R. Tampico, Tamps.', code: 'HMR-TAMP' },
        { externalId: 59, name: 'H.M.R. San Luis Potosí.', code: 'HMR-SLP' },
        { externalId: 60, name: 'U.M.C.E. Reynosa', code: 'UMCE-REY' },
        { externalId: 61, name: 'C.R.I. Apodaca, N.L.', code: 'CRI-APOD' },
      ],
    },
    {
      externalId: 107,
      name: 'Unidades aéreas',
      code: 'AEREAS',
      zoneType: 'support',
      units: [
        { externalId: 62, name: '7/a. Z.A.M.', code: '7ZAM' },
        { externalId: 63, name: 'Edn. Ar. No. 108', code: 'EDN-AR-108' },
        { externalId: 64, name: 'E. M. M. No. 3, Matamoros, Tamps.', code: 'EMM-3-MAT' },
        { externalId: 65, name: '8/a. Z.A.M. Tampico, Tamps.', code: '8ZAM-TAMP' },
      ],
    },
    {
      externalId: 108,
      name: 'Justicia Militar',
      code: 'JUSTICIA',
      zoneType: 'support',
      units: [
        { externalId: 66, name: 'A.M.P.M. Adsc. C.J.M. No. 8.', code: 'AMPM-CJM-8' },
        { externalId: 67, name: 'A.M.P.M. Adsc. C.J.M. No. 9.', code: 'AMPM-CJM-9' },
        { externalId: 68, name: 'A.M.P.M. Judicializador, Apodaca', code: 'AMPM-JUD-APOD' },
      ],
    },
  ],
};
