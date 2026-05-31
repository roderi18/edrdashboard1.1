'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { fDate, fTime, fIsAfter, fDateTime, fIsBetween } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { listarAuditoriaSistema } from 'src/services/audit-log-service';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { EmptyContent } from 'src/components/empty-content';
import { ExportTableButton } from 'src/components/export-table-button';
import { useTable, TableHeadCustom, TablePaginationCustom } from 'src/components/table';

// ----------------------------------------------------------------------

const RESULTADO_COLORS = {
  exitoso: 'success',
  error: 'error',
  advertencia: 'warning',
};

const SEVERIDAD_COLORS = {
  informativa: 'info',
  importante: 'warning',
  critica: 'error',
};

const TABLE_HEAD = [
  { id: 'fecha', label: 'Fecha', sx: { minWidth: 160 } },
  { id: 'modulo', label: 'Módulo' },
  { id: 'accion', label: 'Acción', sx: { minWidth: 180 } },
  { id: 'entidad', label: 'Entidad', sx: { minWidth: 150 } },
  { id: 'realizadoPor', label: 'Realizado por', sx: { minWidth: 160 } },
  { id: 'resultado', label: 'Resultado' },
  { id: '', label: 'Detalle', align: 'right' },
];

const EXPORT_COLUMNS = [
  { label: 'Fecha', value: (row) => fDateTime(row.fecha) },
  { label: 'Módulo', value: (row) => toReadableName(row.modulo) },
  { label: 'Acción', value: (row) => toReadableName(row.accion) },
  { label: 'Descripción', value: (row) => row.descripcion || '' },
  { label: 'Entidad', value: (row) => getEntityName(row) },
  { label: 'Realizado por', value: (row) => getActorName(row) },
  { label: 'Resultado', value: (row) => toReadableName(row.resultado) },
  { label: 'Severidad', value: (row) => toReadableName(row.severidad) },
  { label: 'Origen', value: (row) => row.origen || '' },
  { label: 'Antes', value: (row) => stringifyDetail(row.antes) },
  { label: 'Después', value: (row) => stringifyDetail(row.despues) },
  { label: 'Metadatos', value: (row) => stringifyDetail(row.metadatos) },
];

const PDF_COLUMNS = EXPORT_COLUMNS.slice(0, 8);

function LogsTableSkeleton() {
  return (
    <Stack spacing={1.5} sx={{ p: 3 }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <Stack
          key={index}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ minHeight: 48 }}
        >
          <Skeleton variant="text" width={110} />
          <Skeleton variant="text" width="18%" />
          <Skeleton variant="text" width="24%" />
          <Skeleton variant="text" width="16%" />
          <Skeleton variant="rounded" width={84} height={24} />
          <Skeleton variant="circular" width={32} height={32} />
        </Stack>
      ))}
    </Stack>
  );
}

const toReadableName = (value = '') => {
  const text = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Sin definir';
};

const normalizeSearch = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const stringifyDetail = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Sin datos';
  }

  return JSON.stringify(value, null, 2);
};

const getActorName = (registro = {}) =>
  registro.realizadoPor?.nombre ||
  registro.realizadoPor?.correo ||
  registro.realizadoPor?.idUsuario ||
  'Sistema';

const getEntityName = (registro = {}) =>
  registro.entidad?.nombre || registro.entidad?.id || toReadableName(registro.entidad?.tipo);

const getSortValue = (registro = {}, orderBy = '') => {
  if (orderBy === 'fecha') return new Date(registro.fecha || 0).getTime();
  if (orderBy === 'entidad') return getEntityName(registro);
  if (orderBy === 'realizadoPor') return getActorName(registro);

  return registro[orderBy] || '';
};

const sortLogs = (inputData = [], order = 'desc', orderBy = 'fecha') =>
  [...inputData].sort((a, b) => {
    const aValue = getSortValue(a, orderBy);
    const bValue = getSortValue(b, orderBy);

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'desc' ? bValue - aValue : aValue - bValue;
    }

    return order === 'desc'
      ? String(bValue).localeCompare(String(aValue))
      : String(aValue).localeCompare(String(bValue));
  });

export function LogsFileManagerView({ embedded = false }) {
  const table = useTable({ defaultRowsPerPage: 10, defaultOrderBy: 'fecha', defaultOrder: 'desc' });
  const { onResetPage } = table;
  const filtersMenu = usePopover();
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState([]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('todos');
  const [resultFilter, setResultFilter] = useState('todos');
  const [severityFilter, setSeverityFilter] = useState('todos');
  const [originFilter, setOriginFilter] = useState('todos');
  const [actorFilter, setActorFilter] = useState('todos');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);

    try {
      const data = await listarAuditoriaSistema({ maxRegistros: 200 });
      setRegistros(data);
    } catch (error) {
      console.error(error);
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    onResetPage();
  }, [
    actorFilter,
    endDate,
    moduleFilter,
    onResetPage,
    originFilter,
    resultFilter,
    search,
    severityFilter,
    startDate,
  ]);

  const modules = useMemo(
    () =>
      Array.from(new Set(registros.map((registro) => registro.modulo).filter(Boolean))).sort(
        (a, b) => String(a).localeCompare(String(b))
      ),
    [registros]
  );

  const actors = useMemo(
    () =>
      Array.from(
        new Set(registros.map((registro) => getActorName(registro)).filter(Boolean))
      ).sort((a, b) => String(a).localeCompare(String(b))),
    [registros]
  );

  const origins = useMemo(
    () =>
      Array.from(new Set(registros.map((registro) => registro.origen).filter(Boolean))).sort(
        (a, b) => String(a).localeCompare(String(b))
      ),
    [registros]
  );

  const dateError = fIsAfter(startDate, endDate);

  const filteredLogs = useMemo(() => {
    const currentSearch = normalizeSearch(search);

    return registros.filter((registro) => {
      const matchesModule = moduleFilter === 'todos' || registro.modulo === moduleFilter;
      const matchesResult = resultFilter === 'todos' || registro.resultado === resultFilter;
      const matchesSeverity = severityFilter === 'todos' || registro.severidad === severityFilter;
      const matchesOrigin = originFilter === 'todos' || registro.origen === originFilter;
      const matchesActor = actorFilter === 'todos' || getActorName(registro) === actorFilter;
      const matchesDate =
        dateError || !startDate || !endDate || fIsBetween(registro.fecha, startDate, endDate);

      if (
        !matchesModule ||
        !matchesResult ||
        !matchesSeverity ||
        !matchesOrigin ||
        !matchesActor ||
        !matchesDate
      ) {
        return false;
      }

      if (!currentSearch) {
        return true;
      }

      const haystack = normalizeSearch(
        [
          registro.modulo,
          registro.accion,
          registro.descripcion,
          registro.resultado,
          registro.severidad,
          getActorName(registro),
          getEntityName(registro),
        ].join(' ')
      );

      return haystack.includes(currentSearch);
    });
  }, [
    actorFilter,
    dateError,
    endDate,
    moduleFilter,
    originFilter,
    registros,
    resultFilter,
    search,
    severityFilter,
    startDate,
  ]);

  const resumen = useMemo(() => {
    const usuarios = new Set(
      registros.map((registro) => registro.realizadoPor?.idUsuario || getActorName(registro))
    );

    return {
      total: registros.length,
      importantes: registros.filter((registro) =>
        ['importante', 'critica'].includes(registro.severidad)
      ).length,
      usuarios: usuarios.size,
      modulos: modules.length,
    };
  }, [modules.length, registros]);

  const sortedLogs = useMemo(
    () => sortLogs(filteredLogs, table.order, table.orderBy),
    [filteredLogs, table.order, table.orderBy]
  );

  const paginatedLogs = useMemo(
    () =>
      sortedLogs.slice(
        table.page * table.rowsPerPage,
        table.page * table.rowsPerPage + table.rowsPerPage
      ),
    [sortedLogs, table.page, table.rowsPerPage]
  );

  const content = (
    <Stack spacing={3}>
      {!embedded && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4">Historial - Logs</Typography>
        </Box>
      )}

      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard label="Registros" value={resumen.total} />
        <SummaryCard label="Importantes" value={resumen.importantes} />
        <SummaryCard label="Usuarios" value={resumen.usuarios} />
        <SummaryCard label="Módulos" value={resumen.modulos} />
      </Box>

      <Card>
        <Box
          sx={{
            gap: 2,
            p: 2.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr) auto',
              md: 'repeat(12, minmax(0, 1fr))',
            },
          }}
        >
          <TextField
            size="small"
            value={search}
            placeholder="Buscar por acción, usuario, entidad o detalle"
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 0, gridColumn: { md: 'span 4' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <IconButton
            onClick={filtersMenu.onOpen}
            sx={{
              p: 0.5,
              m: 0,
              flexShrink: 0,
              minWidth: 'auto',
              border: 'none',
              borderRadius: 0,
              backgroundColor: 'transparent',
              display: { xs: 'inline-flex', md: 'none' },
              justifySelf: 'end',
              alignSelf: 'center',
              '&:hover': { backgroundColor: 'transparent' },
            }}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>

          <Box
            sx={{
              gap: 2,
              display: 'grid',
              gridColumn: { xs: '1 / -1', md: 'span 4' },
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(2, minmax(0, 1fr))',
              },
              minWidth: 0,
            }}
          >
            <DatePicker
              label="Desde"
              value={startDate}
              onChange={setStartDate}
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
            />

          <DatePicker
            label="Hasta"
            value={endDate}
            onChange={setEndDate}
            slotProps={{
              textField: {
                size: 'small',
                error: dateError,
                helperText: dateError ? 'Fecha inválida' : '',
              },
            }}
          />
          </Box>

          <TextField
            select
            size="small"
            label="Módulo"
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0, gridColumn: { md: 'span 2' } }}
          >
            <MenuItem value="todos">Todos</MenuItem>
            {modules.map((modulo) => (
              <MenuItem key={modulo} value={modulo}>
                {toReadableName(modulo)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Resultado"
            value={resultFilter}
            onChange={(event) => setResultFilter(event.target.value)}
            sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0, gridColumn: { md: 'span 2' } }}
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="exitoso">Exitoso</MenuItem>
            <MenuItem value="advertencia">Advertencia</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Severidad"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0, gridColumn: { md: 'span 2' } }}
          >
            <MenuItem value="todos">Todas</MenuItem>
            <MenuItem value="informativa">Informativa</MenuItem>
            <MenuItem value="importante">Importante</MenuItem>
            <MenuItem value="critica">Crítica</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Actor"
            value={actorFilter}
            onChange={(event) => setActorFilter(event.target.value)}
            sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0, gridColumn: { md: 'span 2' } }}
          >
            <MenuItem value="todos">Todos</MenuItem>
            {actors.map((actor) => (
              <MenuItem key={actor} value={actor}>
                {actor}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Origen"
            value={originFilter}
            onChange={(event) => setOriginFilter(event.target.value)}
            sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0, gridColumn: { md: 'span 2' } }}
          >
            <MenuItem value="todos">Todos</MenuItem>
            {origins.map((origin) => (
              <MenuItem key={origin} value={origin}>
                {toReadableName(origin)}
              </MenuItem>
            ))}
          </TextField>

          <Box
            sx={{
              gap: 2,
              display: 'grid',
              gridColumn: { xs: '1 / -1', md: 'span 6' },
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(2, minmax(0, 1fr))' },
              justifyContent: { md: 'stretch' },
            }}
          >
            <Button
              color="inherit"
              variant="outlined"
              startIcon={<Iconify icon="solar:refresh-bold" />}
              onClick={loadLogs}
              sx={{ minHeight: 40, whiteSpace: 'nowrap', width: '100%' }}
            >
              Actualizar
            </Button>

          <ExportTableButton
            rows={sortedLogs}
            columns={EXPORT_COLUMNS}
            pdfColumns={PDF_COLUMNS}
            title="Logs de auditoría"
            fileNamePrefix="logs-auditoria"
            disabled={loading}
            buttonProps={{ sx: { minHeight: 40, whiteSpace: 'nowrap', width: '100%' } }}
          />
        </Box>
        </Box>

        <CustomPopover
          open={filtersMenu.open}
          anchorEl={filtersMenu.anchorEl}
          onClose={filtersMenu.onClose}
          slotProps={{
            arrow: { placement: 'right-top' },
            paper: { sx: { width: 280, display: { xs: 'block', md: 'none' } } },
          }}
        >
          <Stack spacing={2} sx={{ p: 2 }}>
            <TextField
              select
              size="small"
              label="Modulo"
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              {modules.map((modulo) => (
                <MenuItem key={modulo} value={modulo}>
                  {toReadableName(modulo)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Resultado"
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="exitoso">Exitoso</MenuItem>
              <MenuItem value="advertencia">Advertencia</MenuItem>
              <MenuItem value="error">Error</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Severidad"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              <MenuItem value="todos">Todas</MenuItem>
              <MenuItem value="informativa">Informativa</MenuItem>
              <MenuItem value="importante">Importante</MenuItem>
              <MenuItem value="critica">Critica</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Actor"
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              {actors.map((actor) => (
                <MenuItem key={actor} value={actor}>
                  {actor}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Origen"
              value={originFilter}
              onChange={(event) => setOriginFilter(event.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              {origins.map((origin) => (
                <MenuItem key={origin} value={origin}>
                  {toReadableName(origin)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CustomPopover>

        {loading ? (
          <LogsTableSkeleton />
        ) : filteredLogs.length ? (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)', minHeight: 420 }}>
            <Table stickyHeader size={table.dense ? 'small' : 'medium'}>
              <TableHeadCustom
                order={table.order}
                orderBy={table.orderBy}
                headCells={TABLE_HEAD}
                onSort={table.onSort}
              />

              <TableBody>
                {paginatedLogs.map((registro) => (
                  <TableRow hover key={registro.id}>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Typography variant="body2">{fDate(registro.fecha)}</Typography>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                        {fTime(registro.fecha)}
                      </Typography>
                    </TableCell>
                    <TableCell>{toReadableName(registro.modulo)}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography variant="subtitle2">{toReadableName(registro.accion)}</Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {registro.descripcion || 'Sin descripción'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Typography variant="body2">{getEntityName(registro)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {toReadableName(registro.entidad?.tipo)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Typography variant="body2">{getActorName(registro)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {registro.realizadoPor?.correo || registro.realizadoPor?.rol || ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.75} alignItems="flex-start">
                        <Label color={RESULTADO_COLORS[registro.resultado] || 'default'}>
                          {toReadableName(registro.resultado)}
                        </Label>
                        <Label color={SEVERIDAD_COLORS[registro.severidad] || 'default'}>
                          {toReadableName(registro.severidad)}
                        </Label>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setSelectedLog(registro)}>
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyContent
            filled
            title="Sin registros"
            description="No hay logs con los filtros actuales."
            sx={{ py: 10 }}
          />
        )}

        <TablePaginationCustom
          page={table.page}
          dense={table.dense}
          count={filteredLogs.length}
          rowsPerPage={table.rowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          onPageChange={table.onChangePage}
          onChangeDense={table.onChangeDense}
          onRowsPerPageChange={table.onChangeRowsPerPage}
        />
      </Card>

      <Dialog
        fullWidth
        maxWidth="md"
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      >
        <DialogTitle sx={{ pr: 6 }}>
          Detalle del registro
          <IconButton
            aria-label="Cerrar"
            onClick={() => setSelectedLog(null)}
            sx={{ position: 'absolute', top: 12, right: 12 }}
          >
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Stack spacing={2.5} sx={{ pb: 2 }}>
              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                }}
              >
                <DetailItem label="Módulo" value={toReadableName(selectedLog.modulo)} />
                <DetailItem label="Acción" value={toReadableName(selectedLog.accion)} />
                <DetailItem label="Fecha" value={fDateTime(selectedLog.fecha)} />
                <DetailItem label="Realizado por" value={getActorName(selectedLog)} />
                <DetailItem label="Entidad" value={getEntityName(selectedLog)} />
                <DetailItem label="Resultado" value={toReadableName(selectedLog.resultado)} />
              </Box>

              <DetailItem label="Descripción" value={selectedLog.descripcion || 'Sin descripción'} />

              <LogJson title="Antes" value={selectedLog.antes} />
              <LogJson title="Después" value={selectedLog.despues} />
              <LogJson title="Metadatos" value={selectedLog.metadatos} />
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );

  return embedded ? content : <DashboardContent>{content}</DashboardContent>;
}

function SummaryCard({ label, value }) {
  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="h4">{value}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Card>
  );
}

function DetailItem({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

function LogJson({ title, value }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          borderRadius: 1,
          maxHeight: 220,
          overflow: 'auto',
          typography: 'caption',
          whiteSpace: 'pre-wrap',
          bgcolor: 'background.neutral',
        }}
      >
        {stringifyDetail(value)}
      </Box>
    </Box>
  );
}
