import { usePopover } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';
import { pdf, Text, View, Page, Document, StyleSheet } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
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
                {getValue(member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim())}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.phone]}>{getValue(member.phoneNumber)}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.email]}>{getValue(member.email)}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.dest]}>
                {getValue(member.destName || member.destamento || member.idDestacamento)}
              </Text>
              <Text style={[pdfStyles.cell, pdfStyles.section]}>{getValue(member.sectionalName)}</Text>
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
  sectionals,
  members = [],
}) {
  const menuActions = usePopover();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [dests, setDests] = useState([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dest');
      const data = await res.json();
      setDests(data?.Data || []);
    };
    load();
  }, []);

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
        destName: newValue.map((v) =>
          typeof v === 'object' ? v.value : v
        ),
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterSectionalId = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string'
          ? event.target.value.split(',')
          : event.target.value;

      onResetPage();
      updateFilters({
        sectionalId: newValue.map((v) =>
          typeof v === 'object' ? v.value : v
        ),
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

  const handleDownloadMembersPdf = async () => {
    const blob = await pdf(<MembersPdfDocument members={members} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'lista-miembros.pdf';
    link.click();
    URL.revokeObjectURL(url);
    menuActions.onClose();
  };

  const handlePrint = async () => {
    const blob = await pdf(<MembersPdfDocument members={members} />).toBlob();
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');

    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };

    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);

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
          </MenuItem>
        ]}

        {/* Acciones normales */}
        <MenuItem onClick={handlePrint}>
          <Iconify icon="solar:printer-minimalistic-bold" />
          Imprimir
        </MenuItem>

        <MenuItem onClick={handleDownloadMembersPdf}>
          <Iconify icon="solar:import-bold" />
          Descargar
        </MenuItem>

        <MenuItem onClick={() => menuActions.onClose()}>
          <Iconify icon="solar:export-bold" />
          Subir
        </MenuItem>

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
            {/* Destacamento */}
            <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
              <InputLabel htmlFor="filter-destName-select">
                Destacamento
              </InputLabel>

              <Select
                multiple
                label="Destacamento"
                value={currentFilters.destName}
                onChange={handleFilterdestName}
                renderValue={(selected) =>
                  selected
                    .map((id) => dests.find((d) => d.id === id)?.name)
                    .join(', ')
                }
                inputProps={{ id: 'filter-destName-select' }}
                MenuProps={{
                  slotProps: { paper: { sx: { maxHeight: 250 } } },
                }}
              >
                {(options.destName || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox checked={currentFilters.destName.includes(option.value)} />
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Posición */}
            <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
              <InputLabel htmlFor="filter-memberPosition-select">
                Posición
              </InputLabel>

              <Select
                multiple
                label="Posición"
                value={currentFilters.memberPosition}
                onChange={handleFilterMemberPosition}
                renderValue={(selected) =>
                  selected
                    .map(
                      (value) =>
                        options.memberPosition?.find((opt) => opt.value === value)?.label || value
                    )
                    .join(', ')
                }
                inputProps={{ id: 'filter-memberPosition-select' }}
                MenuProps={{
                  slotProps: { paper: { sx: { maxHeight: 250 } } },
                }}
              >
                {(options.memberPosition || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox
                      disableRipple
                      size="small"
                      checked={currentFilters.memberPosition.includes(option.value)}
                    />
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Sección */}
            <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
              <InputLabel htmlFor="filter-sectionalId-select">
                Sección
              </InputLabel>

              <Select
                multiple
                label="Sección"
                value={currentFilters.sectionalId}
                onChange={handleFilterSectionalId}
                renderValue={(selected) =>
                  selected
                    .map((id) => {
                      const found = Array.isArray(sectionals)
                        ? sectionals.find(
                          (s) =>
                            s.id?.toString() === id?.toString() ||
                            s.idSeccion?.toString() === id?.toString()
                        )
                        : null;
                      console.log('DEBUG SECTION FILTER 👉', {
                        selectedId: id,
                        sectionals,
                        found: Array.isArray(sectionals)
                          ? sectionals.find(
                            (s) =>
                              s.id?.toString() === id?.toString() ||
                              s.idSeccion?.toString() === id?.toString()
                          )
                          : 'sectionals NO ES ARRAY',
                      });
                      return (
                        found?.sectionalName ||
                        found?.nombre ||
                        found?.name ||
                        id
                      );
                    })
                    .join(', ')
                }
                inputProps={{ id: 'filter-sectionalId-select' }}
                MenuProps={{
                  slotProps: { paper: { sx: { maxHeight: 250 } } },
                }}
              >
                {(options.sectionalId || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox
                      size="small"
                      checked={currentFilters.sectionalId.includes(option.value)}
                    />
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
                flex: 1,        // 🔥 ocupa TODO el espacio sobrante
                minWidth: 0,    // 🔥 evita que rompa el flexbox
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
                currentFilters.destName.length ||
                currentFilters.memberPosition.length ||
                currentFilters.sectionalId.length
              }
              filtersConfig={[
                {
                  key: 'destName',
                  label: 'Destacamento',
                  value: currentFilters.destName,
                  onChange: handleFilterdestName,
                  options: options.destName,
                  renderValue: (selected) =>
                    selected
                      .map((id) => dests.find((d) => d.id === id)?.name)
                      .join(', '),
                },
                {
                  key: 'memberPosition',
                  label: 'Posición',
                  value: currentFilters.memberPosition,
                  onChange: handleFilterMemberPosition,
                  options: options.memberPosition,
                  renderValue: (selected) => selected.join(', '),
                  // renderValue: (selected) =>
                  //   selected
                  //     .map( ------en caso que no funcione el de arriba
                  //       (value) =>
                  //         options.memberPosition?.find((opt) => opt.value === value)?.label || value
                  //     )
                  //     .join(', '),
                },
                {
                  key: 'sectionalId',
                  label: 'Sección',
                  value: currentFilters.sectionalId,
                  onChange: handleFilterSectionalId,
                  options: options.sectionalId,
                  renderValue: (selected) =>
                    selected
                      .map((id) => sectionals.find((s) => s.id === id)?.name)
                      .join(', '),
                },
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
      </Box >

      {renderMenuActions()}
    </>
  );
}
