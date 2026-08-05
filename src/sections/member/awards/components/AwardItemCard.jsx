import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';

import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

export function AwardItemCard({
  award,
  detailsHref,
  editHref,
  onDelete,
  sx,
  ...other
}) {
  const menuActions = usePopover();

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <li>
          <MenuItem component={RouterLink} href={detailsHref} onClick={() => menuActions.onClose()}>
            <Iconify icon="solar:eye-bold" />
            View
          </MenuItem>
        </li>

        <li>
          <MenuItem component={RouterLink} href={editHref} onClick={() => menuActions.onClose()}>
            <Iconify icon="solar:pen-bold" />
            Editar
          </MenuItem>
        </li>

        <MenuItem
          component={detailsHref ? RouterLink : 'div'}
          href={detailsHref}
          onClick={() => menuActions.onClose()}
        >
          <Iconify icon="solar:eye-bold" />
          View
        </MenuItem>

        <MenuItem
          component={editHref ? RouterLink : 'div'}
          href={editHref}
          onClick={() => menuActions.onClose()}
        >
          <Iconify icon="solar:pen-bold" />
          Editar
        </MenuItem>

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            onDelete?.();
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Eliminar
        </MenuItem>

      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Card sx={{ p: 3, position: 'relative', ...sx }} {...other}>
        <IconButton
          onClick={menuActions.onOpen}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>

        {/* FILA HORIZONTAL (IGUAL QUE PERSONAS) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            alt={award.name}
            src={award.avatar}
            sx={{ width: 48, height: 48 }}
          />

          <ListItemText
            primary={award.name}
            secondary={award.statusLabel}
            slotProps={{
              primary: { sx: { typography: 'subtitle1' } },
              secondary: {
                sx: { typography: 'caption', mt: 0.5, color: 'text.disabled' },
              },
            }}
          />
        </Box>

        {/* ACCIONES ABAJO (ALINEADAS) */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, ml: '64px' }}>
          <IconButton size="small" color="error">
            <Iconify icon="solar:phone-bold" />
          </IconButton>
          <IconButton size="small" color="info">
            <Iconify icon="solar:chat-round-dots-bold" />
          </IconButton>
          <IconButton size="small" color="primary">
            <Iconify icon="solar:letter-bold" />
          </IconButton>
        </Box>
      </Card>


      {renderMenuActions()}
    </>
  );
}
