'use client';

import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import { esES } from '@mui/x-data-grid/locales';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DataGrid, gridClasses } from '@mui/x-data-grid';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { isMemberSessionUser, canManageStoreProducts } from 'src/utils/member-access';

import { PRODUCT_STOCK_OPTIONS } from 'src/_mock';
import { useGetProducts } from 'src/actions/product';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  eliminarProductoFirestore,
  actualizarPublicacionProductoFirestore,
} from 'src/services/product-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { useToolbarSettings, CustomGridActionsCellItem } from 'src/components/custom-data-grid';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';

import { useAuthContext } from 'src/auth/hooks';

import { ProductMobileCard } from '../product-mobile-card';
import { useCheckoutContext } from '../../checkout/context';
import { ProductTableToolbar } from '../product-table-toolbar';
import { ProductTableFiltersResult } from '../product-table-filters-result';
import {
  RenderCellStock,
  RenderCellPrice,
  RenderCellRenglon,
  RenderCellProduct,
  RenderCellCategory,
} from '../product-table-row';

// ----------------------------------------------------------------------

const PUBLISH_OPTIONS = [
  { value: 'published', label: 'Publicados' },
  { value: 'draft', label: 'Borrador' },
];

const PRODUCT_RENGLON_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'restringido', label: 'Restringido' },
];

const HIDE_COLUMNS = {};
const HIDE_COLUMNS_TOGGLABLE = ['actions'];

const renderTwoLineHeader = (firstLine, secondLine) => (
  <Box component="span" sx={{ lineHeight: 1.15, whiteSpace: 'normal' }}>
    {firstLine}
    <br />
    {secondLine}
  </Box>
);

// ----------------------------------------------------------------------

export function ProductListView() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();
  const { products, productsLoading } = useGetProducts();
  const { user } = useAuthContext();
  const { state: checkoutState, onAddToCart } = useCheckoutContext();
  const [mobileSearch, setMobileSearch] = useState('');

  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const displayMode = selectedDisplayMode || (isMobile ? 'grid' : 'panel');
  const setDisplayMode = useCallback((nextMode) => {
    setSelectedDisplayMode(nextMode);
  }, []);

  const [tableData, setTableData] = useState(products);
  const [selectedRows, setSelectedRows] = useState({
    type: 'include',
    ids: new Set(),
  });

  const filters = useSetState({
    publish: [],
    stock: [],
    renglon: [],
  });

  const [columnVisibilityModel, setColumnVisibilityModel] = useState(HIDE_COLUMNS);
  const isMemberUser = isMemberSessionUser(user);
  // Solo el gestor de la tienda administra productos (auditoría / dinero).
  const canManageStore = canManageStoreProducts(user);

  useEffect(() => {
    setTableData(
      isMemberUser ? products.filter((product) => product.publish === 'published') : products
    );
  }, [isMemberUser, products]);

  const canReset =
    filters.state.publish.length > 0 ||
    filters.state.stock.length > 0 ||
    filters.state.renglon.length > 0;

  const dataFiltered = applyFilter({
    inputData: tableData,
    filters: filters.state,
  });

  const mobileData = mobileSearch.trim()
    ? dataFiltered.filter((product) =>
      String(product.name || '')
        .toLowerCase()
        .includes(mobileSearch.trim().toLowerCase())
    )
    : dataFiltered;

  const handleDeleteRow = useCallback(async (id) => {
    await eliminarProductoFirestore(id, user);
    setTableData((prev) => prev.filter((row) => row.id !== id));
    toast.success('Producto eliminado!');
  }, [user]);

  const handlePublishRow = useCallback(async (id) => {
    const updatedProduct = await actualizarPublicacionProductoFirestore(id, 'published', user);

    if (!updatedProduct) {
      toast.error('No se pudo publicar el producto');
      return;
    }

    setTableData((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updatedProduct } : row))
    );
    toast.success('Producto publicado!');
  }, [user]);

  const handleAddProductToCart = useCallback(
    (product) => {
      const available = Number(product?.available ?? 0);
      const currentQuantity =
        checkoutState.items
          ?.filter((item) => item.id === product.id)
          .reduce((total, item) => total + Number(item.quantity || 0), 0) || 0;

      if (available <= 0 || currentQuantity >= available) {
        toast.error('Producto sin existencia disponible');
        return;
      }

      onAddToCart?.({
        id: product.id,
        name: product.name,
        coverUrl: product.coverUrl,
        available,
        price: Number(product.price || 0),
        colors: [product.colors?.[0] || ''],
        size: product.sizes?.[0] || '',
        quantity: 1,
        subtotal: Number(product.price || 0),
      });
      toast.success('Producto agregado al carrito');
    },
    [checkoutState.items, onAddToCart]
  );

  const handleDeleteRows = useCallback(async () => {
    await Promise.all(Array.from(selectedRows.ids).map((id) => eliminarProductoFirestore(id, user)));
    setTableData((prev) => prev.filter((row) => !selectedRows.ids.has(row.id)));
    toast.success('Productos eliminados!');
  }, [selectedRows.ids, user]);

  const columns = useGetColumns({
    onDeleteRow: handleDeleteRow,
    onPublishRow: handlePublishRow,
    onAddProductToCart: handleAddProductToCart,
    isMemberUser,
    canManageStore,
  });

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content={
        <>
          Seguro que quieres eliminar <strong> {selectedRows.ids.size} </strong> productos?
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
      <DashboardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <CustomBreadcrumbs
          heading="Lista de productos"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Producto', href: paths.dashboard.product.root },
            { name: 'Lista' },
          ]}
          action={
            <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
              <ViewModeToggle
                value={displayMode}
                onChange={setDisplayMode}
                storageKey="global-display-mode"
              />

              {canManageStore && (
                <Button
                  component={RouterLink}
                  href={paths.dashboard.product.new}
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  Agregar producto
                </Button>
              )}
            </Box>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {displayMode === 'grid' ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                value={mobileSearch}
                onChange={(event) => setMobileSearch(event.target.value)}
                placeholder="Buscar producto..."
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

              <TableToolbarMobileFilter
                hasActiveFilters={canReset}
                filtersConfig={[
                  {
                    key: 'stock',
                    label: 'Existencias',
                    value: filters.state.stock,
                    onChange: (event) => filters.setState({ stock: event.target.value }),
                    options: PRODUCT_STOCK_OPTIONS,
                  },
                  ...(!isMemberUser
                    ? [
                      {
                        key: 'renglon',
                        label: 'Renglón',
                        value: filters.state.renglon,
                        onChange: (event) => filters.setState({ renglon: event.target.value }),
                        options: PRODUCT_RENGLON_OPTIONS,
                      },
                      {
                        key: 'publish',
                        label: 'Publicación',
                        value: filters.state.publish,
                        onChange: (event) => filters.setState({ publish: event.target.value }),
                        options: PUBLISH_OPTIONS,
                      },
                    ]
                    : []),
                ]}
              />
            </Box>

            {canReset && (
              <ProductTableFiltersResult
                filters={filters}
                totalResults={dataFiltered.length}
                sx={{ mb: 2 }}
              />
            )}

            {productsLoading ? (
              <EmptyContent title="Cargando productos..." />
            ) : !mobileData.length ? (
              <EmptyContent title="No se encontraron resultados" />
            ) : (
              <Box
                sx={{
                  gap: 1.5,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                    lg: 'repeat(4, 1fr)',
                  },
                }}
              >
                {mobileData.map((product) => (
                  <ProductMobileCard
                    key={product.id}
                    product={product}
                    isMemberUser={isMemberUser}
                    canManageStore={canManageStore}
                    detailsHref={paths.dashboard.product.details(product.id)}
                    onEdit={(id) => paths.dashboard.product.edit(id)}
                    onPublish={handlePublishRow}
                    onDelete={handleDeleteRow}
                    onAddToCart={handleAddProductToCart}
                  />
                ))}
              </Box>
            )}
          </>
        ) : (
          <Card
            sx={{
              minHeight: 640,
              flexGrow: { md: 1 },
              display: { md: 'flex' },
              height: { xs: 800, md: '1px' },
              flexDirection: { md: 'column' },
            }}
          >
            <DataGrid
              {...toolbarOptions.settings}
              checkboxSelection
              disableRowSelectionOnClick
              rows={dataFiltered}
              columns={columns}
              loading={productsLoading}
              localeText={esES.components.MuiDataGrid.defaultProps.localeText}
              getRowHeight={() => 'auto'}
              pageSizeOptions={[5, 10, 20, { value: -1, label: 'Todos' }]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              columnVisibilityModel={columnVisibilityModel}
              onColumnVisibilityModelChange={(newModel) => setColumnVisibilityModel(newModel)}
              onRowSelectionModelChange={(newSelectionModel) => setSelectedRows(newSelectionModel)}
              slots={{
                // SIN FLECHITA DE ORDEN. El encabezado ya ordena al pulsarlo
                // —nombre incluido—, asi que el boton de al lado hacia lo mismo
                // dos veces y le robaba sitio al titulo. Se quitan los tres
                // iconos: el de ascendente, el de descendente y el que asoma al
                // pasar por encima. Ordenar sigue funcionando igual.
                columnSortedAscendingIcon: null,
                columnSortedDescendingIcon: null,
                columnUnsortedIcon: null,
                noRowsOverlay: () => <EmptyContent />,
                noResultsOverlay: () => <EmptyContent title="No se encontraron resultados" />,
                toolbar: () => (
                  <ProductTableToolbar
                    filters={filters}
                    canReset={canReset}
                    rows={dataFiltered}
                    filteredResults={dataFiltered.length}
                    selectedRowCount={selectedRows.ids.size}
                    onOpenConfirmDeleteRows={confirmDialog.onTrue}
                    options={{
                      stocks: PRODUCT_STOCK_OPTIONS,
                      publishs: PUBLISH_OPTIONS,
                      renglones: PRODUCT_RENGLON_OPTIONS,
                    }}
                    isMemberUser={isMemberUser}
                    canManageStore={canManageStore}
                    /********/
                    settings={toolbarOptions.settings}
                    onChangeSettings={toolbarOptions.onChangeSettings}
                  />
                ),
              }}
              slotProps={{
                columnsManagement: {
                  getTogglableColumns: () =>
                    columns
                      .filter((col) => !HIDE_COLUMNS_TOGGLABLE.includes(col.field))
                      .map((col) => col.field),
                },
              }}
              sx={{
                [`& .${gridClasses.cell}`]: {
                  display: 'flex',
                  alignItems: 'center',
                },
              }}
            />
          </Card>
        )}
      </DashboardContent>

      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

const useGetColumns = ({
  onDeleteRow,
  onPublishRow,
  onAddProductToCart,
  isMemberUser,
  canManageStore,
}) => {
  const theme = useTheme();

  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Producto',
        flex: 1,
        minWidth: 360,
        hideable: false,
        renderCell: (params) => (
          <RenderCellProduct
            params={params}
            href={paths.dashboard.product.details(params.row.id)}
          />
        ),
      },
      {
        field: 'inventoryType',
        headerName: 'Existencias',
        width: 160,
        type: 'singleSelect',
        filterable: false,
        valueOptions: PRODUCT_STOCK_OPTIONS,
        renderCell: (params) => <RenderCellStock params={params} />,
      },
      {
        field: 'precioRegistrado',
        headerName: 'Precio Dests. Registrados',
        width: 145,
        editable: canManageStore,
        renderHeader: () => renderTwoLineHeader('Precio Dests.', 'Registrados'),
        renderCell: (params) => <RenderCellPrice params={params} />,
      },
      {
        field: 'precioNoRegistrado',
        headerName: 'Precio Dests. Sin registross',
        width: 155,
        editable: canManageStore,
        renderHeader: () => renderTwoLineHeader('Precio Dests.', 'Sin registross'),
        renderCell: (params) => <RenderCellPrice params={params} />,
      },
      ...(isMemberUser
        ? [
          {
            field: 'category',
            headerName: 'Categoria',
            width: 140,
            filterable: false,
            renderCell: (params) => <RenderCellCategory params={params} />,
          },
        ]
        : []),
      ...(!isMemberUser
        ? [{
          field: 'renglon',
          headerName: 'Renglón',
          width: 120,
          type: 'singleSelect',
          filterable: false,
          valueOptions: [
            { value: 'general', label: 'General' },
            { value: 'restringido', label: 'Restringido' },
          ],
          renderCell: (params) => <RenderCellRenglon params={params} />,
        }]

        : []),
      {
        type: 'actions',
        field: 'actions',
        headerName: ' ',
        width: isMemberUser || canManageStore ? 96 : 64,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        getActions: (params) => {
          const actions = [
            ...(isMemberUser
              ? [
                <CustomGridActionsCellItem
                  label="Agregar al carrito"
                  icon={<Iconify icon="solar:cart-3-bold" />}
                  disabled={Number(params.row.available || 0) <= 0}
                  onClick={() => onAddProductToCart(params.row)}
                />,
              ]
              : []),
            <CustomGridActionsCellItem
              showInMenu
              label="Ver"
              icon={<Iconify icon="solar:eye-bold" />}
              href={paths.dashboard.product.details(params.row.id)}
            />,
          ];

          if (canManageStore) {
            if (params.row.publish !== 'published') {
              actions.push(
                <CustomGridActionsCellItem
                  showInMenu
                  label="Publicar"
                  icon={<Iconify icon="solar:check-circle-bold" />}
                  onClick={() => onPublishRow(params.row.id)}
                />
              );
            }

            actions.push(
              <CustomGridActionsCellItem
                showInMenu
                label="Editar"
                icon={<Iconify icon="solar:pen-bold" />}
                href={paths.dashboard.product.edit(params.row.id)}
              />,
              <CustomGridActionsCellItem
                showInMenu
                label="Eliminar"
                icon={<Iconify icon="solar:trash-bin-trash-bold" />}
                onClick={() => onDeleteRow(params.row.id)}
                style={{ color: theme.vars.palette.error.main }}
              />
            );
          }

          return actions;
        },
      },
    ],
    [
      onDeleteRow,
      onPublishRow,
      onAddProductToCart,
      isMemberUser,
      canManageStore,
      theme.vars.palette.error.main,
    ]
  );

  return columns;
};

// ----------------------------------------------------------------------

function applyFilter({ inputData, filters }) {
  const { stock, publish, renglon } = filters;

  if (stock.length) {
    inputData = inputData.filter((product) => stock.includes(product.inventoryType));
  }

  if (publish.length) {
    inputData = inputData.filter((product) => publish.includes(product.publish));
  }

  if (renglon.length) {
    inputData = inputData.filter((product) => renglon.includes(product.renglon));
  }

  return inputData;
}
