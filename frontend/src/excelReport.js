/**
 * Reporte Excel institucional (mismo formato que Parque Vehicular · pv-excel-report.js):
 * título, subtítulo, banda «REPORTE OFICIAL», metadatos, criterios de consulta,
 * tabla con No. consecutivo, bandas alternas, autofiltro, encabezado fijo, pie y hoja Resumen.
 * ExcelJS se carga bajo demanda desde /vendor/exceljs.min.js (no entra al bundle).
 */

const EXCELJS_SRC = `${import.meta.env.BASE_URL || '/'}vendor/exceljs.min.js`;
const REPORT_ORG = 'IV Región Militar · SICOM';
const ROW_HEADER = 'No.';
const FONT = 'Geomanist';
const MIN_COLS = 21;
const COL_CONSECUTIVO_WCH = 6;
const COL_A_RESUMEN_WCH = 21.42578125;

let excelJsPromise = null;

function loadExcelJs() {
  if (typeof window !== 'undefined' && window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!excelJsPromise) {
    excelJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = EXCELJS_SRC;
      s.async = true;
      s.onload = () =>
        window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS no se inicializó.'));
      s.onerror = () => reject(new Error('No se pudo cargar el generador de Excel.'));
      document.head.appendChild(s);
    }).catch((err) => {
      excelJsPromise = null;
      throw err;
    });
  }
  return excelJsPromise;
}

function fmtInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return Math.round(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
}

function fmtSummaryValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return fmtInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return fmtInt(value.trim());
  return value == null ? '' : String(value);
}

function argb(hex) {
  const h = String(hex || '').replace('#', '').toUpperCase();
  if (h.length === 8) return h;
  if (h.length === 6) return `FF${h}`;
  return 'FF303726';
}

function border(thin = true) {
  const color = { argb: thin ? 'FFAAB89A' : 'FF56634A' };
  const style = thin ? 'thin' : 'medium';
  return { top: { style, color }, bottom: { style, color }, left: { style, color }, right: { style, color } };
}

const fill = (rgb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(rgb) } });

function font({ sz = 10, bold = false, italic = false, color = '303726' } = {}) {
  return { name: FONT, size: sz, bold, italic, color: { argb: argb(color) } };
}

function buildStyles() {
  const thin = border(true);
  const med = border(false);
  return {
    title: {
      fill: fill('3A4330'),
      font: font({ sz: 18, bold: true, color: 'FFFFFF' }),
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    },
    subtitle: {
      fill: fill('3A4330'),
      font: font({ sz: 11, color: 'D4DFC8' }),
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    },
    badge: {
      fill: fill('56634A'),
      font: font({ sz: 10, bold: true, color: 'F4F6F0' }),
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    },
    metaLabel: {
      fill: fill('E8EDE2'),
      font: font({ sz: 10, bold: true, color: '3A4330' }),
      alignment: { horizontal: 'right', vertical: 'middle', wrapText: true },
      border: thin,
    },
    metaValue: {
      fill: fill('F8FAF5'),
      font: font({ sz: 10 }),
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border: thin,
    },
    filterTitle: {
      fill: fill('435A35'),
      font: font({ sz: 10, bold: true, color: 'FFFFFF' }),
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
      border: med,
    },
    filterBody: {
      fill: fill('F4F6F0'),
      font: font({ sz: 10, color: '3A4330' }),
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 },
      border: thin,
    },
    summaryTitle: {
      fill: fill('56634A'),
      font: font({ sz: 10, bold: true, color: 'FFFFFF' }),
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
      border: med,
    },
    summaryLabelLeft: {
      fill: fill('E8EDE2'),
      font: font({ sz: 10, bold: true, color: '3A4330' }),
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 },
      border: thin,
    },
    summaryColHeader: {
      fill: fill('435A35'),
      font: font({ sz: 10, bold: true, color: 'FFFFFF' }),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thin,
    },
    summaryTotal: {
      fill: fill('F4F6F0'),
      font: font({ sz: 11, bold: true, color: '3A4330' }),
      alignment: { horizontal: 'center', vertical: 'top' },
      border: thin,
    },
    summaryValue: {
      fill: fill('FFFFFF'),
      font: font({ sz: 10 }),
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 },
      border: thin,
    },
    header: {
      fill: fill('435A35'),
      font: font({ sz: 11, bold: true, color: 'FFFFFF' }),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'medium', color: { argb: 'FF2D3628' } },
        bottom: { style: 'medium', color: { argb: 'FF2D3628' } },
        left: thin.left,
        right: thin.right,
      },
    },
    rowNum: {
      fill: fill('E8EDE2'),
      font: font({ sz: 9, bold: true, color: '56634A' }),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thin,
    },
    dataOdd: { fill: fill('FFFFFF'), font: font({ sz: 10 }), alignment: { vertical: 'middle' }, border: thin },
    dataEven: { fill: fill('EEF2E8'), font: font({ sz: 10 }), alignment: { vertical: 'middle' }, border: thin },
    footer: {
      fill: fill('E8EDE2'),
      font: font({ sz: 9, italic: true, color: '56634A' }),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: med,
    },
  };
}

function setStyle(cell, kind, styles) {
  const s = styles[kind];
  if (!s) return;
  if (s.font) cell.font = { ...s.font };
  if (s.fill) cell.fill = { ...s.fill };
  if (s.alignment) cell.alignment = { ...s.alignment };
  if (s.border) cell.border = { ...s.border };
}

function mergeRow(ws, row, c1, c2, value, kind, styles) {
  if (c2 > c1) ws.mergeCells(row, c1, row, c2);
  const cell = ws.getCell(row, c1);
  if (value != null && value !== '') cell.value = value;
  setStyle(cell, kind, styles);
  for (let c = c1 + 1; c <= c2; c += 1) setStyle(ws.getCell(row, c), kind, styles);
}

function metaRow(ws, row, label, value, colEnd, styles) {
  const labelEnd = Math.min(3, colEnd);
  mergeRow(ws, row, 1, labelEnd, label, 'metaLabel', styles);
  if (colEnd > labelEnd) mergeRow(ws, row, labelEnd + 1, colEnd, value, 'metaValue', styles);
}

const pxToRowHeight = (px) => (px * 72) / 96;

function colLetter(col) {
  let letters = '';
  let c = col;
  while (c > 0) {
    const rem = (c - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    c = Math.floor((c - 1) / 26);
  }
  return letters;
}

function columnWidths(headers, rows) {
  return headers.map((h, i) => {
    if (i === 0) return COL_CONSECUTIVO_WCH;
    const headerLen = String(h).length;
    const maxLen = Math.max(headerLen, ...rows.map((row) => String(row[i] ?? '').length));
    const pad = headerLen >= 12 ? 3 : 2;
    return Math.min(Math.max(maxLen + pad, 10), 48);
  });
}

function applyAutoFilter(ws, headerRow, endRow, colEnd) {
  ws.autoFilter = `A${headerRow}:${colLetter(colEnd)}${endRow}`;
  const edge = { style: 'medium', color: { argb: 'FF56634A' } };
  for (let c = 1; c <= colEnd; c += 1) {
    ws.getCell(headerRow, c).border = { ...ws.getCell(headerRow, c).border, top: edge };
    ws.getCell(endRow, c).border = { ...ws.getCell(endRow, c).border, bottom: edge };
  }
  for (let r = headerRow; r <= endRow; r += 1) {
    ws.getCell(r, 1).border = { ...ws.getCell(r, 1).border, left: edge };
    ws.getCell(r, colEnd).border = { ...ws.getCell(r, colEnd).border, right: edge };
  }
}

function summaryRowHeight(detail, charsPerLine) {
  const t = String(detail || '').trim();
  if (!t) return 18;
  const lines = Math.min(Math.max(Math.ceil(t.length / Math.max(charsPerLine, 48)), 1), 3);
  return Math.round(14 + lines * 14);
}

function reportFilename(title) {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = String(title || 'reporte')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'reporte'}-${stamp}.xlsx`;
}

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Genera y descarga el reporte.
 * @param {{
 *   sheetName: string, title: string, subtitle?: string, module?: string, exportedBy?: string,
 *   filters?: string[], headers: string[], rows: Array<Array<string|number|null>>,
 *   summary?: Array<{ label: string, total?: number|string, detail?: string }>
 * }} opts
 */
export async function exportInstitutionalReport(opts) {
  const {
    sheetName,
    title,
    subtitle = REPORT_ORG,
    module: moduleName = sheetName,
    exportedBy = 'Sistema',
    filters = [],
    headers,
    rows,
    summary = [],
  } = opts;
  const ExcelJS = await loadExcelJs();
  const styles = buildStyles();
  const generatedAt = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

  const wb = new ExcelJS.Workbook();
  wb.creator = exportedBy;
  wb.created = new Date();
  wb.company = REPORT_ORG;

  const allHeaders = [ROW_HEADER, ...headers];
  const colCount = Math.max(4, allHeaders.length);
  const colEnd = Math.max(colCount, MIN_COLS);
  const ws = wb.addWorksheet(String(sheetName).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Reporte');

  let r = 1;
  mergeRow(ws, r, 1, colEnd, title, 'title', styles);
  ws.getRow(r++).height = pxToRowHeight(45);
  mergeRow(ws, r, 1, colEnd, subtitle, 'subtitle', styles);
  ws.getRow(r++).height = pxToRowHeight(25);
  mergeRow(ws, r, 1, colEnd, 'REPORTE OFICIAL · USO INTERNO', 'badge', styles);
  ws.getRow(r++).height = pxToRowHeight(20);
  r += 1;

  [
    ['Generado:', generatedAt],
    ['Exportado por:', exportedBy],
    ['Módulo:', moduleName],
    ['Total de registros exportados:', fmtInt(rows.length)],
    ['Total de columnas exportadas:', fmtInt(headers.length)],
  ].forEach(([label, value]) => {
    metaRow(ws, r, label, value, colEnd, styles);
    r += 1;
  });
  r += 1;

  const filterLines = filters.length ? filters : ['Sin filtros activos (listado completo del módulo).'];
  mergeRow(ws, r++, 1, colEnd, 'CRITERIOS DE CONSULTA', 'filterTitle', styles);
  mergeRow(ws, r, 1, colEnd, filterLines.map((l) => `• ${l}`).join('\n'), 'filterBody', styles);
  ws.getRow(r++).height = Math.min(16 + filterLines.length * 14, 90);
  r += 1;

  const headerRow = r;
  allHeaders.forEach((h, ci) => {
    const cell = ws.getCell(r, ci + 1);
    cell.value = h;
    setStyle(cell, 'header', styles);
  });
  ws.getRow(r++).height = 26;

  rows.forEach((vals, i) => {
    [i + 1, ...vals].forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 1);
      cell.value = val ?? '';
      setStyle(cell, ci === 0 ? 'rowNum' : i % 2 === 0 ? 'dataOdd' : 'dataEven', styles);
    });
    r += 1;
  });
  const dataEndRow = r - 1;

  const widths = columnWidths(allHeaders, rows.map((row) => [0, ...row]));
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = i === 0 ? w : Math.max(w, i === 1 ? 11 : 14);
  });

  if (rows.length) {
    applyAutoFilter(ws, headerRow, dataEndRow, allHeaders.length);
    ws.views = [{ state: 'frozen', ySplit: headerRow, activeCell: `A${headerRow + 1}`, showGridLines: true }];
    r += 1;
  }

  const footerText = `— Fin del reporte · ${fmtInt(rows.length)} registro${rows.length !== 1 ? 's' : ''} · SICOM IV RM —`;
  mergeRow(ws, r, 1, colEnd, footerText, 'footer', styles);
  ws.getRow(r).height = 22;
  const pageSetup = {
    orientation: 'landscape',
    margins: { left: 0.45, right: 0.45, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.2 },
  };
  ws.pageSetup = pageSetup;

  if (summary.length) {
    const rs = wb.addWorksheet('Resumen');
    rs.getColumn(1).width = COL_A_RESUMEN_WCH;
    rs.getColumn(2).width = 11;
    for (let c = 3; c <= colEnd; c += 1) rs.getColumn(c).width = 14;

    let rr = 1;
    mergeRow(rs, rr, 1, colEnd, 'RESUMEN DEL LISTADO EXPORTADO', 'summaryTitle', styles);
    rs.getRow(rr++).height = pxToRowHeight(20);
    rs.getCell(rr, 1).value = 'Concepto';
    setStyle(rs.getCell(rr, 1), 'summaryColHeader', styles);
    rs.getCell(rr, 2).value = 'Total';
    setStyle(rs.getCell(rr, 2), 'summaryColHeader', styles);
    mergeRow(rs, rr, 3, colEnd, 'Detalle', 'summaryColHeader', styles);
    rs.getRow(rr++).height = pxToRowHeight(20);

    const detailCpl = Math.max(Math.round((colEnd - 2) * 14 * 0.95), 48);
    summary.forEach((item) => {
      const detail = item.detail != null ? String(item.detail) : '';
      rs.getCell(rr, 1).value = item.label ?? '';
      setStyle(rs.getCell(rr, 1), 'summaryLabelLeft', styles);
      rs.getCell(rr, 2).value =
        item.total != null && item.total !== '' ? fmtSummaryValue(item.total) : '';
      setStyle(rs.getCell(rr, 2), 'summaryTotal', styles);
      mergeRow(rs, rr, 3, colEnd, detail, 'summaryValue', styles);
      rs.getRow(rr).height = summaryRowHeight(detail, detailCpl);
      rr += 1;
    });
    rr += 1;
    mergeRow(rs, rr, 1, colEnd, footerText, 'footer', styles);
    rs.getRow(rr).height = 22;
    rs.pageSetup = pageSetup;
  }

  downloadBuffer(await wb.xlsx.writeBuffer(), reportFilename(title));
}
