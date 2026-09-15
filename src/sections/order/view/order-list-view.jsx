'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBoolean, useSetState } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableBody from '@mui/material/TableBody';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { useSearchParams } from 'src/routes/hooks';

import { fDopCurrency } from 'src/utils/format-number';
import { fIsAfter, fDateTime, fIsBetween } from 'src/utils/format-time';
import {
  isMemberSessionUser,
  atiendeSolicitudesDeTienda,
  filterOrdersByMemberSession,
} from 'src/utils/member-access';

import { _orders } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { listarOrdenesFirestore } from 'src/services/order-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { ExportTableButton } from 'src/components/export-table-button';
import { ANCHO_DEL_MARCO } from 'src/components/commerce/commerce-layout';
import { CommerceListSkeleton } from 'src/components/commerce/commerce-list-skeleton';
import {
  useTable,
  rowInPage,
  TableNoData,
  getComparator,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { OrderTableRow } from '../order-table-row';
import { StoreHeader } from '../../product/store-header';
import { metodoDePago, OrderListFilters } from '../order-list-filters';
import { OrderTableFiltersResult } from '../order-table-filters-result';
import { OrderStatusNav, contarPorEstado, ESTADOS_DE_ORDEN } from '../order-status-nav';

// ----------------------------------------------------------------------

// LO QUE SE MIRA DE UN PEDIDO, EN ESTE ORDEN: cual es, que lleva, cuando se
// hizo, cuanto costo y como va. La columna de "Miembro" se fue: en `/order` cada
// quien ve los suyos, y el nombre repetido en las cuarenta y seis filas no
// distinguia una de otra. Sigue estando en la ficha del pedido.
const TABLE_HEAD = [
  { id: 'orderNumber', label: 'Pedido', width: 140 },
  { id: 'items', label: 'Productos', width: 200 },
  { id: 'createdAt', label: 'Fecha', width: 160 },
  { id: 'totalAmount', label: 'Total', width: 180 },
  { id: 'status', label: 'Estado', width: 140 },
  { id: '', label: 'Acciones', width: 180 },
];

const COLUMNAS_DESCARGA = [
  { label: 'Pedido', value: (row) => row.orderNumber || row.id },
  { label: 'Fecha', value: (row) => fDateTime(row.createdAt) },
  { label: 'Artículos', value: (row) => (row.items || []).length },
  { label: 'Total', value: (row) => fDopCurrency(row.totalAmount ?? row.subtotal) },
  // Igual que en la columna: una solicitud no tiene forma de pago.
  {
    label: 'Método de pago',
    value: (row) => (row.esSolicitud ? '' : metodoDePago(row.payment).label),
  },
  {
    label: 'Estado',
    value: (row) => ESTADOS_DE_ORDEN.find((estado) => estado.value === row.status)?.label || '',
  },
  { label: 'Productos', value: (row) => (row.items || []).map((item) => item.name).join(', ') },
];

// ----------------------------------------------------------------------

export function OrderListView() {
  const table = useTable({ defaultOrderBy: 'orderNumber' });
  const { onResetPage } = table;
  const { user } = useAuthContext();
  const atiendeSolicitudes = atiendeSolicitudesDeTienda(user);
  const searchParams = useSearchParams();
  const canDelete = !isMemberSessionUser(user);
  const orderNumberParam = searchParams.get('orderNumber') || '';

  const confirmDialog = useBoolean();

  const [avisoDeDescarga, setAvisoDeDescarga] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const firestoreOrders = await listarOrdenesFirestore();
        const firestoreIds = new Set(firestoreOrders.map((order) => order.id));

        setTableData([
          ...firestoreOrders,
          ..._orders.filter((order) => !firestoreIds.has(order.id)),
        ]);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrders();
  }, []);

  const filters = useSetState({
    name: '',
    status: 'all',
    payment: 'all',
    orden: 'recientes',
    startDate: null,
    endDate: null,
  });
  const { state: currentFilters, setState: updateFilters } = filters;

  useEffect(() => {
    if (!orderNumberParam) return;

    onResetPage();
    updateFilters({ name: orderNumberParam });
  }, [orderNumberParam, onResetPage, updateFilters]);

  const dateError = fIsAfter(currentFilters.startDate, currentFilters.endDate);
  const visibleTableData = filterOrdersByMemberSession(tableData, user);

  const dataFiltered = applyFilter({
    inputData: visibleTableData,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
    dateError,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name ||
    currentFilters.status !== 'all' ||
    currentFilters.payment !== 'all' ||
    (!!currentFilters.startDate && !!currentFilters.endDate);

  const cuentasPorEstado = contarPorEstado(visibleTableData);

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const handleDeleteRow = useCallback(
    (id) => {
      const deleteRow = tableData.filter((row) => row.id !== id);

      toast.success('Eliminacion exitosa');

      setTableData(deleteRow);

      table.onUpdatePageDeleteRow(dataInPage.length);
    },
    [dataInPage.length, table, tableData]
  );

  const handleDeleteRows = useCallback(() => {
    const deleteRows = tableData.filter((row) => !table.selected.includes(row.id));

    toast.success('Eliminacion exitosa');

    setTableData(deleteRows);

    table.onUpdatePageDeleteRows(dataInPage.length, dataFiltered.length);
  }, [dataFiltered.length, dataInPage.length, table, tableData]);

  const handleFilterStatus = useCallback(
    (nuevoEstado) => {
      table.onResetPage();
      updateFilters({ status: nuevoEstado });
    },
    [updateFilters, table]
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content={
        <>
          Seguro que deseas eliminar <strong> {table.selected.length} </strong> pedidos?
        </>
      }
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            handleDeleteRows();
            confirmDialog.onFalse();
          }}
        >
          Eliminar
        </Button>
      }
    />
  );

  return (
    <>
      {/* ANCHO FIJO, NO FLUIDO. Asi es como el zoom aleja de verdad.
          
          Sin tope, alejar el zoom no alejaba la pagina: la ensanchaba. El
          contenedor crecia hasta el nuevo ancho de la ventana y la tabla se
          estiraba —columnas separandose, filas cada vez mas vacias—, asi que se
          veia MAS ancho, no mas pequeño.
          
          OJO: `maxWidth` de `DashboardContent` SOLO se aplica con el "diseño
          compacto" encendido en Ajustes; con el apagado pasa `false` y el
          contenedor va a todo el ancho. Por eso el tope se pone aqui, en `sx`,
          donde no depende de un ajuste que cada quien tiene como quiere.
          
          1600 es el ancho que tenia esta lista en una pantalla normal: se
          conserva tal cual, y ahora el zoom hace lo suyo. */}
      <DashboardContent maxWidth={false} sx={{ maxWidth: ANCHO_DEL_MARCO, mx: 'auto' }}>
        <StoreHeader sx={{ mb: 3 }} />

        {/* SIN BOTON DE "FILTROS". Escondia detras de un clic lo que se usa
            nada mas entrar, y ademas obligaba a recordar si estaba abierto o
            cerrado para saber por que la lista enseñaba lo que enseñaba. */}
        <Card sx={{ p: 2, mb: 2 }}>
          <OrderListFilters
            filters={filters}
            atiendeSolicitudes={atiendeSolicitudes}
            onResetPage={table.onResetPage}
            dateError={dateError}
            acciones={
              /* EL AVISO SE VA AL ABRIR EL MENU. Sin controlarlo, el globo se
                 queda flotando ENCIMA de las opciones —tapando "Excel"— hasta
                 que el raton sale del boton: el menu se abre debajo del
                 puntero, asi que el raton nunca sale solo. */
              <Tooltip
                title="Descargar la lista"
                open={avisoDeDescarga}
                onOpen={() => setAvisoDeDescarga(true)}
                onClose={() => setAvisoDeDescarga(false)}
              >
                <Box component="span" onClick={() => setAvisoDeDescarga(false)}>
                  <ExportTableButton
                    rows={dataFiltered}
                    columns={COLUMNAS_DESCARGA}
                    pdfColumns={COLUMNAS_DESCARGA.slice(0, 6)}
                    title="Lista de pedidos"
                    fileNamePrefix="lista-pedidos"
                    buttonLabel=""
                    buttonProps={{
                      endIcon: null,
                      'aria-label': 'Descargar la lista',
                      sx: {
                        px: 1.5,
                        height: 40,
                        minWidth: 0,
                        // El icono va SOLO: sin quitarle el margen que lleva
                        // para separarse del texto, queda escorado a la
                        // izquierda dentro de un boton que ya no tiene texto.
                        '& .MuiButton-startIcon': { m: 0 },
                      },
                    }}
                  />
                </Box>
              </Tooltip>
            }
          />

          {canReset && (
            <OrderTableFiltersResult
              filters={filters}
              totalResults={dataFiltered.length}
              onResetPage={table.onResetPage}
              sx={{ pt: 2 }}
            />
          )}
        </Card>

        {loadingOrders ? (
          <CommerceListSkeleton rowCount={6} cellCount={7} />
        ) : (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
            {/* LA COLUMNA DE ESTADOS, SOLO EN PANTALLA ANCHA. En tableta y movil
                se come el sitio de la tabla y ademas repite lo que ya dicen las
                pastillas de arriba. */}
            <OrderStatusNav
              valor={currentFilters.status}
              cuentas={cuentasPorEstado}
              onCambiar={handleFilterStatus}
              atiendeSolicitudes={atiendeSolicitudes}
              onContactar={() => toast.info('Escríbenos desde el chat del panel.')}
              // `flex` Y NO `block`: la columna es un `Stack`, que reparte el
              // aire entre sus tarjetas con `gap` de flex. Con `display: block`
              // ese `gap` deja de existir y las dos tarjetas salen pegadas por
              // mucho `spacing` que se les ponga —que es justo lo que pasaba—.
              sx={{ width: 260, flexShrink: 0, display: { xs: 'none', lg: 'flex' } }}
            />

            <Card sx={{ flexGrow: 1, minWidth: 0, width: 1 }}>
              <Box sx={{ position: 'relative' }}>
                <TableSelectedAction
                  dense={table.dense}
                  numSelected={table.selected.length}
                  rowCount={dataFiltered.length}
                  onSelectAllRows={(checked) =>
                    table.onSelectAllRows(
                      checked,
                      dataFiltered.map((row) => row.id)
                    )
                  }
                  action={
                    canDelete ? (
                      <Tooltip title="Eliminar">
                        <IconButton color="primary" onClick={confirmDialog.onTrue}>
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      </Tooltip>
                    ) : null
                  }
                />

                <Scrollbar>
                  <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                    <TableHeadCustom
                      order={table.order}
                      orderBy={table.orderBy}
                      headCells={TABLE_HEAD}
                      rowCount={dataFiltered.length}
                      numSelected={table.selected.length}
                      onSort={table.onSort}
                      onSelectAllRows={(checked) =>
                        table.onSelectAllRows(
                          checked,
                          dataFiltered.map((row) => row.id)
                        )
                      }
                    />

                    <TableBody>
                      {dataFiltered
                        .slice(
                          table.page * table.rowsPerPage,
                          table.page * table.rowsPerPage + table.rowsPerPage
                        )
                        .map((row) => (
                          <OrderTableRow
                            key={row.id}
                            row={row}
                            selected={table.selected.includes(row.id)}
                            onSelectRow={() => table.onSelectRow(row.id)}
                            onDeleteRow={() => handleDeleteRow(row.id)}
                            canDelete={canDelete}
                            detailsHref={paths.dashboard.order.details(row.id)}
                          />
                        ))}

                      <TableNoData notFound={notFound} />
                    </TableBody>
                  </Table>
                </Scrollbar>
              </Box>

              {/* CUANTOS SE ESTAN VIENDO Y DE CUANTOS. La paginacion sola dice
                  "1-5" y hay que deducir el resto; escrito, se lee. */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                sx={{ px: 2, pt: 1 }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {dataFiltered.length
                    ? `Mostrando ${table.page * table.rowsPerPage + 1} - ${Math.min(
                        (table.page + 1) * table.rowsPerPage,
                        dataFiltered.length
                      )} de ${dataFiltered.length} órdenes`
                    : 'Sin órdenes que mostrar'}
                </Typography>

                <TablePaginationCustom
                  page={table.page}
                  dense={table.dense}
                  count={dataFiltered.length}
                  rowsPerPage={table.rowsPerPage}
                  onPageChange={table.onChangePage}
                  onChangeDense={table.onChangeDense}
                  onRowsPerPageChange={table.onChangeRowsPerPage}
                  sx={{ flexGrow: 1, borderTop: 'none' }}
                />
              </Stack>
            </Card>
          </Stack>
        )}
      </DashboardContent>

      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters, dateError }) {
  const { status, name, payment, orden, startDate, endDate } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    const buscado = name.toLowerCase();

    // SE BUSCA TAMBIEN POR PRODUCTO. Es como se pregunta de verdad —"el pedido
    // de las camisas"—, y antes solo entraban el numero y el nombre de quien
    // compro: buscar "camisa" no devolvia nada y parecia que el pedido no
    // estaba.
    inputData = inputData.filter((order) =>
      [
        order.orderNumber,
        order.customer?.name,
        order.customer?.codigoMiembro,
        order.customer?.memberId,
        order.customer?.idMiembros,
        ...(order.items || []).map((item) => item.name),
      ].some((campo) =>
        String(campo || '')
          .toLowerCase()
          .includes(buscado)
      )
    );
  }

  if (status !== 'all') {
    inputData = inputData.filter((order) => order.status === status);
  }

  if (payment && payment !== 'all') {
    // Por el MISMO catalogo con el que la fila escribe el metodo: filtrar por
    // "Tarjeta" devuelve exactamente los pedidos que la columna llama
    // "Tarjeta", vengan guardados como "visa", "mastercard" o "card".
    inputData = inputData.filter((order) => metodoDePago(order.payment).value === payment);
  }

  if (!dateError) {
    if (startDate && endDate) {
      inputData = inputData.filter((order) => fIsBetween(order.createdAt, startDate, endDate));
    }
  }

  // EL ORDEN ELEGIDO MANDA SOBRE EL DE LA COLUMNA. Se aplica al final, ya
  // filtrado: ordenar antes y filtrar despues da el mismo resultado pero
  // recorriendo mas filas de las que hacen falta.
  const porFecha = (uno, otro) => new Date(otro.createdAt) - new Date(uno.createdAt);
  const importe = (order) => Number(order.totalAmount ?? order.subtotal ?? 0);

  const ordenaciones = {
    recientes: porFecha,
    antiguos: (uno, otro) => porFecha(otro, uno),
    mayor: (uno, otro) => importe(otro) - importe(uno),
    menor: (uno, otro) => importe(uno) - importe(otro),
  };

  return ordenaciones[orden] ? [...inputData].sort(ordenaciones[orden]) : inputData;
}
