'use client';

import { usePopover, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';

import { fDate } from 'src/utils/format-time';
import { normalizeText } from 'src/utils/normalize-text';
import { printTablePdf } from 'src/utils/download-table-pdf';
import { MOTIVOS_SALIDA, etiquetaDeMotivo } from 'src/utils/directiva-historial.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomPopover } from 'src/components/custom-popover';
import { ExportTableButton } from 'src/components/export-table-button';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';
import {
  useTable,
  emptyRows,
  rowInPage,
  getComparator,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { CompactEntityCard } from './compact-entity-card';
import { MotivoSalidaDialog } from './motivo-salida-dialog';
import { CompactEntityListView } from './compact-entity-list-view';
import { CompactEntityCardList } from './compact-entity-card-list';
import { CompactEntityTableCell } from './compact-entity-table-cell';
import { CompactEntityFiltersResult } from './compact-entity-filters-result';

// ----------------------------------------------------------------------
// LA LISTA DE "HISTORIA", LA MISMA EN LOS CUATRO NIVELES.
//
// Destacamento, sección y región tenían un buscador suelto y una tabla sin
// vista compacta ni tarjetas; el Consejo Nacional, otra tabla distinta sin
// buscador ni paginación. Ahora las cuatro pintan esta, con las mismas piezas
// que Destacamentos o Miembros: barra con buscador, filtros (y su hoja en el
// móvil), Lista/Cuadrícula, imprimir y exportar, chips de filtros activos,
// orden por columna, "Vista compacta" y filas por página. `mostrarEntidad`
// añade la columna y el filtro de Estructura (solo la vista global nacional).
// ----------------------------------------------------------------------

const ESTADOS = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'pasado', label: 'Pasado' },
];

const FILTROS_INICIALES = { nombre: '', cargo: [], estado: [], estructura: [], motivo: [] };

// Solo las salidas tienen motivo; el de una vigente no se pinta.
const textoMotivo = (fila) =>
  fila.vigente ? '' : [etiquetaDeMotivo(fila.motivo), fila.motivoNota].filter(Boolean).join(' · ');

// Las fechas llegan como texto ISO o como fecha; para ordenar hace falta un
// número, o "Desde" comparaba cadenas de formatos distintos.
const aMilisegundos = (valor) => {
  const tiempo = valor ? new Date(valor?.toDate?.() ?? valor).getTime() : NaN;

  return Number.isFinite(tiempo) ? tiempo : 0;
};

const opcionesDistintas = (filas, campo) =>
  [...new Set(filas.map((fila) => String(fila[campo] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((valor) => ({ value: valor, label: valor }));

const textoPeriodo = (fila) =>
  fila.vigente ? 'Vigente' : `${fDate(fila.fechaInicio) || '-'} – ${fDate(fila.fechaFin) || '-'}`;

export function LeadershipHistoryList({
  filas = [],
  cargando = false,
  mostrarEntidad = false,
  // Dentro de la tarjeta de otra vista (el Consejo Nacional ya pinta la suya con
  // sus pestañas): no se envuelve en otra, y la cuadrícula va dentro.
  embebido = false,
  // Sin filtro de Estado cuando todas las filas son salidas (la Historia del
  // Consejo Nacional): con una sola opción, "Pasado", no filtraba nada.
  conEstado = true,
  // Con esto, cada salida lleva un lápiz para precisar su motivo (Administrador
  // Global y Oficina Nacional). Recibe { salida, motivo, nota }.
  onCambiarMotivo = null,
  tituloExportacion = 'Historial de la directiva',
}) {
  const [salidaEnEdicion, setSalidaEnEdicion] = useState(null);
  const puedeCambiarMotivo = typeof onCambiarMotivo === 'function';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });

  const table = useTable({ defaultOrderBy: 'desdeOrden', defaultOrder: 'desc' });
  const filters = useSetState(FILTROS_INICIALES);
  const { state: filtrosActuales, setState: cambiarFiltros } = filters;

  const [modoElegido, setModoElegido] = useState(null);
  const displayMode = modoElegido || (isMobile ? 'grid' : 'panel');
  const setDisplayMode = useCallback((modo) => setModoElegido(modo), []);

  // Igual que las demás listas: en el teléfono la tabla arranca compacta.
  useEffect(() => {
    table.setDense(isMobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const cabeceras = useMemo(
    () => [
      { id: 'nombreMiembro', label: 'Miembro' },
      { id: 'cargoNombre', label: 'Posición', width: 240 },
      ...(mostrarEntidad ? [{ id: 'entidadNombre', label: 'Estructura', width: 200 }] : []),
      { id: 'desdeOrden', label: 'Desde', width: 130 },
      { id: 'hastaOrden', label: 'Hasta', width: 130 },
      { id: 'motivoTexto', label: 'Motivo', width: 180 },
      ...(puedeCambiarMotivo ? [{ id: '', width: 56 }] : []),
    ],
    [mostrarEntidad, puedeCambiarMotivo]
  );

  const filasConOrden = useMemo(
    () =>
      filas.map((fila) => ({
        ...fila,
        desdeOrden: aMilisegundos(fila.fechaInicio),
        // Una vigente "termina" en el futuro: al ordenar por Hasta queda con las
        // más recientes, no con las que nunca tuvieron fecha.
        hastaOrden: fila.vigente ? Number.MAX_SAFE_INTEGER : aMilisegundos(fila.fechaFin),
        motivoTexto: textoMotivo(fila),
      })),
    [filas]
  );

  const opciones = useMemo(
    () => ({
      cargo: opcionesDistintas(filasConOrden, 'cargoNombre'),
      estado: ESTADOS,
      estructura: opcionesDistintas(filasConOrden, 'entidadNombre'),
      motivo: MOTIVOS_SALIDA.filter((opcion) =>
        filasConOrden.some(
          (fila) => !fila.vigente && (fila.motivo || 'sin_especificar') === opcion.value
        )
      ),
    }),
    [filasConOrden]
  );

  const dataFiltered = useMemo(() => {
    const clave = normalizeText(filtrosActuales.nombre);
    const comparador = getComparator(table.order, table.orderBy);

    const filtradas = filasConOrden.filter((fila) => {
      if (
        clave &&
        ![
          fila.nombreMiembro,
          fila.codigoMiembro,
          fila.cargoNombre,
          fila.entidadNombre,
          fila.motivoTexto,
        ].some((texto) => normalizeText(texto ?? '').includes(clave))
      ) {
        return false;
      }

      if (filtrosActuales.cargo.length && !filtrosActuales.cargo.includes(fila.cargoNombre)) {
        return false;
      }

      if (
        filtrosActuales.estado.length &&
        !filtrosActuales.estado.includes(fila.vigente ? 'vigente' : 'pasado')
      ) {
        return false;
      }

      if (
        filtrosActuales.estructura.length &&
        !filtrosActuales.estructura.includes(fila.entidadNombre)
      ) {
        return false;
      }

      if (
        filtrosActuales.motivo.length &&
        (fila.vigente || !filtrosActuales.motivo.includes(fila.motivo || 'sin_especificar'))
      ) {
        return false;
      }

      return true;
    });

    // Vigentes siempre primero: ordenar por columna no debe mezclarlos con el
    // resto, o "quién ocupa hoy" se pierde entre el historial.
    return filtradas.sort(
      (a, b) => (a.vigente === b.vigente ? 0 : a.vigente ? -1 : 1) || comparador(a, b)
    );
  }, [filasConOrden, filtrosActuales, table.order, table.orderBy]);

  const hayFiltros =
    !!filtrosActuales.nombre ||
    filtrosActuales.cargo.length > 0 ||
    filtrosActuales.estado.length > 0 ||
    filtrosActuales.estructura.length > 0 ||
    filtrosActuales.motivo.length > 0;

  const columnasExportacion = useMemo(
    () => [
      { label: 'Miembro', value: (fila) => fila.nombreMiembro },
      { label: 'Código', value: (fila) => fila.codigoMiembro },
      { label: 'Posición', value: (fila) => fila.cargoNombre },
      ...(mostrarEntidad ? [{ label: 'Estructura', value: (fila) => fila.entidadNombre }] : []),
      { label: 'Desde', value: (fila) => fDate(fila.fechaInicio) || '' },
      { label: 'Hasta', value: (fila) => (fila.vigente ? 'Vigente' : fDate(fila.fechaFin) || '') },
      { label: 'Motivo', value: (fila) => fila.motivoTexto },
    ],
    [mostrarEntidad]
  );

  const configFiltros = [
    { key: 'cargo', label: 'Posición', options: opciones.cargo },
    ...(conEstado ? [{ key: 'estado', label: 'Estado', options: opciones.estado }] : []),
    ...(mostrarEntidad
      ? [{ key: 'estructura', label: 'Estructura', options: opciones.estructura }]
      : []),
    { key: 'motivo', label: 'Motivo', options: opciones.motivo },
  ];

  const cambiarFiltroMultiple = (clave) => (event) => {
    const valor = event.target.value;

    table.onResetPage();
    cambiarFiltros({ [clave]: typeof valor === 'string' ? valor.split(',') : valor });
  };

  const renderToolbar = () => (
    <HistoryToolbar
      nombre={filtrosActuales.nombre}
      onNombre={(event) => {
        table.onResetPage();
        cambiarFiltros({ nombre: event.target.value });
      }}
      filtros={configFiltros.map((config) => ({
        ...config,
        value: filtrosActuales[config.key],
        onChange: cambiarFiltroMultiple(config.key),
      }))}
      hayFiltros={
        filtrosActuales.cargo.length +
          filtrosActuales.estado.length +
          filtrosActuales.estructura.length +
          filtrosActuales.motivo.length >
        0
      }
      displayMode={displayMode}
      setDisplayMode={setDisplayMode}
      isMobile={isMobile}
      filasExportar={dataFiltered}
      columnasExportacion={columnasExportacion}
      tituloExportacion={tituloExportacion}
    />
  );

  const renderResultadoFiltros = () =>
    hayFiltros && (
      <CompactEntityFiltersResult
        filters={filters}
        totalResults={dataFiltered.length}
        onResetPage={table.onResetPage}
        sx={{ p: 2.5, pt: 0 }}
        configs={[
          { name: 'cargo', label: 'Posición:', options: opciones.cargo },
          ...(conEstado ? [{ name: 'estado', label: 'Estado:', options: opciones.estado }] : []),
          ...(mostrarEntidad
            ? [{ name: 'estructura', label: 'Estructura:', options: opciones.estructura }]
            : []),
          { name: 'motivo', label: 'Motivo:', options: MOTIVOS_SALIDA },
          { name: 'nombre', label: 'Buscar:', resetValue: '' },
        ]}
      />
    );

  const renderTabla = () => (
    <>
      <Scrollbar>
        <Table
          size={table.dense ? 'small' : 'medium'}
          sx={{ minWidth: mostrarEntidad ? 880 : 720 }}
        >
          <TableHeadCustom
            order={table.order}
            orderBy={table.orderBy}
            headCells={cabeceras}
            onSort={table.onSort}
          />

          <CompactEntityListView
            loading={cargando}
            rows={rowInPage(dataFiltered, table.page, table.rowsPerPage)}
            renderRow={(fila) => (
              <TableRow hover key={fila.id}>
                <CompactEntityTableCell
                  title={fila.nombreMiembro || 'Miembro'}
                  href={fila.idMiembro ? paths.dashboard.level.member.edit(fila.idMiembro) : ''}
                  subtitle={fila.codigoMiembro}
                  avatarUrl={fila.fotoMiembro}
                />

                <TableCell>{fila.cargoNombre || 'Cargo'}</TableCell>

                {mostrarEntidad && <TableCell>{fila.entidadNombre || '-'}</TableCell>}

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {fDate(fila.fechaInicio) || '-'}
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {fila.vigente ? (
                    <Label color="success">Vigente</Label>
                  ) : (
                    fDate(fila.fechaFin) || '-'
                  )}
                </TableCell>

                <TableCell>
                  {!fila.vigente && (
                    <>
                      <Label
                        color={
                          fila.motivo && fila.motivo !== 'sin_especificar' ? 'info' : 'default'
                        }
                      >
                        {etiquetaDeMotivo(fila.motivo)}
                      </Label>
                      {fila.motivoNota && (
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
                        >
                          {fila.motivoNota}
                        </Typography>
                      )}
                    </>
                  )}
                </TableCell>

                {puedeCambiarMotivo && (
                  <TableCell align="right">
                    {!fila.vigente && (
                      <Tooltip title="Motivo de salida">
                        <IconButton onClick={() => setSalidaEnEdicion(fila)}>
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
              </TableRow>
            )}
            notFound={!cargando && !dataFiltered.length}
            skeletonRows={table.rowsPerPage}
            skeletonCellCount={cabeceras.length}
            emptyRowsHeight={table.dense ? 56 : 56 + 20}
            emptyRowsCount={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)}
          />
        </Table>
      </Scrollbar>

      <TablePaginationCustom
        page={table.page}
        dense={table.dense}
        count={dataFiltered.length}
        rowsPerPage={table.rowsPerPage}
        onPageChange={table.onChangePage}
        onChangeDense={table.onChangeDense}
        onRowsPerPageChange={table.onChangeRowsPerPage}
      />
    </>
  );

  const renderTarjetas = () =>
    !cargando && !dataFiltered.length ? (
      <Typography variant="body2" sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
        {hayFiltros
          ? 'Nadie coincide con la búsqueda.'
          : 'Todavía no hay historial: cuando alguien deje un cargo, va a aparecer acá.'}
      </Typography>
    ) : (
      <CompactEntityCardList
        items={dataFiltered}
        loading={cargando}
        renderCard={(fila) => (
          <CompactEntityCard
            key={fila.id}
            title={fila.nombreMiembro || 'Miembro'}
            href={fila.idMiembro ? paths.dashboard.level.member.edit(fila.idMiembro) : '#'}
            avatarUrl={fila.fotoMiembro}
            lines={[
              { icon: 'solar:case-minimalistic-bold', text: fila.cargoNombre || 'Cargo' },
              ...(mostrarEntidad && fila.entidadNombre
                ? [{ icon: 'solar:flag-bold', text: fila.entidadNombre }]
                : []),
              { icon: 'solar:calendar-date-bold', text: textoPeriodo(fila) },
              ...(fila.motivoTexto
                ? [{ icon: 'solar:notes-bold-duotone', text: fila.motivoTexto, wrap: true }]
                : []),
            ]}
            {...(puedeCambiarMotivo &&
              !fila.vigente && {
                onClick: () => setSalidaEnEdicion(fila),
                sx: { cursor: 'pointer' },
              })}
          />
        )}
      />
    );

  const renderDialogoMotivo = () =>
    puedeCambiarMotivo && (
      <MotivoSalidaDialog
        salida={salidaEnEdicion}
        onClose={() => setSalidaEnEdicion(null)}
        onGuardar={(cambio) => {
          // Responde al pulsar: se cierra ya y la escritura va por detrás.
          setSalidaEnEdicion(null);
          onCambiarMotivo(cambio);
        }}
      />
    );

  if (embebido) {
    return (
      <>
        {renderDialogoMotivo()}
        {renderToolbar()}
        {renderResultadoFiltros()}
        {displayMode === 'panel' ? (
          renderTabla()
        ) : (
          <Box sx={{ px: 2.5, pb: 2.5 }}>{renderTarjetas()}</Box>
        )}
      </>
    );
  }

  return (
    <>
      {renderDialogoMotivo()}
      <Card>
        {renderToolbar()}
        {renderResultadoFiltros()}
        {displayMode === 'panel' && renderTabla()}
      </Card>

      {displayMode !== 'panel' && renderTarjetas()}
    </>
  );
}

// ----------------------------------------------------------------------

function HistoryToolbar({
  nombre,
  onNombre,
  filtros,
  hayFiltros,
  displayMode,
  setDisplayMode,
  isMobile,
  filasExportar,
  columnasExportacion,
  tituloExportacion,
}) {
  const menu = usePopover();

  const buscador = (
    <TextField
      fullWidth
      value={nombre}
      onChange={onNombre}
      placeholder="Buscar por nombre, código o posición..."
      sx={{ flex: 1, minWidth: 0 }}
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
  );

  const elegirModo = (modo) => {
    setDisplayMode(modo);
    menu.onClose();
  };

  const imprimir = async () => {
    await printTablePdf({
      title: tituloExportacion,
      rows: filasExportar,
      columns: columnasExportacion,
    });
    menu.onClose();
  };

  return (
    <>
      <Box
        sx={{
          p: 2.5,
          gap: { xs: 1, md: 2 },
          display: 'flex',
          pr: { xs: 2.5, md: 1 },
          alignItems: 'center',
        }}
      >
        {buscador}

        {!isMobile &&
          filtros.map((filtro) => (
            <FormControl key={filtro.key} sx={{ flexShrink: 0, width: 200 }}>
              <InputLabel htmlFor={`historia-${filtro.key}-select`}>{filtro.label}</InputLabel>
              <Select
                multiple
                label={filtro.label}
                value={filtro.value}
                onChange={filtro.onChange}
                renderValue={(seleccion) =>
                  seleccion
                    .map(
                      (valor) =>
                        filtro.options.find((opcion) => opcion.value === valor)?.label ?? valor
                    )
                    .join(', ')
                }
                inputProps={{ id: `historia-${filtro.key}-select` }}
                MenuProps={{ slotProps: { paper: { sx: { maxHeight: 250 } } } }}
              >
                {filtro.options.map((opcion) => (
                  <MenuItem key={opcion.value} value={opcion.value}>
                    <Checkbox size="small" checked={filtro.value.includes(opcion.value)} />
                    {opcion.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

        {isMobile && (
          <TableToolbarMobileFilter hasActiveFilters={hayFiltros} filtersConfig={filtros} />
        )}

        {!isMobile && (
          <ViewModeToggle
            value={displayMode}
            onChange={setDisplayMode}
            storageKey="global-display-mode"
          />
        )}

        <IconButton onClick={menu.onOpen}>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Box>

      <CustomPopover
        open={menu.open}
        anchorEl={menu.anchorEl}
        onClose={menu.onClose}
        slotProps={{ arrow: { placement: 'right-top' } }}
      >
        <MenuList>
          {isMobile && [
            <MenuItem
              key="panel"
              selected={displayMode === 'panel'}
              onClick={() => elegirModo('panel')}
            >
              <Iconify icon="solar:list-bold" />
              Panel
            </MenuItem>,
            <MenuItem
              key="grid"
              selected={displayMode === 'grid'}
              onClick={() => elegirModo('grid')}
            >
              <Iconify icon="mingcute:dot-grid-fill" />
              Grid
            </MenuItem>,
          ]}

          <MenuItem onClick={imprimir}>
            <Iconify icon="solar:printer-minimalistic-bold" />
            Imprimir
          </MenuItem>

          <ExportTableButton
            rows={filasExportar}
            columns={columnasExportacion}
            title={tituloExportacion}
            fileNamePrefix="historial-directiva"
            trigger="menuItem"
          />
        </MenuList>
      </CustomPopover>
    </>
  );
}
