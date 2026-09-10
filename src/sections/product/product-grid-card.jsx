import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import { fDopCurrency, fShortenNumber } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Image } from 'src/components/image';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { etiquetaDeCategoria } from './product-table-row';

// ----------------------------------------------------------------------
// LA TARJETA DE LA TIENDA.
//
// Manda la FOTO: es lo que distingue una insignia de otra mucho antes que su
// nombre. Debajo, en este orden, lo que decide una compra: nombre, categoria,
// valoracion, precio y el carrito.
//
// SIN ETIQUETA DE INVENTARIO. Decia "En existencia" en casi todas las tarjetas
// —o sea, nada— y le robaba la linea a lo que si se mira antes de comprar. Que
// no queden existencias se sigue sabiendo: el carrito se apaga.
//
// LAS ESTRELLAS SALEN DE LAS RESENAS REALES (`totalCalificaciones` y
// `totalResenas`, que escribe `product-review-service`). Sin resenas no se
// pinta media estrella: se dice que aun no hay valoraciones.
// ----------------------------------------------------------------------

export function ProductGridCard({
  product,
  detailsHref,
  isMemberUser = false,
  canManageStore = false,
  onEdit,
  onPublish,
  onDelete,
  onAddToCart,
}) {
  const menu = usePopover();

  const available = Number(product.available ?? 0);
  const isPublished = product.publish === 'published';
  const esRestringido = product.renglon === 'restringido';
  const noRegistrado = Number(product.precioNoRegistrado ?? 0);
  const totalRatings = Number(product.totalRatings ?? 0);
  const totalReviews = Number(product.totalReviews ?? 0);
  const categoria = etiquetaDeCategoria(product.category);

  const handleAction = (action) => () => {
    menu.onClose();
    action?.();
  };

  const renderEstadosSobreLaFoto = () => (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ top: 8, left: 8, position: 'absolute', maxWidth: 'calc(100% - 16px)' }}
    >
      {/* BORRADOR ES ASUNTO DE QUIEN PUBLICA. Un producto sin publicar no llega
          al resto de la tienda, asi que la etiqueta solo la ve el gestor de la
          tienda y el Administrador Global. */}
      {canManageStore && !isPublished && (
        <Label variant="filled" color="default">
          Borrador
        </Label>
      )}

      {!isMemberUser && esRestringido && (
        <Label variant="filled" color="warning">
          Restringido
        </Label>
      )}
    </Stack>
  );

  const renderValoracion = () =>
    totalReviews > 0 ? (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Rating size="small" value={totalRatings} precision={0.1} readOnly />

        <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
          ({fShortenNumber(totalReviews)})
        </Box>
      </Stack>
    ) : (
      <Box component="span" sx={{ typography: 'caption', color: 'text.disabled' }}>
        Sin valoraciones
      </Box>
    );

  const renderPrecios = () =>
    isMemberUser ? (
      <Box component="span" sx={{ typography: 'h6' }}>
        {fDopCurrency(product.price)}
      </Box>
    ) : (
      <Stack spacing={0.25}>
        <Box component="span" sx={{ typography: 'h6' }}>
          {fDopCurrency(product.precioRegistrado ?? product.price)}
        </Box>

        {/* Los dos precios son datos distintos, no un descuento: uno es para
            destacamentos registrados y otro para los que no lo estan. */}
        <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
          No registrado: {noRegistrado > 0 ? fDopCurrency(noRegistrado) : 'N/A'}
        </Box>
      </Stack>
    );

  return (
    <>
      <Card
        sx={{
          height: 1,
          display: 'flex',
          flexDirection: 'column',
          transition: (theme) => theme.transitions.create(['box-shadow']),
          '&:hover': { boxShadow: (theme) => theme.shadows[8] },
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <Link component={RouterLink} href={detailsHref} sx={{ display: 'block' }}>
            {/* Sin foto no se pinta <Image>: pasarle src="" hacia que el navegador
                volviese a pedir la pagina entera y llenaba la consola de avisos.
                En su lugar va un marcador del mismo cuadrado, para que la rejilla
                no se descuadre cuando a un producto le falta la imagen. */}
            {product.coverUrl ? (
              <Image
                alt={product.name}
                src={product.coverUrl}
                ratio="1/1"
                sx={{ borderRadius: 0 }}
              />
            ) : (
              <Box
                sx={{
                  aspectRatio: '1 / 1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.neutral',
                  color: 'text.disabled',
                }}
              >
                <Iconify icon="solar:gallery-bold" width={40} />
              </Box>
            )}
          </Link>

          {renderEstadosSobreLaFoto()}

          <IconButton
            size="small"
            aria-label="Acciones del producto"
            onClick={menu.onOpen}
            sx={{
              top: 8,
              right: 8,
              position: 'absolute',
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'background.paper' },
            }}
          >
            <Iconify icon="eva:more-vertical-fill" width={18} />
          </IconButton>
        </Box>

        <Stack spacing={0.5} sx={{ p: 2, flexGrow: 1 }}>
          <Link
            component={RouterLink}
            href={detailsHref}
            color="inherit"
            variant="subtitle2"
            sx={{
              display: '-webkit-box',
              overflow: 'hidden',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {product.name}
          </Link>

          {categoria && (
            <Box component="span" sx={{ typography: 'caption', color: 'text.disabled' }}>
              {categoria}
            </Box>
          )}

          {renderValoracion()}

          <Box sx={{ flexGrow: 1 }} />

          {/* EL PRECIO Y EL CARRITO, EN LA MISMA LINEA. Es la fila que cierra la
              tarjeta: lo que cuesta y como se compra. El boton lo ve cualquiera
              que pueda comprar; sin existencias se apaga en vez de desaparecer,
              para que la tarjeta no cambie de forma. */}
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>{renderPrecios()}</Box>

            {!!onAddToCart && (
              <Tooltip title={available > 0 ? 'Agregar al carrito' : 'No disponible'}>
                <Box component="span" sx={{ flexShrink: 0 }}>
                  <IconButton
                    color="primary"
                    aria-label="Agregar al carrito"
                    disabled={available <= 0}
                    onClick={() => onAddToCart?.(product)}
                  >
                    <Iconify icon="solar:cart-plus-bold" />
                  </IconButton>
                </Box>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </Card>

      <CustomPopover open={menu.open} anchorEl={menu.anchorEl} onClose={menu.onClose}>
        <MenuList>
          <MenuItem component={RouterLink} href={detailsHref} onClick={menu.onClose}>
            <Iconify icon="solar:eye-bold" />
            Ver
          </MenuItem>

          {!!onAddToCart && (
            <MenuItem
              disabled={available <= 0}
              onClick={handleAction(() => onAddToCart?.(product))}
            >
              <Iconify icon="solar:cart-3-bold" />
              Agregar al carrito
            </MenuItem>
          )}

          {canManageStore && !isPublished && (
            <MenuItem onClick={handleAction(() => onPublish?.(product.id))}>
              <Iconify icon="solar:check-circle-bold" />
              Publicar
            </MenuItem>
          )}

          {canManageStore && (
            <MenuItem component={RouterLink} href={onEdit?.(product.id)} onClick={menu.onClose}>
              <Iconify icon="solar:pen-bold" />
              Editar
            </MenuItem>
          )}

          {canManageStore && [
            <Divider key="divider" sx={{ borderStyle: 'dashed' }} />,
            <MenuItem
              key="delete"
              onClick={handleAction(() => onDelete?.(product.id))}
              sx={{ color: 'error.main' }}
            >
              <Iconify icon="solar:trash-bin-trash-bold" />
              Eliminar
            </MenuItem>,
          ]}
        </MenuList>
      </CustomPopover>
    </>
  );
}
