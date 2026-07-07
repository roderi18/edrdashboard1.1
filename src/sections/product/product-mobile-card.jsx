import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import { fDopCurrency } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { RenderCellStock, RenderCellRenglon, RenderCellPublish } from './product-table-row';

// ----------------------------------------------------------------------

export function ProductMobileCard({
  product,
  detailsHref,
  isMemberUser = false,
  onView,
  onEdit,
  onPublish,
  onDelete,
  onAddToCart,
}) {
  const menu = usePopover();
  const params = { row: product };

  const available = Number(product.available ?? 0);
  const isPublished = product.publish === 'published';
  const noRegistrado = Number(product.precioNoRegistrado ?? 0);

  const handleAction = (action) => () => {
    menu.onClose();
    action?.();
  };

  const renderPrices = () =>
    isMemberUser ? (
      <Box component="span" sx={{ typography: 'subtitle2' }}>
        {fDopCurrency(product.price)}
      </Box>
    ) : (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, typography: 'caption' }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          Reg:&nbsp;
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 'fontWeightSemiBold' }}>
            {fDopCurrency(product.precioRegistrado ?? product.price)}
          </Box>
        </Box>
        <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          No reg:&nbsp;
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 'fontWeightSemiBold' }}>
            {noRegistrado > 0 ? fDopCurrency(noRegistrado) : 'N/A'}
          </Box>
        </Box>
      </Box>
    );

  return (
    <>
      <Card sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Avatar
          variant="rounded"
          alt={product.name}
          src={product.coverUrl}
          sx={{ width: 72, height: 72, flexShrink: 0 }}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <Link
              component={RouterLink}
              href={detailsHref}
              color="inherit"
              variant="subtitle2"
              sx={{
                flex: 1,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {product.name}
            </Link>

            <IconButton size="small" onClick={menu.onOpen} sx={{ mt: -0.5, mr: -0.5 }}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {!isMemberUser && <RenderCellPublish params={params} />}
            {!isMemberUser && <RenderCellRenglon params={params} />}
          </Box>

          {renderPrices()}

          <RenderCellStock params={params} />

          {isMemberUser && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              disabled={available <= 0}
              startIcon={<Iconify icon="solar:cart-plus-bold" />}
              onClick={() => onAddToCart?.(product)}
              sx={{ alignSelf: 'flex-start', mt: 0.5 }}
            >
              Agregar
            </Button>
          )}
        </Box>
      </Card>

      <CustomPopover open={menu.open} anchorEl={menu.anchorEl} onClose={menu.onClose}>
        <MenuList>
          <MenuItem
            component={RouterLink}
            href={detailsHref}
            onClick={menu.onClose}
          >
            <Iconify icon="solar:eye-bold" />
            Ver
          </MenuItem>

          {isMemberUser && (
            <MenuItem disabled={available <= 0} onClick={handleAction(() => onAddToCart?.(product))}>
              <Iconify icon="solar:cart-3-bold" />
              Agregar al carrito
            </MenuItem>
          )}

          {!isMemberUser && !isPublished && (
            <MenuItem onClick={handleAction(() => onPublish?.(product.id))}>
              <Iconify icon="solar:check-circle-bold" />
              Publicar
            </MenuItem>
          )}

          {!isMemberUser && (
            <MenuItem component={RouterLink} href={onEdit?.(product.id)} onClick={menu.onClose}>
              <Iconify icon="solar:pen-bold" />
              Editar
            </MenuItem>
          )}

          {!isMemberUser && [
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
