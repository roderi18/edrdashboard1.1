import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const file = await FileBlob.load(
  'outputs/01a06500-permissions-matrix/matriz-completa-acceso-roles.xlsx'
);
const workbook = await SpreadsheetFile.importXlsx(file);

for (const range of [
  'Guía!A4:B8',
  'Niveles org!A40:T45',
  'Ficha miembro!A40:Z45',
  'Directivas!A40:L45',
]) {
  const result = await workbook.inspect({
    kind: 'table',
    range,
    include: 'values,formulas',
    tableMaxRows: 10,
    tableMaxCols: 30,
    maxChars: 16000,
  });
  console.log(result.ndjson);
}

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
  maxChars: 4000,
});
console.log(errors.ndjson);
