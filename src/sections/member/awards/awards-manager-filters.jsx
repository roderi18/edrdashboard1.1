'use client';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';

import { Iconify } from 'src/components/iconify';
import { CustomDateRangePicker } from 'src/components/custom-date-range-picker';
import { ExpandableSearchInput } from 'src/components/expandable/search/ExpandableSearchInput';
import { ExpandableMultiSelect } from 'src/components/expandable/select/ExpandableMultiSelect';

// ----------------------------------------------------------------------

const STATUS_LABELS = {
  completado: 'Completado',
  en_progreso: 'En progreso',
  no_iniciado: 'No iniciado',
};

export function AwardsManagerFilters({
  filters,
  dateError,
  onResetPage,
  openDateRange,
  onCloseDateRange,
  activeInput,
  setActiveInput,
  showStatusFilter = true,
  statusCounts = { completado: 0, en_progreso: 0, no_iniciado: 0 },
  auditNotice = null,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterStartDate = useCallback(
    (newValue) => {
      onResetPage();
      updateFilters({ startDate: newValue });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterEndDate = useCallback(
    (newValue) => {
      updateFilters({ endDate: newValue });
    },
    [updateFilters]
  );

  const handleFilterStatus = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string'
          ? event.target.value.split(',')
          : event.target.value;

      onResetPage();
      updateFilters({ status: newValue });
    },
    [onResetPage, updateFilters]
  );


  // const renderFilterName = () => (
  //   <TextField
  //     value={currentFilters.name}
  //     onChange={handleFilterName}
  //     placeholder="Buscar..."
  //     slotProps={{
  //       input: {
  //         startAdornment: (
  //           <InputAdornment position="start">
  //             <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
  //           </InputAdornment>
  //         ),
  //       },
  //     }}
  //     sx={{ width: { xs: 1, md: 260 } }}
  //   />
  // );

  const renderFilterDate = () => (
    <CustomDateRangePicker
      variant="calendar"
      startDate={currentFilters.startDate}
      endDate={currentFilters.endDate}
      onChangeStartDate={handleFilterStartDate}
      onChangeEndDate={handleFilterEndDate}
      open={openDateRange}
      onClose={onCloseDateRange}
      selected={!!currentFilters.startDate && !!currentFilters.endDate}
      error={dateError}
    />
  );

  return (
    <Box
      sx={{
        gap: 1,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >

      <ExpandableSearchInput
        value={currentFilters.name}
        onChange={handleFilterName}
        placeholder="Buscar..."
        width={{ xs: 180, md: 260 }}
        compact={isMobile}
        activeInput={activeInput}
        onOpen={() => setActiveInput('search')}
        onClose={() => setActiveInput(null)}
      />


      {showStatusFilter && (
        <ExpandableMultiSelect
          label="Estado"
          value={currentFilters.status || []}
          onChange={handleFilterStatus}
          options={['completado', 'en_progreso', 'no_iniciado'].map((value) => ({
            value,
            label: `${STATUS_LABELS[value]} (${statusCounts[value] ?? 0})`,
            disabled: !(statusCounts[value] > 0),
          }))}
          width={{ xs: 140, md: 200 }}
          compact={isMobile}
          onOpen={() => setActiveInput('status')}
          onClose={() => setActiveInput(null)}
        />
      )}

      {/* Escudo de auditoría: al señalarlo despliega el aviso de registro/notificación. */}
      {auditNotice && (
        <Tooltip
          title={auditNotice}
          arrow
          enterTouchDelay={0}
          leaveTouchDelay={6000}
          slotProps={{
            tooltip: {
              sx: {
                maxWidth: 420,
                // Mismo tipo y tamaño que el texto del campo "Buscar...".
                fontFamily: theme.typography.body1.fontFamily,
                fontSize: theme.typography.body1.fontSize,
                fontWeight: theme.typography.body1.fontWeight,
                lineHeight: theme.typography.body1.lineHeight,
              },
            },
          }}
        >
          {/* Mismo recuadro que el grupo lista/grid: borde `shared.paperOutlined`,
              4px de padding y botón de 44px, para que se lea como parte de la fila. */}
          <Box
            sx={{
              p: '4px',
              flexShrink: 0,
              display: 'flex',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'shared.paperOutlined',
            }}
          >
            <IconButton
              disableRipple
              aria-label="Información de auditoría del Sistema de Ascenso"
              sx={{
                p: 0,
                width: 44,
                height: 44,
                borderRadius: 'inherit',
                color: 'text.disabled',
                cursor: 'default',
                '& svg': { fontSize: 20 },
              }}
            >
              <Iconify icon="solar:shield-check-bold" />
            </IconButton>
          </Box>
        </Tooltip>
      )}

      {/* 🎯 Filtro Estado */}
      {/* <FormControl sx={{ flexShrink: 0, width: { xs: 1, md: 200 } }}>
        <InputLabel htmlFor="filter-status-select">Estado</InputLabel>
        <Select
          multiple
          label="Estado"
          value={currentFilters.status || []}
          onChange={handleFilterStatus}
          inputProps={{ id: 'filter-status-select' }}
          renderValue={(selected) =>
            selected
              .map((value) => {
                if (value === 'completado') return 'Completado';
                if (value === 'en_progreso') return 'En progreso';
                if (value === 'no_iniciado') return 'No iniciado';
                return value;
              })
              .join(', ')
          }
          MenuProps={{
            slotProps: { paper: { sx: { maxHeight: 250 } } },
          }}
        >
          <MenuItem value="completado">
            <Checkbox checked={(currentFilters.status || []).includes('completado')} />
            Completado
          </MenuItem>

          <MenuItem value="en_progreso">
            <Checkbox checked={(currentFilters.status || []).includes('en_progreso')} />
            En progreso
          </MenuItem>

          <MenuItem value="no_iniciado">
            <Checkbox checked={(currentFilters.status || []).includes('no_iniciado')} />
            No iniciado
          </MenuItem>
        </Select>
      </FormControl> */}

      <Box
        sx={{
          gap: 1,
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {renderFilterDate()}
      </Box>
    </Box>
  );

}
