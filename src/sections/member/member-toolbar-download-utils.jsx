
import { descargarCsvPipe } from 'src/utils/csv-pipe';
import { normalizeTextValue } from 'src/utils/excel-upload';

import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';

// ----------------------------------------------------------------------

export const readApiResponse = async (response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const getApiMessage = (payload) => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;

  // El detalle util viene en `errors`, campo a campo. El `message` de arriba es
  // siempre "Operación completada", que no dice absolutamente nada de por que
  // se rechazo la fila.
  const errores = payload.data?.errors || payload.errors || payload.Data?.errors;

  if (errores && typeof errores === 'object') {
    const detalle = Object.entries(errores)
      .map(([campo, mensajes]) => `${campo.replace(/^\$./, '')}: ${[].concat(mensajes).join(' ')}`)
      .join(' | ');

    if (detalle) return detalle;
  }

  return payload.Message || payload.message || payload.error || payload.title || '';
};

export const DEFAULT_DOWNLOAD_FILTERS = {
  destName: [],
  memberPosition: [],
  memberDivision: [],
  sectionalId: [],
  regionalId: [],
  ageScope: 'adult',
  ageCustom: '',
  format: 'pdf',
};

export const ALL_DOWNLOAD_OPTION = { value: 'all', label: 'Todos' };

export const DEFAULT_UPLOAD_PROGRESS = {
  open: false,
  phase: 'reading',
  total: 0,
  processed: 0,
  inserted: 0,
  failed: 0,
};

export const getTemplateDestIdForUser = (user = {}) => {
  const scope = user?.alcance ?? {};
  const scopeType = String(scope?.tipo ?? scope?.modo ?? '')
    .trim()
    .toLowerCase();

  if (scopeType !== 'destacamento') return '';

  return String(
    scope?.destacamentoId ??
      scope?.idDestacamento ??
      scope?.destacamentos?.[0] ??
      user?.idDestacamento ??
      user?.destId ??
      ''
  ).trim();
};

export const normalizeDownloadOptions = (items = []) =>
  items
    .map((item) => ({
      value: String(item.value),
      label: item.label || String(item.value),
    }))
    .filter((item) => item.value !== ALL_DOWNLOAD_OPTION.value)
    .filter(
      (item, index, array) =>
        array.findIndex((option) => option.value === item.value && option.label === item.label) ===
        index
    );

export const getFilterOptionValue = (option) => option?.value ?? option;

export const getFilterOptionLabel = (option) =>
  String(option?.label ?? getFilterOptionValue(option) ?? '');

export const getDownloadAutocompleteValue = (selectedValues, items) => {
  const normalizedItems = normalizeDownloadOptions(items);

  if (!selectedValues?.length) {
    return [ALL_DOWNLOAD_OPTION];
  }

  return selectedValues.map((value) => {
    const stringValue = String(value);
    return (
      normalizedItems.find((item) => item.value === stringValue) || {
        value: stringValue,
        label: stringValue,
      }
    );
  });
};

export const getSectionalIdsByRegion = (inputMembers, regionalIds) => {
  if (!regionalIds.length) {
    return null;
  }

  return new Set(
    inputMembers
      .filter((member) => regionalIds.includes(String(member.regionalId)))
      .map((member) => String(member.sectionalId || ''))
      .filter(Boolean)
  );
};

export const getSectionalOptionsByRegion = (items, inputMembers, regionalIds) => {
  const allowedSectionalIds = getSectionalIdsByRegion(inputMembers, regionalIds);

  if (!allowedSectionalIds) {
    return items;
  }

  return (items || []).filter((item) => allowedSectionalIds.has(String(item.value)));
};

const getMemberAge = (member) => {
  const birthdate =
    member?.birthDate || member?.birth || member?.dateOfBirth || member?.fechaNacimiento;

  if (!birthdate) return null;

  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age;
};

const matchCustomAgeRule = (age, rule) => {
  const expression = rule.trim().replace(/^o\s+/i, '');

  if (!expression) {
    return false;
  }

  const comparisonMatch = expression.match(/^(>=|<=|>|<)\s*(\d+)$/);

  if (comparisonMatch) {
    const [, operator, value] = comparisonMatch;
    const targetAge = Number(value);

    if (operator === '>') return age > targetAge;
    if (operator === '>=') return age >= targetAge;
    if (operator === '<') return age < targetAge;
    if (operator === '<=') return age <= targetAge;
  }

  const exactAge = Number(expression);

  return Number.isInteger(exactAge) && age === exactAge;
};

const matchesCustomAgeFilter = (age, customFilter) => {
  const rules = String(customFilter || '')
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean);

  if (!rules.length) {
    return true;
  }

  return rules.some((rule) => matchCustomAgeRule(age, rule));
};

// Nombre del destacamento CON su numero: "Tribu de Judá" a secas no distingue un
// destacamento de otro que se llame igual, y al volver a subir el archivo habria
// que adivinar a cual de los dos se referia.
const nombreDestacamentoConNumero = (member = {}) => {
  const nombre = member.destName || member.destamento || '';
  const numero = member.destNumber || member.numero || '';

  return [nombre, numero].filter(Boolean).join(' ').trim() || String(member.idDestacamento || '');
};

// Del texto del cargo al cargo del catalogo. Se compara sin acentos ni
// mayusculas, y se acepta tanto "Líder de Grupo" como "Líder de Grupo
// (Exploradores)", que es como sale al descargar.
export const buscarPosicionDirectiva = (nivel, texto) => {
  const buscado = normalizeTextValue(texto).replace(/\s+/g, ' ').trim();

  if (!buscado) return null;

  const delNivel = DIRECTIVA_POSITIONS.filter((posicion) => posicion.nivel === nivel);

  return (
    delNivel.find((posicion) => {
      const nombre = normalizeTextValue(posicion.nombreCargo);
      const division = normalizeTextValue(posicion.nombreDivision);
      const conDivision = division ? `${nombre} (${division})` : nombre;

      return buscado === conDivision || buscado === nombre;
    }) || null
  );
};

// Orden de las columnas. Es el mismo al bajar y al subir, y tambien el que se
// usa para leer una hoja que no traiga cabeceras: ahi la posicion es lo unico
// que identifica a cada columna.
//
// Seccion y Region NO estan: las dos se deducen del destacamento, y repetirlas
// abria la puerta a que el archivo dijera una cosa y la base de datos otra.
export const CABECERAS_MIEMBROS = [
  'Nombre',
  'Apellido',
  'Fecha_Nacimiento',
  'Teléfono',
  'Correo',
  'Provincia',
  'Municipio',
  'Sector',
  'Calle / número',
  'Destacamento',
  'Posición_Destacamento',
  'Posición_Nacional',
  'Size_T-Shirt',
  'Sexo',
];

const getMemberAddressColumns = (member = {}) => {
  const addressParts = String(member.memberAddress || member.direccion || '')
    .split(',')
    .map((part) => part.trim());

  return [
    member.provinceName || member.provincia || addressParts[0] || '',
    member.municipalityName || member.municipio || addressParts[1] || '',
    member.sectorName || member.sector || addressParts[2] || '',
    member.street || member.calle || addressParts.slice(3).join(', ') || '',
  ];
};

const filaDeMiembro = (member) => {
  const [province, municipality, sector, streetAndNumber] = getMemberAddressColumns(member);

  return [
    member.firstName || member.nombres || '',
    member.lastName || member.apellidos || '',
    member.birthdate || member.fechaNacimiento || '',
    member.phoneNumber || '',
    member.email || '',
    province,
    municipality,
    sector,
    streetAndNumber,
    nombreDestacamentoConNumero(member),
    member.destLeadershipPosition || '',
    member.nationalLeadershipPosition || '',
    member.sizeCamisas || member.shirtSize || '',
    member.gender || member.genero || '',
  ];
};

export const downloadMembersCsv = (membersToDownload) => {
  descargarCsvPipe({
    nombreArchivo: 'lista-miembros.csv',
    cabeceras: CABECERAS_MIEMBROS,
    filas: membersToDownload.map(filaDeMiembro),
  });
};

export const applyDownloadFilters = (inputMembers, filters) =>
  inputMembers.filter((member) => {
    if (filters.destName.length && !filters.destName.includes(String(member.destId))) {
      return false;
    }

    if (
      filters.memberPosition.length &&
      !member.memberPosition?.some((role) => filters.memberPosition.includes(role))
    ) {
      return false;
    }

    if (
      filters.memberDivision.length &&
      !filters.memberDivision.includes(String(member.memberDivision || ''))
    ) {
      return false;
    }

    if (filters.sectionalId.length && !filters.sectionalId.includes(String(member.sectionalId))) {
      return false;
    }

    if (filters.regionalId.length && !filters.regionalId.includes(String(member.regionalId))) {
      return false;
    }

    if (filters.ageScope === 'adult') {
      const age = getMemberAge(member);
      return age !== null && age >= 18;
    }

    if (filters.ageScope === 'minor') {
      const age = getMemberAge(member);
      return age !== null && age < 18;
    }

    if (filters.ageScope === 'custom') {
      const age = getMemberAge(member);
      return age !== null && matchesCustomAgeFilter(age, filters.ageCustom);
    }

    return true;
  });
