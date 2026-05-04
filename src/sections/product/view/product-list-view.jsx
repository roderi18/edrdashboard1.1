'use client';

import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { esES } from '@mui/x-data-grid/locales';
import { DataGrid, gridClasses } from '@mui/x-data-grid';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { isMemberSessionUser } from 'src/utils/member-access';

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
import { useToolbarSettings, CustomGridActionsCellItem } from 'src/components/custom-data-grid';

import { useAuthContext } from 'src/auth/hooks';

import { useCheckoutContext } from '../../checkout/context';
import { ProductTableToolbar } from '../product-table-toolbar';
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
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();
  const { products, productsLoading } = useGetProducts();
  const { user } = useAuthContext();
  const { state: checkoutState, onAddToCart } = useCheckoutContext();

  const [tableData, setTableData] = useState(products);
  const [selectedRows, setSelectedRows] = useState({
    type: 'include',
    ids: new Set(),
  });

  const filters = useSetState({
    publish: [],
    stock: [],
  });

  const [columnVisibilityModel, setColumnVisibilityModel] = useState(HIDE_COLUMNS);
  const isMemberUser = isMemberSessionUser(user);

  useEffect(() => {
    setTableData(
      isMemberUser ? products.filter((product) => product.publish === 'published') : products
    );
  }, [isMemberUser, products]);

  const canReset = filters.state.publish.length > 0 || filters.state.stock.length > 0;

  const dataFiltered = applyFilter({
    inputData: tableData,
    filters: filters.state,
  });

  const handleDeleteRow = useCallback(async (id) => {
    await eliminarProductoFirestore(id);
    setTableData((prev) => prev.filter((row) => row.id !== id));
    toast.success('Producto eliminado!');
  }, []);

  const handlePublishRow = useCallback(async (id) => {
    const updatedProduct = await actualizarPublicacionProductoFirestore(id, 'published');

    if (!updatedProduct) {
      toast.error('No se pudo publicar el producto');
      return;
    }

    setTableData((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updatedProduct } : row))
    );
    toast.success('Producto publicado!');
  }, []);

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
    await Promise.all(Array.from(selectedRows.ids).map((id) => eliminarProductoFirestore(id)));
    setTableData((prev) => prev.filter((row) => !selectedRows.ids.has(row.id)));
    toast.success('Productos eliminados!');
  }, [selectedRows.ids]);

  const columns = useGetColumns({
    onDeleteRow: handleDeleteRow,
    onPublishRow: handlePublishRow,
    onAddProductToCart: handleAddProductToCart,
    isMemberUser,
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
            !isMemberUser ? (
              <Button
                component={RouterLink}
                href={paths.dashboard.product.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Agregar producto
              </Button>
            ) : null
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

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
              noRowsOverlay: () => <EmptyContent />,
              noResultsOverlay: () => <EmptyContent title="No se encontraron resultados" />,
              toolbar: () => (
                <ProductTableToolbar
                  filters={filters}
                  canReset={canReset}
                  filteredResults={dataFiltered.length}
                  selectedRowCount={selectedRows.ids.size}
                  onOpenConfirmDeleteRows={confirmDialog.onTrue}
                  options={{ stocks: PRODUCT_STOCK_OPTIONS, publishs: PUBLISH_OPTIONS }}
                  isMemberUser={isMemberUser}
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
      </DashboardContent>

      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

const useGetColumns = ({ onDeleteRow, onPublishRow, onAddProductToCart, isMemberUser }) => {
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
        editable: true,
        renderHeader: () => renderTwoLineHeader('Precio Dests.', 'Registrados'),
        renderCell: (params) => <RenderCellPrice params={params} />,
      },
      {
        field: 'precioNoRegistrado',
        headerName: 'Precio Dests. NO Registrados',
        width: 155,
        editable: true,
        renderHeader: () => renderTwoLineHeader('Precio Dests.', 'NO Registrados'),
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
        width: isMemberUser ? 96 : 64,
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

          if (!isMemberUser) {
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
    [onDeleteRow, onPublishRow, onAddProductToCart, isMemberUser, theme.vars.palette.error.main]
  );

  return columns;
};

// ----------------------------------------------------------------------

function applyFilter({ inputData, filters }) {
  const { stock, publish } = filters;

  if (stock.length) {
    inputData = inputData.filter((product) => stock.includes(product.inventoryType));
  }

  if (publish.length) {
    inputData = inputData.filter((product) => publish.includes(product.publish));
  }

  return inputData;
}
