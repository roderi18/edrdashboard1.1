import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useEffect, useCallback } from 'react';
import { pdf, Text, View, Page, Document, StyleSheet } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Select from '@mui/material/Select';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { useTheme, useMediaQuery } from '@mui/material';
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { descargarCsvPipe } from 'src/utils/csv-pipe';
import { generateMemberId } from 'src/utils/generate-member-id';
import {
  getCell,
  formatExcelDate,
  uploadExcelRows,
  normalizeTextValue,
} from 'src/utils/excel-upload';

import { getDestsApi } from 'src/services/dest-service';
import { invalidateMembersCache } from 'src/services/member-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { crearNotificacionCuentaCreada } from 'src/services/notification-service';
import { createFirebaseAuthForMember } from 'src/services/member-auth-provisioning-service';
import { guardarAsignacionDirectiva } from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { ExcelUploadResultDialog } from 'src/components/excel-upload-result-dialog';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';

import {
  buildMemberUploadAddress,
  normalizeMemberUploadPhone,
  formatMemberUploadBirthDate,
} from 'src/sections/member/utils/member-upload-normalizers';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const pdfStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 6, fontWeight: 700 },
  subtitle: { fontSize: 9, marginBottom: 16, color: '#52606d' },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#d9e2ec' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d9e2ec' },
  header: { backgroundColor: '#f0f4f8', fontWeight: 700 },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: '#d9e2ec' },
  code: { width: '16%' },
  name: { width: '24%' },
  phone: { width: '14%' },
  email: { width: '20%' },
  dest: { width: '16%' },
  section: { width: '10%', borderRightWidth: 0 },
});

const getValue = (value) => value || '-';

const readApiResponse = async (response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getApiMessage = (payload) => {
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

const DEFAULT_DOWNLOAD_FILTERS = {
  destName: [],
  memberPosition: [],
  memberDivision: [],
  sectionalId: [],
  regionalId: [],
  ageScope: 'adult',
  ageCustom: '',
  format: 'pdf',
};

const ALL_DOWNLOAD_OPTION = { value: 'all', label: 'Todos' };

const DEFAULT_UPLOAD_PROGRESS = {
  open: false,
  phase: 'reading',
  total: 0,
  processed: 0,
  inserted: 0,
  failed: 0,
};

const getTemplateDestIdForUser = (user = {}) => {
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

const normalizeDownloadOptions = (items = []) =>
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

const getFilterOptionValue = (option) => option?.value ?? option;

const getFilterOptionLabel = (option) =>
  String(option?.label ?? getFilterOptionValue(option) ?? '');

const getDownloadAutocompleteValue = (selectedValues, items) => {
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

const getSectionalIdsByRegion = (inputMembers, regionalIds) => {
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

const getSectionalOptionsByRegion = (items, inputMembers, regionalIds) => {
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
const buscarPosicionDirectiva = (nivel, texto) => {
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
const CABECERAS_MIEMBROS = [
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

const downloadMembersCsv = (membersToDownload) => {
  descargarCsvPipe({
    nombreArchivo: 'lista-miembros.csv',
    cabeceras: CABECERAS_MIEMBROS,
    filas: membersToDownload.map(filaDeMiembro),
  });
};

const applyDownloadFilters = (inputMembers, filters) =>
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

function MembersPdfDocument({ members }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Lista de miembros</Text>
        <Text style={pdfStyles.subtitle}>Total de miembros: {members.length}</Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.row, pdfStyles.header]}>
            <Text style={[pdfStyles.cell, pdfStyles.code]}>Código</Text>
            <Text style={[pdfStyles.cell, pdfStyles.name]}>Nombre</Text>
            <Text style={[pdfStyles.cell, pdfStyles.phone]}>Teléfono</Text>
            <Text style={[pdfStyles.cell, pdfStyles.email]}>Correo</Text>
            <Text style={[pdfStyles.cell, pdfStyles.dest]}>Destacamento</Text>
            <Text style={[pdfStyles.cell, pdfStyles.section]}>Sección</Text>
          </View>

          {members.map((member, index) => (
            <View key={`${member.id || member.memberId || index}`} style={pdfStyles.row}>
              <Text style={[pdfStyles.cell, pdfStyles.code]}>
                {getValue(member.memberId || member.codigoMiembro)}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.name]}>
                {getValue(
                  member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim()
                )}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.phone]}>{getValue(member.phoneNumber)}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.email]}>{getValue(member.email)}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.dest]}>
                {getValue(member.destName || member.destamento || member.idDestacamento)}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.section]}>
                {getValue(member.sectionalName)}
              </Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export function MemberTableToolbar({
  filters,
  onResetPage,
  displayMode,
  setDisplayMode,
  options,
  members = [],
  canManageMembers = true,
  showScopeFilters = true,
  onMembersUploaded,
}) {
  const { user } = useAuthContext();
  const menuActions = usePopover();
  const uploadInputRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(DEFAULT_UPLOAD_PROGRESS);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadFilters, setDownloadFilters] = useState(DEFAULT_DOWNLOAD_FILTERS);

  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );
  const handleFilterdestName = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({
        destName: newValue.map((v) => (typeof v === 'object' ? v.value : v)),
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterSectionalId = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({
        sectionalId: newValue.map((v) => (typeof v === 'object' ? v.value : v)),
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterMemberPosition = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({ memberPosition: newValue });
    },
    [onResetPage, updateFilters]
  );

  const downloadMembersPdf = async (membersToDownload) => {
    const blob = await pdf(<MembersPdfDocument members={membersToDownload} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'lista-miembros.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenDownloadDialog = () => {
    menuActions.onClose();
    setDownloadFilters(DEFAULT_DOWNLOAD_FILTERS);
    setDownloadDialogOpen(true);
  };

  const handleDownloadAutocompleteChange = useCallback(
    (key, selectedOptions, details) => {
      const isSelectingAll = details?.option?.value === ALL_DOWNLOAD_OPTION.value;
      const nextValues = isSelectingAll
        ? []
        : (selectedOptions || [])
            .filter((option) => option.value !== ALL_DOWNLOAD_OPTION.value)
            .map((option) => String(option.value));

      setDownloadFilters((prev) => {
        const nextFilters = {
          ...prev,
          [key]: nextValues,
        };

        if (key === 'regionalId' && nextValues.length) {
          const allowedSectionalIds = getSectionalIdsByRegion(members, nextValues);
          nextFilters.sectionalId = prev.sectionalId.filter((sectionalId) =>
            allowedSectionalIds?.has(String(sectionalId))
          );
        }

        return nextFilters;
      });
    },
    [members]
  );

  const handleDownloadMembers = async () => {
    const membersToDownload = applyDownloadFilters(members, downloadFilters);

    if (downloadFilters.format === 'csv') {
      downloadMembersCsv(membersToDownload);
    } else {
      await downloadMembersPdf(membersToDownload);
    }

    setDownloadDialogOpen(false);
  };

  const renderDownloadAutocomplete = (key, label, items) => {
    const autocompleteOptions = [ALL_DOWNLOAD_OPTION, ...normalizeDownloadOptions(items)];

    return (
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={autocompleteOptions}
        value={getDownloadAutocompleteValue(downloadFilters[key], items)}
        getOptionKey={(option) => `${key}-${option.value}`}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        getOptionLabel={(option) => option.label}
        onChange={(event, selectedOptions, reason, details) =>
          handleDownloadAutocompleteChange(key, selectedOptions, details)
        }
        renderOption={(props, option, { selected }) => {
          const { key: optionKey, ...optionProps } = props;

          return (
            <li key={`${optionKey}-${option.value}`} {...optionProps}>
              <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
              {option.label}
            </li>
          );
        }}
        renderInput={(params) => <TextField {...params} label={label} />}
      />
    );
  };

  // Un desplegable con una sola opcion no es una eleccion: obligar a abrirlo,
  // marcar la casilla y cerrar fuera para llegar al unico resultado posible es
  // trabajo sin recompensa. Se aplica solo.
  //
  // Solo la PRIMERA vez para cada opcion. Sin el registro de lo ya aplicado, al
  // desmarcar la casilla el efecto la volvia a marcar en el acto y el filtro no
  // se podia quitar.
  const filtrosAutoAplicados = useRef(new Set());

  useEffect(() => {
    const candidatos = [
      ['destName', options.destName, currentFilters.destName],
      ['memberPosition', options.memberPosition, currentFilters.memberPosition],
      ['sectionalId', options.sectionalId, currentFilters.sectionalId],
      ['regionalId', options.regionalId, currentFilters.regionalId],
    ];

    const cambios = {};

    candidatos.forEach(([clave, items, seleccionado]) => {
      if ((items || []).length !== 1) return;
      if ((seleccionado || []).length !== 0) return;

      const valor = getFilterOptionValue(items[0]);
      const marca = `${clave}:${valor}`;

      if (filtrosAutoAplicados.current.has(marca)) return;

      filtrosAutoAplicados.current.add(marca);
      cambios[clave] = [valor];
    });

    if (Object.keys(cambios).length) updateFilters(cambios);
  }, [options, currentFilters, updateFilters]);

  const renderFilterSelect = (key, label, items, value, onChange) => (
    <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
      <InputLabel htmlFor={`filter-${key}-select`}>{label}</InputLabel>
      <Select
        multiple
        label={label}
        value={value}
        onChange={onChange}
        renderValue={(selected) =>
          selected
            .map((selectedValue) => {
              const found = (items || []).find(
                (item) => String(getFilterOptionValue(item)) === String(selectedValue)
              );

              return found ? getFilterOptionLabel(found) : selectedValue;
            })
            .join(', ')
        }
        inputProps={{ id: `filter-${key}-select` }}
        MenuProps={{
          slotProps: { paper: { sx: { maxHeight: 250 } } },
        }}
      >
        {(items || []).map((option, index) => {
          const optionValue = getFilterOptionValue(option);

          return (
            <MenuItem key={`${key}-${optionValue}-${index}`} value={optionValue}>
              <Checkbox size="small" checked={value.includes(optionValue)} />
              {getFilterOptionLabel(option)}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );

  const downloadSectionalOptions = getSectionalOptionsByRegion(
    options.sectionalId,
    members,
    downloadFilters.regionalId
  );

  // Del nombre del destacamento tal como viene en el archivo al id real. Se
  // compara sin acentos ni mayusculas y con el numero pegado o suelto, porque
  // quien rellena la hoja escribe "Tribu de Judá 18", "tribu de juda 18" o
  // "Tribu de Juda" indistintamente.
  const buscarDestacamentoPorNombre = (listaDests, texto) => {
    const buscado = normalizeTextValue(texto).replace(/\s+/g, ' ').trim();

    if (!buscado) return null;

    const candidatos = (listaDests || []).map((dest) => {
      const nombre = normalizeTextValue(dest.name || dest.nombre || dest.destName || '');
      const numero = String(dest.destNumber || dest.numero || dest.number || '').trim();

      return {
        dest,
        conNumero: [nombre, normalizeTextValue(numero)].filter(Boolean).join(' ').trim(),
        sinNumero: nombre,
      };
    });

    return (
      candidatos.find((candidato) => candidato.conNumero === buscado)?.dest ||
      candidatos.find((candidato) => candidato.sinNumero === buscado)?.dest ||
      null
    );
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    menuActions.onClose();
    setUploadProgress({
      ...DEFAULT_UPLOAD_PROGRESS,
      open: true,
      phase: 'reading',
    });

    try {
      const listaDests = await getDestsApi({ includePhotos: false }).catch(() => []);
      // Codigos repartidos en ESTA carga. La lista de miembros se cachea 30
      // segundos y el API tarda en devolver al recien creado, asi que sin
      // llevarlos aparte todas las filas del archivo recibian el mismo codigo:
      // el segundo miembro en adelante entraba con un codigo ya ocupado.
      const codigosReservados = [];

      const result = await uploadExcelRows({
        file,
        processRow: async (row) => {
          // Si la hoja no trae las cabeceras esperadas se leen por POSICION, en el
          // orden de CABECERAS_MIEMBROS. Asi vale igual un Excel exportado de otro
          // sitio o un txt con barras: lo que importa es el orden de las columnas.
          const celdas = Object.values(row);
          const porPosicion = (indice) => celdas[indice] ?? '';
          const traeCabeceras = CABECERAS_MIEMBROS.some((cabecera) => row[cabecera] !== undefined);
          const leerValor = (indice, claves) =>
            traeCabeceras ? getCell(row, claves) : porPosicion(indice);
          // Todo se convierte a TEXTO. Excel guarda el telefono como numero
          // (18297878833) y la API lo exige como cadena: sin esto, cada fila que
          // viniera de un Excel se rechazaba con "could not be converted to String".
          const leer = (indice, claves) => String(leerValor(indice, claves) ?? '').trim();

          const nombre = leer(0, ['Nombre', 'nombre', 'Nombres', 'nombres']);
          const apellido = leer(1, ['Apellido', 'apellido', 'Apellidos', 'apellidos']);
          const nombreCompleto = `${nombre} ${apellido}`.trim();
          let fechaNacimiento = '';
          let telefono = '';

          try {
            fechaNacimiento = formatMemberUploadBirthDate(
              leerValor(2, ['Fecha_Nacimiento', 'fechaNacimiento', 'Fecha nacimiento', 'birthdate'])
            );
          } catch (error) {
            throw new Error(
              `Fecha_Nacimiento inválida para "${nombreCompleto || 'miembro sin nombre'}": ${error.message}`
            );
          }

          try {
            telefono = normalizeMemberUploadPhone(
              leerValor(3, ['Teléfono', 'telefono', 'Telefono'])
            );
          } catch (error) {
            throw new Error(
              `Teléfono inválido para "${nombreCompleto || 'miembro sin nombre'}": ${error.message}`
            );
          }

          const valores = {
            Nombre: nombre,
            Apellido: apellido,
            Fecha_Nacimiento: fechaNacimiento,
            Teléfono: telefono,
            Correo: leer(4, ['Correo', 'correo']),
            Provincia: leer(5, ['Provincia', 'provincia']),
            Municipio: leer(6, ['Municipio', 'municipio']),
            Sector: leer(7, ['Sector', 'sector']),
            Calle_Numero: leer(8, [
              'Calle / número',
              'Calle / Numero',
              'Calle / Número',
              'Calle_Numero',
              'Calle',
              'calle',
            ]),
            Destacamento: leer(9, ['Destacamento', 'destacamento']),
            Posicion_Destacamento: leer(10, [
              'Posición_Destacamento',
              'Posicion_Destacamento',
              'Posición en destacamento',
            ]),
            Posicion_Nacional: leer(11, [
              'Posición_Nacional',
              'Posicion_Nacional',
              'Posición nacional',
            ]),
            'Size_T-Shirt': leer(12, ['Size_T-Shirt', 'sizeCamisas', 'Talla']),
            Sexo: leer(13, ['Sexo', 'sexo', 'genero', 'Género', 'Genero']),
          };

          const direccionAnterior = String(
            getCell(row, ['Dirección', 'direccion', 'Direccion']) ?? ''
          ).trim();
          let direccion = '';

          try {
            direccion = buildMemberUploadAddress({
              province: valores.Provincia,
              municipality: valores.Municipio,
              sector: valores.Sector,
              streetAndNumber: valores.Calle_Numero,
              legacyAddress: direccionAnterior,
            });
          } catch (error) {
            throw new Error(
              `Dirección inválida para "${nombreCompleto || 'miembro sin nombre'}": ${error.message}`
            );
          }

          // Obligatorios solo los tres que identifican a la persona y la colocan. Con
          // todo obligatorio se rechazaba el archivo entero, porque casi nadie tiene
          // aun fecha de nacimiento ni correo registrados.
          const faltantes = ['Nombre', 'Apellido', 'Destacamento'].filter(
            (columna) => !String(valores[columna] ?? '').trim()
          );

          if (faltantes.length) {
            throw new Error(`Faltan: ${faltantes.join(', ')}.`);
          }

          const nombres = valores.Nombre;
          const apellidos = valores.Apellido;

          const destEncontrado = buscarDestacamentoPorNombre(listaDests, valores.Destacamento);
          const idDestacamento =
            Number(getCell(row, ['idDestacamento', 'destId', 'ID Destacamento'])) ||
            Number(destEncontrado?.id || destEncontrado?.idDestacamento) ||
            null;

          if (!idDestacamento) {
            throw new Error(`No existe el destacamento "${valores.Destacamento}".`);
          }

          const cargoDestacamento = buscarPosicionDirectiva(
            'destacamento',
            valores.Posicion_Destacamento
          );
          const cargoNacional = buscarPosicionDirectiva('nacional', valores.Posicion_Nacional);

          // Vacio significa "sin cargo". Solo se protesta cuando viene escrito algo
          // que no existe, que si es un error de quien rellena la hoja.
          if (valores.Posicion_Destacamento && !cargoDestacamento) {
            throw new Error(
              `No existe la posición de destacamento "${valores.Posicion_Destacamento}".`
            );
          }

          if (valores.Posicion_Nacional && !cargoNacional) {
            throw new Error(`No existe la posición nacional "${valores.Posicion_Nacional}".`);
          }

          const codigoMiembro =
            getCell(row, ['codigoMiembro', 'Código', 'Codigo']) ||
            (await generateMemberId({ codigosReservados }));

          codigosReservados.push(codigoMiembro);

          const res = await fetch('/api/members/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idMiembros: 0,
              codigoMiembro,
              nombres,
              apellidos,
              // Vacio va como null, no como "": el backend rechaza la cadena vacia
              // en fecha y division ("The JSON value could not be converted to
              // DateOnly"), y toda la fila se perdia sin decir por que.
              genero: valores.Sexo || null,
              fechaNacimiento: valores.Fecha_Nacimiento || null,
              idDestacamento,
              telefono: valores['Teléfono'] || null,
              direccion: direccion || null,
              correo: valores.Correo || null,
              sizeCamisas: valores['Size_T-Shirt'] || null,
              idCargoLocal: Number(getCell(row, ['idCargoLocal'])) || null,
              idCargoInstitucional: Number(getCell(row, ['idCargoInstitucional'])) || null,
              idDivision: Number(getCell(row, ['idDivision'])) || null,
              instructorCertificadoCi:
                getCell(row, ['instructorCertificadoCi', 'Instructor CI']) || false,
              estatusVigenciaCi: getCell(row, ['estatusVigenciaCi', 'Estatus CI']) || false,
              fechaInicioCertificado:
                formatExcelDate(
                  getCell(row, ['fechaInicioCertificado', 'Fecha inicio certificado'])
                ) || null,
              fechaFinCertificado:
                formatExcelDate(getCell(row, ['fechaFinCertificado', 'Fecha fin certificado'])) ||
                null,
              estatusMiembro: getCell(row, ['estatusMiembro', 'Estatus']) || 'activo',
              cargosmiembros: [],
              idDestacamentoNavigation: null,
              idDivisionNavigation: null,
              miembromeritos: [],
              participanteseventos: [],
              tutores: [],
              usuarios: [],
              idUniformes: [],
              uniformesMiembros: [],
            }),
          });
          const responsePayload = await readApiResponse(res);
          const responseMessage = getApiMessage(responsePayload);

          if (!res.ok) {
            throw new Error(responseMessage || `Error creando miembro (${res.status}).`);
          }

          if (responsePayload?.Success === false) {
            throw new Error(responseMessage || 'El API no pudo crear el miembro.');
          }

          // Los cargos se asignan DESPUES de crear al miembro, que es cuando existe
          // el id al que colgarlos. Si el API no lo devuelve, el miembro queda
          // creado y el cargo sin poner: se avisa en vez de callarlo.
          const idCreado =
            responsePayload?.data?.idMiembros ??
            responsePayload?.Data?.idMiembros ??
            responsePayload?.idMiembros ??
            null;

          if (!idCreado) {
            throw new Error(
              'El miembro se creó, pero el API no devolvió su id y quedó sin cargos.'
            );
          }

          // Un cargo por nivel, y solo si la hoja lo trae: sin esta guarda, subir a
          // alguien sin cargo reventaba al leer `idCargo` de null.
          const asignaciones = [
            cargoDestacamento && {
              nivel: 'destacamento',
              idEntidad: idDestacamento,
              nombreEntidad: valores.Destacamento,
              cargo: cargoDestacamento,
            },
            cargoNacional && {
              nivel: 'nacional',
              idEntidad: 'general',
              nombreEntidad: 'Consejo Nacional',
              cargo: cargoNacional,
            },
          ].filter(Boolean);

          for (const asignacion of asignaciones) {
            // En serie: son dos como mucho, y a la vez se pisarian al escribir el
            // mismo documento de directiva.

            await guardarAsignacionDirectiva({
              nivel: asignacion.nivel,
              idEntidad: asignacion.idEntidad,
              nombreEntidad: asignacion.nombreEntidad,
              idCargo: asignacion.cargo.idCargo,
              idPosicionDirectiva: asignacion.cargo.idCargo,
              division: asignacion.cargo.division ?? null,
              orden: asignacion.cargo.orden ?? 1,
              idMiembro: idCreado,
              nombreMiembro: `${nombres} ${apellidos}`.trim(),
              codigoMiembro,
              usuario: user,
            });
          }

          let authCredentials = null;

          try {
            authCredentials = await createFirebaseAuthForMember({
              codigoMiembro,
              firstName: nombres,
              lastName: apellidos,
              destId: idDestacamento,
              memberId: idCreado,
            });
          } catch (authError) {
            if (authError?.code === 'auth/email-already-in-use') {
              console.warn('[member upload] firebase auth user already exists', authError);
            } else {
              throw new Error(
                `El miembro se creó, pero no se pudo crear su cuenta de acceso: ${authError?.message || 'error desconocido'}`
              );
            }
          }

          if (authCredentials) {
            crearNotificacionCuentaCreada({
              cuenta: {
                idMiembros: idCreado,
                codigoMiembro,
                uid: authCredentials.uid,
                displayName: `${nombres} ${apellidos}`.trim(),
                email: authCredentials.emailFake,
              },
              usuario: user,
            }).catch((notificationError) => {
              console.error('[member upload] account notification failed', notificationError);
            });
          }
        },
        onStart: ({ total }) => {
          setUploadProgress((current) => ({
            ...current,
            phase: 'uploading',
            total,
          }));
        },
        onProgress: ({ total, processed, inserted, failed }) => {
          setUploadProgress({
            open: true,
            phase: 'uploading',
            total,
            processed,
            inserted,
            failed,
          });
        },
      });

      invalidateMembersCache();

      if (result.inserted > 0 && onMembersUploaded) {
        setUploadProgress((current) => ({ ...current, phase: 'refreshing' }));

        try {
          await onMembersUploaded();
        } catch (error) {
          console.error('Error refreshing members after upload:', error);
          toast.error('Los miembros se cargaron, pero no se pudo actualizar la vista.');
        }
      }

      setUploadResult(result);
    } catch (error) {
      setUploadResult({
        total: 0,
        inserted: 0,
        failures: [
          {
            rowNumber: 'archivo',
            reason: error?.message || 'No se pudo leer o procesar el documento.',
            row: { archivo: file.name },
          },
        ],
      });
    } finally {
      setUploadProgress(DEFAULT_UPLOAD_PROGRESS);
    }
  };

  const handleDownloadMemberTemplate = async () => {
    setTemplateDownloading(true);

    try {
      const templateDestId = getTemplateDestIdForUser(user);
      const query = templateDestId ? `?destId=${encodeURIComponent(templateDestId)}` : '';
      const response = await fetch(`/api/members/template${query}`, { cache: 'no-store' });

      if (!response.ok) {
        const payload = await readApiResponse(response);
        throw new Error(getApiMessage(payload) || 'No se pudo generar la plantilla.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = 'plantilla-miembros.xlsx';
      link.click();
      URL.revokeObjectURL(url);
      menuActions.onClose();
    } catch (error) {
      toast.error(error?.message || 'No se pudo descargar la plantilla de miembros.');
    } finally {
      setTemplateDownloading(false);
    }
  };

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        {/* 🔥 SOLO EN MOBILE → opciones de vista */}
        {isMobile && [
          <MenuItem
            key="panel"
            selected={displayMode === 'panel'}
            onClick={() => {
              setDisplayMode('panel');
              menuActions.onClose();
            }}
          >
            <Iconify icon="solar:list-bold" />
            Panel
          </MenuItem>,

          <MenuItem
            key="grid"
            selected={displayMode === 'grid'}
            onClick={() => {
              setDisplayMode('grid');
              menuActions.onClose();
            }}
          >
            <Iconify icon="mingcute:dot-grid-fill" />
            Grid
          </MenuItem>,
        ]}

        <MenuItem onClick={handleOpenDownloadDialog}>
          <Iconify icon="solar:import-bold" />
          Descargar
        </MenuItem>

        <MenuItem disabled={templateDownloading} onClick={handleDownloadMemberTemplate}>
          <Iconify icon="solar:download-minimalistic-bold" />
          {templateDownloading ? 'Preparando plantilla...' : 'Descargar plantilla miembros'}
        </MenuItem>

        {canManageMembers && (
          <MenuItem disabled={uploadProgress.open} onClick={() => uploadInputRef.current?.click()}>
            <Iconify icon="solar:export-bold" />
            Subir
          </MenuItem>
        )}
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Box
        sx={{
          p: 2.5,
          gap: { xs: 0, md: 2 },
          display: 'flex',
          pr: { xs: 2.5, md: 1 },
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-end', md: 'center' },
        }}
      >
        <Box
          sx={{
            gap: 2,
            width: 1,
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {!isMobile && (
            <TextField
              fullWidth
              value={currentFilters.name}
              onChange={handleFilterName}
              placeholder="Buscar nombre..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          )}
        </Box>

        {/* boton de filtro para desktop */}
        {!isMobile && (
          <>
            {showScopeFilters &&
              renderFilterSelect(
                'destName',
                'Destacamento',
                options.destName,
                currentFilters.destName,
                handleFilterdestName
              )}

            {renderFilterSelect(
              'memberPosition',
              'Posición',
              options.memberPosition,
              currentFilters.memberPosition,
              handleFilterMemberPosition
            )}

            {showScopeFilters &&
              renderFilterSelect(
                'sectionalId',
                'Sección',
                options.sectionalId,
                currentFilters.sectionalId,
                handleFilterSectionalId
              )}
          </>
        )}

        {/* boton de filtro para moviles */}
        {/* Mobile Filter + View Toggle alineados */}
        {isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: '100%',
            }}
          >
            {/* 🔍 Search */}
            <TextField
              value={currentFilters.name}
              onChange={handleFilterName}
              placeholder="Buscar nombre..."
              sx={{
                flex: 1, // 🔥 ocupa TODO el espacio sobrante
                minWidth: 0, // 🔥 evita que rompa el flexbox
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* 🔽 Filter */}
            <TableToolbarMobileFilter
              hasActiveFilters={
                (showScopeFilters && currentFilters.destName.length) ||
                currentFilters.memberPosition.length ||
                (showScopeFilters && currentFilters.sectionalId.length)
              }
              filtersConfig={[
                ...(showScopeFilters
                  ? [
                      {
                        key: 'destName',
                        label: 'Destacamento',
                        value: currentFilters.destName,
                        onChange: handleFilterdestName,
                        options: options.destName,
                      },
                    ]
                  : []),
                {
                  key: 'memberPosition',
                  label: 'Posición',
                  value: currentFilters.memberPosition,
                  onChange: handleFilterMemberPosition,
                  options: options.memberPosition,
                },
                ...(showScopeFilters
                  ? [
                      {
                        key: 'sectionalId',
                        label: 'Sección',
                        value: currentFilters.sectionalId,
                        onChange: handleFilterSectionalId,
                        options: options.sectionalId,
                      },
                    ]
                  : []),
              ]}
            />

            {/* ⋮ More */}
            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        )}

        {/* 🔄 View Mode + ⋮ More para desktop */}
        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 'auto', // 🔥 los empuja a la derecha
            }}
          >
            {!isMobile && (
              <ViewModeToggle
                value={displayMode}
                onChange={setDisplayMode}
                storageKey="global-display-mode"
              />
            )}

            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        )}
      </Box>

      {renderMenuActions()}
      <Dialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Descargar miembros</DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {renderDownloadAutocomplete('regionalId', 'Región', options.regionalId)}
            {renderDownloadAutocomplete('sectionalId', 'Sección', downloadSectionalOptions)}
            {renderDownloadAutocomplete('destName', 'Destacamento', options.destName)}
            {renderDownloadAutocomplete('memberDivision', 'División', options.memberDivision)}
            {renderDownloadAutocomplete('memberPosition', 'Posición', options.memberPosition)}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Edad
              </Typography>
              <RadioGroup
                row
                value={downloadFilters.ageScope}
                onChange={(event) =>
                  setDownloadFilters((prev) => ({ ...prev, ageScope: event.target.value }))
                }
              >
                <FormControlLabel value="all" control={<Radio />} label="Todos" />
                <FormControlLabel value="minor" control={<Radio />} label="Menores de edad" />
                <FormControlLabel value="adult" control={<Radio />} label="Mayores de edad" />
                <FormControlLabel value="custom" control={<Radio />} label="Otros (avanzados)" />
              </RadioGroup>

              {downloadFilters.ageScope === 'custom' && (
                <TextField
                  fullWidth
                  value={downloadFilters.ageCustom}
                  onChange={(event) =>
                    setDownloadFilters((prev) => ({ ...prev, ageCustom: event.target.value }))
                  }
                  helperText={
                    <>
                      Escribe edades separadas por coma. Puedes usar &gt; o &lt;, por ejemplo: 15,
                      16, &gt;30, &lt;12.
                      <br />
                      &gt; (mayor que la edad), &lt; (menor que la edad)
                    </>
                  }
                  placeholder="15, 16, 17, 20, o >30, <12"
                  size="small"
                  sx={{ mt: 1.5 }}
                />
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Formato
              </Typography>
              <RadioGroup
                row
                value={downloadFilters.format}
                onChange={(event) =>
                  setDownloadFilters((prev) => ({ ...prev, format: event.target.value }))
                }
              >
                <FormControlLabel value="pdf" control={<Radio />} label="PDF" />
                <FormControlLabel value="csv" control={<Radio />} label="CSV" />
              </RadioGroup>
            </Box>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {applyDownloadFilters(members, downloadFilters).length} miembros coinciden con estos
              filtros.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDownloadDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleDownloadMembers}>
            Descargar
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog fullWidth maxWidth="xs" open={uploadProgress.open} disableEscapeKeyDown>
        <DialogTitle>Subiendo miembros</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <LinearProgress
              variant={uploadProgress.total ? 'determinate' : 'indeterminate'}
              value={
                uploadProgress.total
                  ? Math.round((uploadProgress.processed / uploadProgress.total) * 100)
                  : undefined
              }
            />

            {uploadProgress.phase === 'reading' ? (
              <Typography>Leyendo el documento y contando las filas...</Typography>
            ) : uploadProgress.phase === 'refreshing' ? (
              <Stack spacing={0.5}>
                <Typography>Actualizando la vista de miembros...</Typography>
                <Typography variant="body2" color="text.secondary">
                  Cargadas correctamente: {uploadProgress.inserted}. Con error:{' '}
                  {uploadProgress.failed}.
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={0.5}>
                <Typography>
                  Filas procesadas: <strong>{uploadProgress.processed}</strong> de{' '}
                  <strong>{uploadProgress.total}</strong>.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cargadas correctamente: {uploadProgress.inserted}. Con error:{' '}
                  {uploadProgress.failed}.
                </Typography>
              </Stack>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
      <input
        ref={uploadInputRef}
        hidden
        type="file"
        accept=".csv,.txt,.tsv,.xlsx,.xls"
        onChange={handleUploadFile}
      />
      <ExcelUploadResultDialog
        open={!!uploadResult}
        result={uploadResult}
        logFileName="log-subida-miembros.txt"
        onClose={() => setUploadResult(null)}
      />
    </>
  );
}

