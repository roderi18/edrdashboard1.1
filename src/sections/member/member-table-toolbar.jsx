import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';
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
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { getCell, formatExcelDate, uploadExcelRows } from 'src/utils/excel-upload';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ExportTableButton } from 'src/components/export-table-button';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { ExcelUploadResultDialog } from 'src/components/excel-upload-result-dialog';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';

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

  return payload.Message || payload.message || payload.error || payload.title || '';
};

const getMemberCodeNumber = (member) => {
  const code = member.codigoMiembro || member.memberCode || member.memberId || member.code || '';
  const match = String(code).match(/DO-SD-(\d+)/i);

  return match ? Number(match[1]) : 0;
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

const MEMBER_EXPORT_COLUMNS = [
  { label: 'Código', value: (row) => row.memberId || row.codigoMiembro || '' },
  { label: 'Nombre', value: (row) => row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim() },
  { label: 'Teléfono', value: (row) => row.phoneNumber || '' },
  { label: 'Correo', value: (row) => row.email || '' },
  { label: 'Destacamento', value: (row) => row.destName || row.destamento || row.idDestacamento || '' },
  { label: 'Sección', value: (row) => row.sectionalName || '' },
  { label: 'Región', value: (row) => row.regionalName || '' },
  { label: 'División', value: (row) => row.memberDivision || '' },
];

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

const escapeCsvValue = (value) => {
  const text = String(value ?? '');

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const downloadMembersCsv = (membersToDownload) => {
  const headers = ['Código', 'Nombre', 'Teléfono', 'Correo', 'Destacamento', 'Sección', 'Región'];
  const rows = membersToDownload.map((member) => [
    member.memberId || member.codigoMiembro || '',
    member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim(),
    member.phoneNumber || '',
    member.email || '',
    member.destName || member.destamento || member.idDestacamento || '',
    member.sectionalName || '',
    member.regionalName || '',
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'lista-miembros.csv';
  link.click();
  URL.revokeObjectURL(url);
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
}) {
  const menuActions = usePopover();
  const uploadInputRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [uploadResult, setUploadResult] = useState(null);
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

  const getNextMemberCode = (() => {
    let nextNumber = Math.max(
      10000,
      ...members.map((member) => getMemberCodeNumber(member)).filter(Boolean)
    );

    return () => {
      nextNumber += 1;
      return `DO-SD-${String(nextNumber).padStart(5, '0')}`;
    };
  })();

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const result = await uploadExcelRows({
      file,
      processRow: async (row) => {
        const nombres = getCell(row, ['nombres', 'Nombres', 'nombre', 'Nombre']);
        const apellidos = getCell(row, ['apellidos', 'Apellidos', 'apellido', 'Apellido']);
        const fechaNacimiento = formatExcelDate(
          getCell(row, ['fechaNacimiento', 'Fecha nacimiento', 'birthdate'])
        );
        const idDestacamento = Number(
          getCell(row, ['idDestacamento', 'destId', 'ID Destacamento'])
        );

        if (!nombres) throw new Error('La columna nombres es requerida.');
        if (!apellidos) throw new Error('La columna apellidos es requerida.');
        if (!fechaNacimiento) throw new Error('La columna fechaNacimiento es requerida.');
        if (!idDestacamento) throw new Error('La columna idDestacamento es requerida.');

        const res = await fetch('/api/members/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idMiembros: 0,
            codigoMiembro:
              getCell(row, ['codigoMiembro', 'Código', 'Codigo']) || getNextMemberCode(),
            nombres,
            apellidos,
            genero: getCell(row, ['genero', 'Género', 'Genero']) || null,
            fechaNacimiento,
            idDestacamento,
            telefono: getCell(row, ['telefono', 'Teléfono', 'Telefono']),
            direccion: getCell(row, ['direccion', 'Dirección', 'Direccion']),
            correo: getCell(row, ['correo', 'Correo']) || null,
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
      },
    });

    setUploadResult(result);
    menuActions.onClose();
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

        <ExportTableButton
          rows={members}
          columns={MEMBER_EXPORT_COLUMNS}
          title="Lista de miembros"
          fileNamePrefix="lista-miembros"
          trigger="menuItem"
          buttonLabel="Exportar vista"
        />

        {canManageMembers && (
          <MenuItem onClick={() => uploadInputRef.current?.click()}>
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
      <input
        ref={uploadInputRef}
        hidden
        type="file"
        accept=".xlsx,.xls"
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
