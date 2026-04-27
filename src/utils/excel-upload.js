import * as XLSX from 'xlsx';

export const readExcelRows = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

export const getCell = (row, keys) => {
  const foundKey = keys.find((key) => row[key] !== undefined && row[key] !== null && row[key] !== '');

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

export const uploadExcelRows = async ({ file, processRow, onDone }) => {
  const rows = await readExcelRows(file);
  const failures = [];
  let inserted = 0;

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
  }

  onDone?.({ inserted, failed: failures.length });

  return { inserted, failures };
};
