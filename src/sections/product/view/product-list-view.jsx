'use client';

import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import { esES } from '@mui/x-data-grid/locales';
import Typography from '@mui/material/Typography';
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
import { TablePaginationCustom } from 'src/components/table';
import { ANCHO_DEL_MARCO } from 'src/components/commerce/commerce-layout';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { useToolbarSettings, CustomGridActionsCellItem } from 'src/components/custom-data-grid';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';

import { useAuthContext } from 'src/auth/hooks';

import { StoreHeader } from '../store-header';
import { ProductGridCard } from '../product-grid-card';
import { useCheckoutContext } from '../../checkout/context';
import { BotonIndiceBuscador } from '../boton-indice-buscador';
import { ProductTableToolbar } from '../product-table-toolbar';
import { StoreCategorySidebar } from '../store-category-sidebar';
import { ProductTableFiltersResult } from '../product-table-filters-result';
import {
  RenderCellStock,
  RenderCellPrice,
  RenderCellRenglon,
  RenderCellProduct,
  RenderCellCategory,
  etiquetaDeCategoria,
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

// "Todos" en "Filas por pagina". El -1 es el valor que la paginacion de MUI
// reconoce para no partir en paginas: con el pone "1–83 de 83" y apaga las
// flechas por si sola.
const TODOS_LOS_PRODUCTOS = -1;

export function ProductListView() {
  const confirmDialog = useBoolean();
  const toolbarOptions = useToolbarSettings();
  const { products, productsLoading } = useGetProducts();
  const { user } = useAuthContext();
  const { state: checkoutState, onAddToCart } = useCheckoutContext();
  const [mobileSearch, setMobileSearch] = useState('');

  // LA TIENDA ABRE EN REJILLA, EN CUALQUIER PANTALLA. Es un escaparate: sin las
  // fotos delante no se distingue una insignia de otra. Antes solo el movil
  // entraba en rejilla y en el escritorio se abria la tabla, que es la vista de
  // trabajo del gestor, no la de quien viene a comprar. Sigue estando a un
  // clic, y si alguien la elige se le recuerda.
  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const displayMode = selectedDisplayMode || 'grid';
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
    categoria: [],
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
    filters.state.renglon.length > 0 ||
    filters.state.categoria.length > 0;

  // LAS CATEGORIAS SALEN DE LOS PRODUCTOS, no de una lista escrita a mano.
  //
  // Son las mismas que se leen bajo el nombre en la lista ('barras-numeros',
  // 'parches'...), las pone quien crea el producto y cambian con el catalogo;
  // una lista fija se quedaria corta el dia que alguien anada una categoria y el
  // filtro no podria encontrar sus productos.
  const categoriaOptions = useMemo(() => {
    const vistas = new Map();

    tableData.forEach((product) => {
      const valor = String(product?.category || '').trim();

      if (!valor || vistas.has(valor)) return;

      vistas.set(valor, { value: valor, label: etiquetaDeCategoria(valor), count: 0 });
    });

    // Cuantos hay en cada una. La columna sin numeros obliga a entrar en cada
    // categoria para saber si tiene algo.
    tableData.forEach((product) => {
      const entrada = vistas.get(String(product?.category || '').trim());

      if (entrada) entrada.count += 1;
    });

    return [...vistas.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [tableData]);

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

  const [gridPage, setGridPage] = useState(0);
  const [gridRowsPerPage, setGridRowsPerPage] = useState(12);

  // Al buscar o filtrar se vuelve a la primera pagina: quedarse en la cuarta de
  // un resultado que ahora tiene una sola deja la rejilla vacia sin explicacion.
  useEffect(() => {
    setGridPage(0);
  }, [mobileSearch, filters.state]);

  // "Todos" llega como -1, que es como lo entiende la paginacion de MUI. Sin
  // tratarlo aparte, `slice(0, -1)` devolvia todos MENOS el ultimo producto.
  const gridData = gridRowsPerPage === TODOS_LOS_PRODUCTOS
    ? mobileData
    : mobileData.slice(
    gridPage * gridRowsPerPage,
    gridPage * gridRowsPerPage + gridRowsPerPage
  );

  const handleDeleteRow = useCallback(
    async (id) => {
      await eliminarProductoFirestore(id, user);
      setTableData((prev) => prev.filter((row) => row.id !== id));
      toast.success('Producto eliminado!');
    },
    [user]
  );

  const handlePublishRow = useCallback(
    async (id) => {
      const updatedProduct = await actualizarPublicacionProductoFirestore(id, 'published', user);

      if (!updatedProduct) {
        toast.error('No se pudo publicar el producto');
        return;
      }

      setTableData((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...updatedProduct } : row))
      );
      toast.success('Producto publicado!');
    },
    [user]
  );

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
    await Promise.all(
      Array.from(selectedRows.ids).map((id) => eliminarProductoFirestore(id, user))
    );
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
      {/* LA TIENDA OCUPA TODO EL ANCHO, EN LAS DOS VISTAS. Con las fotos
          mandando, el contenedor estrecho dejaba cuatro columnas de tarjetas
          diminutas y dos franjas vacias a los lados.
          
          Y el panel igual: con un tope en pixeles, alejar el zoom encogia la
          letra pero dejaba la tabla del mismo ancho, con mas hueco vacio a los
          lados en vez de mas filas a la vista. Quien aleja el zoom quiere ver
          MAS, no lo mismo mas pequeño. */}
      <DashboardContent
        maxWidth={false}
        sx={{
          mx: 'auto',
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          // ANCHO FIJO, NO FLUIDO, como en pedidos y recibos. Sin tope, alejar
          // el zoom no alejaba la pagina: la ensanchaba —la rejilla metia mas
          // columnas y las tarjetas se hacian cada vez mas pequeñas—, asi que se
          // veia MAS, no lo mismo mas lejos.
          //
          // El tope va aqui y no en `maxWidth` porque esa prop solo se aplica
          // con el "diseño compacto" encendido en Ajustes, que cada quien tiene
          // como quiere.
          maxWidth: ANCHO_DEL_MARCO,
        }}
      >
        {/* SIN TITULO NI MIGAS. La tienda entra por su propia portada
            (`StoreHeader`) y el menu lateral ya dice donde se esta: el
            encabezado solo repetia lo mismo y empujaba las fotos fuera de
            pantalla. El selector de vista se fue con los filtros, que es donde
            se busca. */}
        {canManageStore && (
          <Box sx={{ mb: 3, gap: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
            {/* Las caras que le faltan al buscador de la cabecera. Desaparece
                cuando ya estan todas. */}
            <BotonIndiceBuscador productos={products} />

            <Button
              component={RouterLink}
              href={paths.dashboard.product.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Agregar producto
            </Button>
          </Box>
        )}

        {displayMode === 'grid' ? (
          <>
            <StoreHeader sx={{ mb: 3 }} />

            {/* LA COLUMNA Y LA REJILLA, LADO A LADO. En tableta y movil la
                columna estorba mas de lo que ayuda —se come el ancho que
                necesitan las fotos—, asi que ahi desaparece y las categorias se
                eligen en el mismo desplegable de filtros de siempre. */}
            <Box
              sx={{
                gap: 3,
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              {/* La columna fija lleva debajo el aviso del descuento: van juntos
                  en la misma caja pegajosa para que el texto no se quede atras
                  al bajar por la rejilla. */}
              <Box
                sx={{
                  top: 88,
                  width: 260,
                  flexShrink: 0,
                  position: 'sticky',
                  display: { xs: 'none', lg: 'block' },
                }}
              >
                <StoreCategorySidebar
                  options={categoriaOptions}
                  value={filters.state.categoria}
                  onChange={(categoria) => filters.setState({ categoria })}
                  total={tableData.length}
                />

                <Typography
                  variant="body2"
                  sx={{ mt: 2, px: 1, color: 'text.secondary', fontStyle: 'italic' }}
                >
                  Al estar inscrito en Oficina Nacional, se aplica automáticamente a un{' '}
                  <strong>descuento especial</strong> en todos los productos de nuestra tienda.
                </Typography>
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 2.5 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    alignItems={{ md: 'center' }}
                  >
                    {/* EN PANTALLA PEQUEÑA, BUSCADOR Y FILTRO EN LA MISMA
                        LINEA. El boton de filtros colgaba debajo del buscador y
                        se comia una fila entera de alto en el movil, que es
                        justo donde menos sobra. */}
                    <Box
                      sx={{
                        gap: 1.5,
                        display: 'flex',
                        flexShrink: 0,
                        alignItems: 'center',
                        width: { xs: 1, md: 320 },
                      }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        value={mobileSearch}
                        onChange={(event) => setMobileSearch(event.target.value)}
                        placeholder="Buscar productos..."
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

                      <Box sx={{ flexShrink: 0, display: { xs: 'block', md: 'none' } }}>
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
                            {
                              key: 'categoria',
                              label: 'Categoría',
                              value: filters.state.categoria,
                              onChange: (event) =>
                                filters.setState({ categoria: event.target.value }),
                              options: categoriaOptions,
                            },
                            ...(!isMemberUser
                              ? [
                                  {
                                    key: 'renglon',
                                    label: 'Renglón',
                                    value: filters.state.renglon,
                                    onChange: (event) =>
                                      filters.setState({ renglon: event.target.value }),
                                    options: PRODUCT_RENGLON_OPTIONS,
                                  },
                                  {
                                    key: 'publish',
                                    label: 'Publicación',
                                    value: filters.state.publish,
                                    onChange: (event) =>
                                      filters.setState({ publish: event.target.value }),
                                    options: PUBLISH_OPTIONS,
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </Box>
                    </Box>

                    {/* De `md` en adelante los filtros van a la vista; por debajo,
                        en el mismo cajon que ya usaba la rejilla. */}
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ display: { xs: 'none', md: 'flex' }, flexGrow: 1 }}
                    >
                      <TextField
                        select
                        size="small"
                        label="Categoría"
                        value={filters.state.categoria}
                        onChange={(event) => filters.setState({ categoria: event.target.value })}
                        sx={{ minWidth: 180 }}
                        slotProps={{
                          select: {
                            multiple: true,
                            renderValue: (seleccion) =>
                              seleccion.map((valor) => etiquetaDeCategoria(valor)).join(', '),
                          },
                        }}
                      >
                        {categoriaOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        size="small"
                        label="Disponibilidad"
                        value={filters.state.stock}
                        onChange={(event) => filters.setState({ stock: event.target.value })}
                        sx={{ minWidth: 170 }}
                        slotProps={{
                          select: {
                            multiple: true,
                            renderValue: (seleccion) =>
                              seleccion
                                .map(
                                  (valor) =>
                                    PRODUCT_STOCK_OPTIONS.find((option) => option.value === valor)
                                      ?.label ?? valor
                                )
                                .join(', '),
                          },
                        }}
                      >
                        {PRODUCT_STOCK_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      {!isMemberUser && (
                        <TextField
                          select
                          size="small"
                          label="Renglón"
                          value={filters.state.renglon}
                          onChange={(event) => filters.setState({ renglon: event.target.value })}
                          sx={{ minWidth: 150 }}
                          slotProps={{
                            select: {
                              multiple: true,
                              renderValue: (seleccion) =>
                                seleccion
                                  .map(
                                    (valor) =>
                                      PRODUCT_RENGLON_OPTIONS.find(
                                        (option) => option.value === valor
                                      )?.label ?? valor
                                  )
                                  .join(', '),
                            },
                          }}
                        >
                          {PRODUCT_RENGLON_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}

                      {!isMemberUser && (
                        <TextField
                          select
                          size="small"
                          label="Publicación"
                          value={filters.state.publish}
                          onChange={(event) => filters.setState({ publish: event.target.value })}
                          sx={{ minWidth: 160 }}
                          slotProps={{
                            select: {
                              multiple: true,
                              renderValue: (seleccion) =>
                                seleccion
                                  .map(
                                    (valor) =>
                                      PUBLISH_OPTIONS.find((option) => option.value === valor)
                                        ?.label ?? valor
                                  )
                                  .join(', '),
                            },
                          }}
                        >
                          {PUBLISH_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    </Stack>

                    {/* EL SELECTOR DE VISTA CIERRA LA FILA, detras de
                        "Publicacion": pasar de rejilla a panel es una decision
                        del mismo tipo que filtrar, no del encabezado. */}
                    <Box
                      sx={{
                        ml: 'auto',
                        justifyContent: 'flex-end',
                        // En movil no hay eleccion que hacer: el propio selector
                        // fuerza la rejilla, asi que solo estorbaria.
                        display: { xs: 'none', md: 'flex' },
                      }}
                    >
                      <ViewModeToggle
                        value={displayMode}
                        onChange={setDisplayMode}
                        storageKey="store-display-mode"
                      />
                    </Box>
                  </Stack>

                  {canReset && (
                    <ProductTableFiltersResult
                      filters={filters}
                      totalResults={mobileData.length}
                      sx={{ pt: 2 }}
                    />
                  )}
                </Card>

                {productsLoading ? (
                  <EmptyContent title="Cargando productos..." />
                ) : !mobileData.length ? (
                  <EmptyContent title="No se encontraron resultados" />
                ) : (
                  <>
                    <Box
                      sx={{
                        gap: 2.5,
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'repeat(2, 1fr)',
                          sm: 'repeat(3, 1fr)',
                          md: 'repeat(3, 1fr)',
                          lg: 'repeat(4, 1fr)',
                        },
                      }}
                    >
                      {gridData.map((product) => (
                        <ProductGridCard
                          key={product.id}
                          product={product}
                          isMemberUser={isMemberUser}
                          canManageStore={canManageStore}
                          detailsHref={paths.dashboard.product.details(product.id)}
                          onAddToCart={handleAddProductToCart}
                        />
                      ))}
                    </Box>

                    <TablePaginationCustom
                      page={gridPage}
                      count={mobileData.length}
                      rowsPerPage={gridRowsPerPage}
                      rowsPerPageOptions={[12, 24, 48, { label: 'Todos', value: TODOS_LOS_PRODUCTOS }]}
                      onPageChange={(event, nuevaPagina) => setGridPage(nuevaPagina)}
                      onRowsPerPageChange={(event) => {
                        setGridRowsPerPage(parseInt(event.target.value, 10));
                        setGridPage(0);
                      }}
                      sx={{ mt: 1 }}
                    />
                  </>
                )}
              </Box>
            </Box>
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
                      categorias: categoriaOptions,
                    }}
                    isMemberUser={isMemberUser}
                    canManageStore={canManageStore}
                    displayMode={displayMode}
                    onChangeDisplayMode={setDisplayMode}
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
        ? [
            {
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
            },
          ]
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
  const { stock, publish, renglon, categoria } = filters;

  if (stock.length) {
    inputData = inputData.filter((product) => stock.includes(product.inventoryType));
  }

  if (publish.length) {
    inputData = inputData.filter((product) => publish.includes(product.publish));
  }

  if (categoria?.length) {
    inputData = inputData.filter((product) =>
      categoria.includes(String(product.category || '').trim())
    );
  }

  if (renglon.length) {
    inputData = inputData.filter((product) => renglon.includes(product.renglon));
  }

  return inputData;
}
