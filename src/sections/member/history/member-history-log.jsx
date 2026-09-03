'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import { useTheme, useMediaQuery } from '@mui/material';
import TableContainer from '@mui/material/TableContainer';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { listarHistorialMiembroPagina } from 'src/services/member-history-service';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomPopover } from 'src/components/custom-popover';
import { useTable, TableHeadCustom, TablePaginationCustom } from 'src/components/table';

const TABLE_HEAD = [
  { id: 'fecha', label: 'Fecha', width: 120, sx: { pl: 3 } },
  { id: 'afectado', label: 'Qué se afectó', width: 260 },
  { id: 'antes', label: 'Valor anterior', width: 260 },
  { id: 'despues', label: 'Valor nuevo', width: 260 },
  { id: 'realizadoPor', label: 'Quién lo realizó', width: 220 },
];

const LONG_VALUE_LENGTH = 72;

function HistoryValue({ value }) {
  const [expanded, setExpanded] = useState(false);
  const text = value === null || value === undefined || value === '' ? 'Sin dato' : String(value);
  const canExpand = text.length > LONG_VALUE_LENGTH;

  const content = (
    <Typography
      variant="body2"
      component="span"
      sx={{
        display: '-webkit-box',
        maxWidth: 1,
        overflow: expanded ? 'visible' : 'hidden',
        overflowWrap: 'anywhere',
        textAlign: 'left',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: expanded ? 'unset' : 2,
      }}
    >
      {text}
    </Typography>
  );

  if (!canExpand) {
    return content;
  }

  return (
    <Box
      component="button"
      type="button"
      onClick={() => setExpanded((current) => !current)}
      sx={{
        p: 0,
        m: 0,
        width: 1,
        border: 0,
        cursor: 'pointer',
        display: 'block',
        bgcolor: 'transparent',
        font: 'inherit',
        color: 'inherit',
      }}
      aria-expanded={expanded}
      title={expanded ? 'Contraer valor' : 'Ver valor completo'}
    >
      {content}
    </Box>
  );
}

const FILTER_INITIAL_STATE = {
  fecha: '',
  modulo: '',
  afectado: '',
  realizadoPor: '',
};

function getUniqueOptions(logs, key) {
  return [...new Set(logs.map((item) => item[key]).filter(Boolean))];
}

function getChangeSummary(row) {
  const affected = String(row.afectado || 'un dato')
    .trim()
    .toLowerCase();
  const dateTime = [row.fecha, row.hora].filter(Boolean).join(' ');

  return `Se cambió ${affected}${dateTime ? `, en fecha ${dateTime}` : ''} por`;
}

const hasActiveFilters = (filters) => Object.values(filters).some(Boolean);

export function MemberHistoryLog({ memberId, memberName, logs = [], demoLogs = [] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const filtersPopover = usePopover();
  const pageCacheRef = useRef({});
  const [displayMode, setDisplayMode] = useState('panel');
  const [hasManualDisplayMode, setHasManualDisplayMode] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [serverLogs, setServerLogs] = useState([]);
  const [totalRows, setTotalRows] = useState(logs.length);
  const [usingDemoLogs, setUsingDemoLogs] = useState(false);
  const {
    dense,
    page,
    rowsPerPage,
    onResetPage,
    onChangePage,
    onChangeDense,
    onChangeRowsPerPage,
  } = useTable({ defaultRowsPerPage: 5 });
  const [filters, setFilters] = useState(FILTER_INITIAL_STATE);
  const filterIsActive = hasActiveFilters(filters);
  const sourceLogs = useMemo(() => {
    if (logs.length) return logs;
    if (usingDemoLogs) return demoLogs;

    return serverLogs;
  }, [demoLogs, logs, serverLogs, usingDemoLogs]);

  const filterOptions = useMemo(
    () => ({
      fechas: getUniqueOptions(sourceLogs, 'fecha'),
      modulos: getUniqueOptions(sourceLogs, 'modulo'),
      afectados: getUniqueOptions(sourceLogs, 'afectado'),
      responsables: getUniqueOptions(sourceLogs, 'realizadoPor'),
    }),
    [sourceLogs]
  );

  const dataFiltered = useMemo(
    () =>
      sourceLogs.filter(
        (item) =>
          (!filters.fecha || item.fecha === filters.fecha) &&
          (!filters.modulo || item.modulo === filters.modulo) &&
          (!filters.afectado || item.afectado === filters.afectado) &&
          (!filters.realizadoPor || item.realizadoPor === filters.realizadoPor)
      ),
    [filters, sourceLogs]
  );

  const dataInPage = useMemo(
    () =>
      memberId && !logs.length && !usingDemoLogs && !filterIsActive
        ? dataFiltered
        : dataFiltered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [dataFiltered, filterIsActive, logs.length, memberId, page, rowsPerPage, usingDemoLogs]
  );
  const paginationCount =
    memberId && !logs.length && !usingDemoLogs && !filterIsActive ? totalRows : dataFiltered.length;

  const loadVisiblePage = useCallback(
    async (targetPage, targetRowsPerPage) => {
      if (!memberId || logs.length) return;

      setLoadingPage(true);

      try {
        const cacheKey = `${memberId}-${targetRowsPerPage}`;

        if (!pageCacheRef.current[cacheKey]) {
          pageCacheRef.current[cacheKey] = {
            pages: {},
            cursors: { 0: null },
            total: 0,
          };
        }

        const cache = pageCacheRef.current[cacheKey];

        for (let currentPage = 0; currentPage <= targetPage; currentPage += 1) {
          if (cache.pages[currentPage]) continue;

          const result = await listarHistorialMiembroPagina(memberId, {
            maxRegistros: targetRowsPerPage,
            cursor: cache.cursors[currentPage] || null,
          });

          cache.pages[currentPage] = result.registros;
          cache.cursors[currentPage + 1] = result.ultimoDocumento;
          cache.total = result.totalRegistros;
        }

        const nextRows = cache.pages[targetPage] || [];
        const shouldUseDemo = !cache.total && !nextRows.length && demoLogs.length;

        setUsingDemoLogs(shouldUseDemo);
        setServerLogs(shouldUseDemo ? [] : nextRows);
        setTotalRows(shouldUseDemo ? demoLogs.length : cache.total || nextRows.length);
      } catch (error) {
        console.error('[member history] lazy load failed', error);
        setUsingDemoLogs(!!demoLogs.length);
        setServerLogs([]);
        setTotalRows(demoLogs.length);
      } finally {
        setLoadingPage(false);
      }
    },
    [demoLogs, logs.length, memberId]
  );

  useEffect(() => {
    onResetPage();
  }, [filters, memberId, rowsPerPage, onResetPage]);

  useEffect(() => {
    pageCacheRef.current = {};
    setServerLogs([]);
    setTotalRows(logs.length || 0);
    setUsingDemoLogs(false);
  }, [logs.length, memberId]);

  useEffect(() => {
    if (!memberId || logs.length || usingDemoLogs || filterIsActive) return;

    loadVisiblePage(page, rowsPerPage);
  }, [filterIsActive, loadVisiblePage, logs.length, memberId, page, rowsPerPage, usingDemoLogs]);

  useEffect(() => {
    if (!hasManualDisplayMode) {
      setDisplayMode(isMobile ? 'grid' : 'panel');
    }
  }, [hasManualDisplayMode, isMobile]);

  const handleChangeFilter = (name) => (event) => {
    setFilters((current) => ({ ...current, [name]: event.target.value }));
  };

  const handleChangeDisplayMode = (event, newValue) => {
    if (!newValue) return;

    setHasManualDisplayMode(true);
    setDisplayMode(newValue);
  };

  const renderFilterSelect = (name, label, options, sx) => (
    <TextField
      select
      label={label}
      value={filters[name]}
      onChange={handleChangeFilter(name)}
      sx={sx}
    >
      <MenuItem value="">
        {name === 'fecha' ? 'Todas' : name === 'afectado' ? 'Todo' : 'Todos'}
      </MenuItem>
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
    </TextField>
  );

  const renderViewModeToggle = () => (
    <ToggleButtonGroup
      size="small"
      value={displayMode}
      exclusive
      onChange={handleChangeDisplayMode}
      sx={{
        '& .MuiToggleButton-root': {
          minWidth: 44,
          height: 44,
          p: 0,
        },
      }}
    >
      <ToggleButton value="panel">
        <Iconify icon="solar:list-bold" />
      </ToggleButton>

      <ToggleButton value="grid">
        <Iconify icon="mingcute:dot-grid-fill" />
      </ToggleButton>
    </ToggleButtonGroup>
  );

  const filterSx = { flex: '1 1 180px', minWidth: { xs: '100%', sm: 220, lg: 0 } };

  const renderMobileFilters = () => (
    <>
      <Box
        sx={{
          gap: 1,
          p: 3,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {renderFilterSelect('afectado', 'Qué se afectó', filterOptions.afectados, {
          flex: 1,
          minWidth: 0,
        })}

        <Box sx={{ flexShrink: 0 }}>{renderViewModeToggle()}</Box>

        <IconButton onClick={filtersPopover.onOpen} sx={{ flexShrink: 0 }}>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Box>

      <CustomPopover
        open={filtersPopover.open}
        anchorEl={filtersPopover.anchorEl}
        onClose={filtersPopover.onClose}
        slotProps={{
          arrow: { placement: 'right-top' },
          paper: { sx: { width: 280 } },
        }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          {renderFilterSelect('fecha', 'Fecha', filterOptions.fechas)}
          {renderFilterSelect('modulo', 'Módulo', filterOptions.modulos)}
          {renderFilterSelect('realizadoPor', 'Quién lo realizó', filterOptions.responsables)}
        </Stack>
      </CustomPopover>
    </>
  );

  const renderDesktopFilters = () => (
    <Box
      sx={{
        gap: 2,
        p: 3,
        display: 'flex',
        flexWrap: { xs: 'wrap', lg: 'nowrap' },
        alignItems: 'center',
      }}
    >
      {renderFilterSelect('fecha', 'Fecha', filterOptions.fechas, filterSx)}
      {renderFilterSelect('modulo', 'Módulo', filterOptions.modulos, filterSx)}
      {renderFilterSelect('afectado', 'Qué se afectó', filterOptions.afectados, filterSx)}
      {renderFilterSelect('realizadoPor', 'Quién lo realizó', filterOptions.responsables, filterSx)}

      <Box sx={{ flexShrink: 0, ml: { lg: 'auto' } }}>{renderViewModeToggle()}</Box>
    </Box>
  );

  const renderGridView = () => (
    <Box
      sx={{
        gap: 2,
        p: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      }}
    >
      {dataInPage.map((row) => (
        <Box
          key={row.id}
          sx={{
            p: dense ? 2 : 2.5,
            borderRadius: 1,
            border: (cardTheme) => `1px solid ${cardTheme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
          }}
        >
          <Stack spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', textDecoration: 'underline' }}
              >
                {row.modulo || 'Historial'}
              </Typography>
              <Typography variant="subtitle2">
                {getChangeSummary(row)}{' '}
                <Box component="span" sx={{ fontStyle: 'italic' }}>
                  {row.realizadoPor || 'Sistema'}
                </Box>
              </Typography>
            </Stack>

            <Box
              sx={{
                gap: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Valor anterior
                </Typography>
                <HistoryValue value={row.antes} />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Valor nuevo
                </Typography>
                <HistoryValue value={row.despues} />
              </Box>
            </Box>
          </Stack>
        </Box>
      ))}

      {!dataInPage.length && (
        <Box sx={{ py: 6, textAlign: 'center', gridColumn: '1 / -1' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {loadingPage ? 'Cargando historial...' : 'No hay registros con esos filtros.'}
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderListView = () => (
    <TableContainer sx={{ overflowX: 'hidden' }}>
      <Scrollbar slotProps={{ contentWrapperSx: { overflowX: 'hidden !important' } }}>
        <Table size={dense ? 'small' : 'medium'} sx={{ width: 1, tableLayout: 'fixed' }}>
          <TableHeadCustom headCells={TABLE_HEAD} />

          <TableBody>
            {dataInPage.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ pl: 3 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{row.fecha}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {row.hora}
                    </Typography>
                  </Stack>
                </TableCell>

                <TableCell sx={{ maxWidth: 0 }}>
                  <Stack spacing={0.25}>
                    <Typography variant="body2">{row.afectado}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {row.modulo || 'Historial'}
                    </Typography>
                  </Stack>
                </TableCell>

                <TableCell sx={{ maxWidth: 0 }}>
                  <HistoryValue value={row.antes} />
                </TableCell>

                <TableCell sx={{ maxWidth: 0 }}>
                  <HistoryValue value={row.despues} />
                </TableCell>

                <TableCell sx={{ maxWidth: 0 }}>
                  <Typography variant="body2">{row.realizadoPor}</Typography>
                </TableCell>
              </TableRow>
            ))}

            {!dataInPage.length && (
              <TableRow>
                <TableCell colSpan={5} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {loadingPage ? 'Cargando historial...' : 'No hay registros con esos filtros.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Scrollbar>
    </TableContainer>
  );

  return (
    <Card>
      <CardHeader
        title="Historial de cambios"
        subheader={
          memberName
            ? `Cambios recientes registrados para ${memberName}`
            : 'Cambios recientes registrados para este miembro'
        }
        sx={{ pb: 3 }}
      />

      <Divider />

      {isMobile ? renderMobileFilters() : renderDesktopFilters()}

      <Divider />

      <Box sx={{ position: 'relative' }}>
        {displayMode === 'panel' ? renderListView() : renderGridView()}

        <TablePaginationCustom
          page={page}
          count={paginationCount}
          rowsPerPage={rowsPerPage}
          dense={dense}
          onPageChange={onChangePage}
          onChangeDense={onChangeDense}
          rowsPerPageOptions={[5, 10, 25, 50]}
          onRowsPerPageChange={onChangeRowsPerPage}
          sx={{
            '& .MuiFormControlLabel-root': {
              pl: 3,
            },
          }}
        />
      </Box>
    </Card>
  );
}
