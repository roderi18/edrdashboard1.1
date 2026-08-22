const padDatePart = (value) => String(value).padStart(2, '0');

const toIsoDate = ({ year, month, day }) => {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  const lastDayOfMonth = new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();

  if (
    !Number.isInteger(parsedYear) ||
    !Number.isInteger(parsedMonth) ||
    !Number.isInteger(parsedDay) ||
    parsedYear < 1 ||
    parsedMonth < 1 ||
    parsedMonth > 12 ||
    parsedDay < 1 ||
    parsedDay > lastDayOfMonth
  ) {
    return null;
  }

  return `${String(parsedYear).padStart(4, '0')}-${padDatePart(parsedMonth)}-${padDatePart(parsedDay)}`;
};

export const formatMemberUploadBirthDate = (value) => {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('la fecha de Excel no es válida. Corrige el archivo y vuelve a subirlo.');
    }

    return toIsoDate({
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    });
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  const dayFirstMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const parts = isoMatch
    ? { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] }
    : dayFirstMatch
      ? { year: dayFirstMatch[3], month: dayFirstMatch[2], day: dayFirstMatch[1] }
      : null;
  const formatted = parts ? toIsoDate(parts) : null;

  if (!formatted) {
    throw new Error(
      `el valor "${text}" no es válido. Usa DD-MM-AAAA, por ejemplo 18-06-2000. ` +
        'Corrige el archivo y vuelve a subirlo.'
    );
  }

  return formatted;
};

export const normalizeMemberUploadPhone = (value) => {
  if (value === null || value === undefined || value === '') return '';

  const text = String(value).trim();
  const digits = text.replace(/\D/g, '');

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

  throw new Error(
    `el valor "${text}" no es válido. Usa 10 dígitos, por ejemplo 8297878833. ` +
      'El prefijo +1 se agrega automáticamente.'
  );
};

export const buildMemberUploadAddress = ({
  province,
  municipality,
  sector,
  streetAndNumber,
  legacyAddress,
} = {}) => {
  const values = [province, municipality, sector, streetAndNumber].map((value) =>
    String(value ?? '').trim()
  );
  const [normalizedProvince, normalizedMunicipality, normalizedSector] = values;

  if (normalizedMunicipality && !normalizedProvince) {
    throw new Error('selecciona primero la Provincia.');
  }

  if (normalizedSector && !normalizedMunicipality) {
    throw new Error('selecciona primero el Municipio.');
  }

  return values.filter(Boolean).join(', ') || String(legacyAddress ?? '').trim();
};
