import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

import { DIRECTIVA_POSITIONS } from '../src/catalogs/directiva-positions.js';
import { MEMBER_GENDERS, MEMBER_SHIRT_SIZES } from '../src/catalogs/member-catalogs.js';

const outputDir = new URL('../outputs/01a02650-65c7-7e12-96f4-960078a21b04/', import.meta.url);
const outputPath = new URL('plantilla-creacion-miembros.xlsx', outputDir);

const response = await fetch(
  'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos',
  { headers: { Accept: 'application/json' } }
);

if (!response.ok) {
  throw new Error(`No se pudo cargar el catálogo de destacamentos (${response.status}).`);
}

const payload = await response.json();
const apiDests = Array.isArray(payload) ? payload : payload?.data ?? payload?.Data ?? [];

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

const destacamentos = uniqueSorted(
  apiDests.map((dest) =>
    [dest?.nombre ?? dest?.name ?? '', dest?.numero ?? dest?.destNumber ?? '']
      .filter(Boolean)
      .join(' ')
      .trim()
  )
);

if (!destacamentos.length) {
  throw new Error('El catálogo activo de destacamentos llegó vacío.');
}

const labelPosition = (position) =>
  position.nombreDivision
    ? `${position.nombreCargo} (${position.nombreDivision})`
    : position.nombreCargo;

const selectablePositions = (nivel) =>
  uniqueSorted(
    DIRECTIVA_POSITIONS.filter(
      (position) =>
        position.nivel === nivel && position.asignable === true && position.activo !== false
    ).map(labelPosition)
  );

const posicionesDestacamento = selectablePositions('destacamento');
const posicionesNacionales = selectablePositions('nacional');
const tallas = MEMBER_SHIRT_SIZES.map((item) => item.value);
const sexos = MEMBER_GENDERS.map((item) => item.value);

const workbook = Workbook.create();
const members = workbook.worksheets.add('Miembros');
const catalogs = workbook.worksheets.add('Catálogos');

const headers = [
  'Nombre',
  'Fecha_Nacimiento',
  'Teléfono',
  'Correo',
  'Destacamento',
  'Posición_Destacamento',
  'Posición_Nacional',
  'Size_T-Shirt',
  'Sexo',
];

const example = [
  'Roderi Daniel Peña Rosario',
  null,
  '18297878833',
  'rdpr18@gmail.com',
  'Tribu de Judá 18',
  'Coordinador Asistente de Destacamento',
  '',
  'M',
  'M',
];

members.getRange('A1:I2').values = [headers, example];
const memberTable = members.tables.add('A1:I2', true, 'MiembrosImportacion');
memberTable.style = 'TableStyleMedium2';
memberTable.showBandedRows = true;
memberTable.showFilterButton = true;

members.freezePanes.freezeRows(1);
members.showGridLines = false;
members.getRange('A1:I1').format = {
  fill: '#1F4E78',
  font: { bold: true, color: '#FFFFFF' },
  verticalAlignment: 'center',
  wrapText: true,
  rowHeight: 34,
};
members.getRange('A2:I2').format.rowHeight = 24;
members.getRange('A1:A2').format.columnWidth = 31;
members.getRange('B1:B501').format.columnWidth = 19;
members.getRange('C1:C501').format.columnWidth = 17;
members.getRange('D1:D2').format.columnWidth = 27;
members.getRange('E1:E501').format.columnWidth = 26;
members.getRange('F1:F501').format.columnWidth = 42;
members.getRange('G1:G501').format.columnWidth = 39;
members.getRange('H1:H501').format.columnWidth = 17;
members.getRange('I1:I501').format.columnWidth = 11;
members.getRange('B2:B501').format.numberFormat = 'dd/mm/yyyy';
members.getRange('C2:C501').format.numberFormat = '@';
members.getRange('D2:D501').format.numberFormat = '@';

const maxCatalogRows = Math.max(
  destacamentos.length,
  posicionesDestacamento.length,
  posicionesNacionales.length,
  tallas.length,
  sexos.length
);
const catalogHeaders = [
  'Destacamento',
  'Posición_Destacamento',
  'Posición_Nacional',
  'Size_T-Shirt',
  'Sexo',
];
const catalogRows = Array.from({ length: maxCatalogRows }, (_, index) => [
  destacamentos[index] ?? '',
  posicionesDestacamento[index] ?? '',
  posicionesNacionales[index] ?? '',
  tallas[index] ?? '',
  sexos[index] ?? '',
]);

catalogs.getRange(`A1:E${maxCatalogRows + 1}`).values = [catalogHeaders, ...catalogRows];
catalogs.freezePanes.freezeRows(1);
catalogs.showGridLines = false;
catalogs.getRange('A1:E1').format = {
  fill: '#548235',
  font: { bold: true, color: '#FFFFFF' },
  verticalAlignment: 'center',
  wrapText: true,
  rowHeight: 34,
};
catalogs.getRange(`A2:E${maxCatalogRows + 1}`).format.rowHeight = 22;
catalogs.getRange(`A1:A${maxCatalogRows + 1}`).format.columnWidth = 27;
catalogs.getRange(`B1:B${maxCatalogRows + 1}`).format.columnWidth = 43;
catalogs.getRange(`C1:C${maxCatalogRows + 1}`).format.columnWidth = 43;
catalogs.getRange(`D1:D${maxCatalogRows + 1}`).format.columnWidth = 17;
catalogs.getRange(`E1:E${maxCatalogRows + 1}`).format.columnWidth = 12;
catalogs.getRange(`A1:E${maxCatalogRows + 1}`).format.borders = {
  preset: 'insideHorizontal',
  style: 'thin',
  color: '#D9EAD3',
};

const listFormula = (column, count) => `'Catálogos'!$${column}$2:$${column}$${count + 1}`;
const validationFor = (formula1, fieldName) => ({
  allowBlank: true,
  rule: { type: 'list', formula1 },
  errorAlert: {
    style: 'stop',
    title: 'Valor no permitido',
    message: `Selecciona un valor existente para ${fieldName}.`,
  },
});
members.getRange('E2:E501').dataValidation = validationFor(
  listFormula('A', destacamentos.length),
  'Destacamento'
);
members.getRange('F2:F501').dataValidation = validationFor(
  listFormula('B', posicionesDestacamento.length),
  'Posición_Destacamento'
);
members.getRange('G2:G501').dataValidation = validationFor(
  listFormula('C', posicionesNacionales.length),
  'Posición_Nacional'
);
members.getRange('H2:H501').dataValidation = validationFor(
  listFormula('D', tallas.length),
  'Size_T-Shirt'
);
members.getRange('I2:I501').dataValidation = validationFor(
  listFormula('E', sexos.length),
  'Sexo'
);

const memberInspection = await workbook.inspect({
  kind: 'table',
  range: 'Miembros!A1:I5',
  include: 'values,formulas',
  tableMaxRows: 5,
  tableMaxCols: 9,
});
const catalogInspection = await workbook.inspect({
  kind: 'table',
  range: `Catálogos!A1:E${maxCatalogRows + 1}`,
  include: 'values,formulas',
  tableMaxRows: 20,
  tableMaxCols: 5,
});
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'final formula error scan',
});

const membersPreview = await workbook.render({
  sheetName: 'Miembros',
  range: 'A1:I6',
  scale: 1.25,
  format: 'png',
});
const catalogsPreview = await workbook.render({
  sheetName: 'Catálogos',
  range: `A1:E${maxCatalogRows + 1}`,
  scale: 1.25,
  format: 'png',
});
await fs.writeFile(
  new URL('plantilla-miembros-preview.png', import.meta.url),
  new Uint8Array(await membersPreview.arrayBuffer())
);
await fs.writeFile(
  new URL('catalogos-miembros-preview.png', import.meta.url),
  new Uint8Array(await catalogsPreview.arrayBuffer())
);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(fileURLToPath(outputPath));

console.log(memberInspection.ndjson);
console.log(catalogInspection.ndjson);
console.log(errors.ndjson);
console.log(
  JSON.stringify({
    destacamentos: destacamentos.length,
    posicionesDestacamento: posicionesDestacamento.length,
    posicionesNacionales: posicionesNacionales.length,
    tallas: tallas.length,
    sexos: sexos.length,
  })
);
console.log(`OUTPUT=${decodeURIComponent(outputPath.pathname).replace(/^\/([A-Za-z]:)/, '$1')}`);
