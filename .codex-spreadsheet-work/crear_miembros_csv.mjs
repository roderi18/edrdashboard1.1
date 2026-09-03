import fs from 'node:fs/promises';
import { Workbook } from '@oai/artifact-tool';

const outputDir = new URL('../outputs/01a02650-65c7-7e12-96f4-960078a21b04/', import.meta.url);

const rows = [
  ['Nombre', 'Teléfono', 'Correo', 'Destacamento', 'Sección', 'Región', 'Size T-Shirt', 'Sexo'],
  ['Roderi Daniel Peña Rosario', '+18297878833', 'rdpr18@gmail.com', 'Tribu de Judá', 'Este Oriental I', 'Región Central', '', ''],
  ['Margarita Guillén', '+18090000000', '', 'Tribu de Judá', 'Este Oriental I', 'Región Central', '', ''],
  ['Arsenio Leyba', '+18094598777', '', 'Tribu de Judá', 'Este Oriental I', 'Región Central', '', ''],
  ['Juan Ramón Corporán', '+18090000000', '', '', 'Sección desconocida', '', '', ''],
  ['Juan Alberto Ramírez', '+18099093280', '', 'Tribu de Judá', 'Este Oriental I', 'Región Central', '', ''],
  ['Rafael Quezada de León', '+18292482712', '', 'Tribu de Judá', 'Este Oriental I', 'Región Central', '', ''],
  ['Franciso José Mañán', '+18094371064', 'frabert10@hotmail.com', 'Tribu de Judá', 'Este Oriental I', 'Región Central', '', ''],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Miembros');
sheet.getRange('A1:H8').values = rows;
sheet.getRange('A1:H1').format = {
  fill: '#1F4E78',
  font: { bold: true, color: '#FFFFFF' },
};
sheet.getRange('A1:H8').format.rowHeight = 22;
sheet.getRange('A1:A8').format.columnWidth = 30;
sheet.getRange('B1:B8').format.columnWidth = 17;
sheet.getRange('C1:C8').format.columnWidth = 27;
sheet.getRange('D1:D8').format.columnWidth = 20;
sheet.getRange('E1:E8').format.columnWidth = 24;
sheet.getRange('F1:F8').format.columnWidth = 20;
sheet.getRange('G1:G8').format.columnWidth = 16;
sheet.getRange('H1:H8').format.columnWidth = 12;

const inspection = await workbook.inspect({
  kind: 'table',
  range: 'Miembros!A1:H8',
  include: 'values,formulas',
  tableMaxRows: 10,
  tableMaxCols: 8,
});

const preview = await workbook.render({
  sheetName: 'Miembros',
  range: 'A1:H8',
  scale: 1.5,
  format: 'png',
});
await fs.writeFile(
  new URL('miembros-preview.png', import.meta.url),
  new Uint8Array(await preview.arrayBuffer())
);

const escapePipeValue = (value) => {
  const text = String(value ?? '');
  if (!/[|"\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
};

const csv = `\uFEFF${rows.map((row) => row.map(escapePipeValue).join('|')).join('\r\n')}\r\n`;
await fs.mkdir(outputDir, { recursive: true });
const outputPath = new URL('miembros-por-pipes.csv', outputDir);
await fs.writeFile(outputPath, csv, 'utf8');

console.log(inspection.ndjson);
console.log(`OUTPUT=${decodeURIComponent(outputPath.pathname).replace(/^\/(.:)/, '$1')}`);
