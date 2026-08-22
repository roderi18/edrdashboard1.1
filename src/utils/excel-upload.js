import * as XLSX from 'xlsx';

import { esArchivoCsv, parsearCsvPipe } from './csv-pipe.js';

export const readExcelRows = async (file) => {
  // El CSV va separado por barras y lo lee su propio parser: XLSX lo abriria
  // asumiendo comas y dejaria toda la fila metida en una sola columna.
  if (esArchivoCsv(file)) {
    return parsearCsvPipe(await file.text());
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  // La plantilla abre primero en "Instrucciones" para orientar al usuario, pero
  // los datos que se deben importar viven en "Miembros". Los archivos externos
  // que no tengan esa hoja conservan el comportamiento anterior: se usa la primera.
  const memberSheetName = workbook.SheetNames.find(
    (sheetName) => String(sheetName).trim().toLowerCase() === 'miembros'
  );
  const sheet = workbook.Sheets[memberSheetName || workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

export const getCell = (row, keys) => {
  const foundKey = keys.find(
    (key) => row[key] !== undefined && row[key] !== null && row[key] !== ''
  );

  return foundKey ? row[foundKey] : '';
};

export const normalizeTextValue = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const formatExcelDate = (value) => {
  if (!value) return '';

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const textValue = String(value).trim();

  return textValue.includes('T') ? textValue.split('T')[0] : textValue;
};

const getUploadErrorReason = (error) => {
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  if (typeof error === 'string' && error.trim()) return error;

  try {
    const serializedError = JSON.stringify(error);

    if (serializedError && serializedError !== '{}') {
      return serializedError;
    }
  } catch {
    // Continue to the generic fallback below.
  }

  return 'El servidor no devolvio un detalle del error.';
};

export const buildUploadLogContent = (failures) =>
  failures.length
    ? failures
        .map((failure) =>
          [
            `Fila ${failure.rowNumber} - No insertada`,
            `Razón: ${failure.reason}`,
            `Datos: ${JSON.stringify(failure.row)}`,
          ].join('\n')
        )
        .join('\n\n')
    : 'No hubo filas fallidas.';

export const downloadUploadLog = ({ fileName, failures }) => {
  const content = buildUploadLogContent(failures);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const uploadExcelRows = async ({ file, processRow, onStart, onProgress, onDone }) => {
  const rows = await readExcelRows(file);
  const failures = [];
  let inserted = 0;

  onStart?.({ total: rows.length });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    try {
      await processRow(row, index);
      inserted += 1;
    } catch (error) {
      failures.push({
        rowNumber: index + 2,
        reason: getUploadErrorReason(error),
        row,
      });
    }

    onProgress?.({
      total: rows.length,
      processed: index + 1,
      inserted,
      failed: failures.length,
    });
  }

  onDone?.({ total: rows.length, inserted, failed: failures.length });

  return { total: rows.length, inserted, failures };
};
