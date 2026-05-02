import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';

import { RouterLink } from 'src/routes/components';

import { fDate, fTime } from 'src/utils/format-time';
import { fDopCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { InvoicePDFDownload } from './invoice-pdf';

// ----------------------------------------------------------------------

const STATUS_LABELS = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
  draft: 'Borrador',
};

export function InvoiceTableRow({
  row,
  selected,
  editHref,
  canDelete = true,
  onSelectRow,
  onDeleteRow,
  detailsHref,
}) {
  const menuActions = usePopover();
  const confirmDialog = useBoolean();

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <li>
          <MenuItem component={RouterLink} href={detailsHref} onClick={menuActions.onClose}>
            <Iconify icon="solar:eye-bold" />
            Ver
          </MenuItem>
        </li>

        <li>
          <InvoicePDFDownload
            invoice={row}
            currentStatus={row.status}
            fileName={`${row.invoiceNumber || row.id}.pdf`}
            renderButton={(loading) => (
              <MenuItem onClick={menuActions.onClose} disabled={loading} sx={{ color: 'text.primary' }}>
                <Iconify
                  icon={loading ? 'line-md:loading-twotone-loop' : 'solar:printer-minimalistic-bold'}
                />
                Descargar PDF
              </MenuItem>
            )}
          />
        </li>

        {canDelete && (
          <li>
            <MenuItem component={RouterLink} href={editHref} onClick={menuActions.onClose}>
              <Iconify icon="solar:pen-bold" />
              Editar
            </MenuItem>
          </li>
        )}

        {canDelete && <Divider sx={{ borderStyle: 'dashed' }} />}

        {canDelete && (
          <MenuItem
            onClick={() => {
              confirmDialog.onTrue();
              menuActions.onClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Eliminar
          </MenuItem>
        )}
      </MenuList>
    </CustomPopover>
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content="Seguro que deseas eliminar este recibo?"
      action={
        <Button variant="contained" color="error" onClick={onDeleteRow}>
          Eliminar
        </Button>
      }
    />
  );

  return (
    <>
      <TableRow hover selected={selected}>
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onClick={onSelectRow}
            slotProps={{
              input: {
                id: `${row.id}-checkbox`,
                'aria-label': `${row.id} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar alt={row.invoiceTo.name}>{row.invoiceTo.name.charAt(0).toUpperCase()}</Avatar>

            <ListItemText
              primary={row.invoiceTo.name}
              secondary={
                <Link component={RouterLink} href={detailsHref} color="inherit">
                  {row.invoiceNumber}
                </Link>
              }
              slotProps={{
                primary: { noWrap: true, sx: { typography: 'body2' } },
                secondary: {
                  sx: { color: 'text.disabled', '&:hover': { color: 'text.secondary' } },
                },
              }}
            />
          </Box>
        </TableCell>

        <TableCell>
          <ListItemText
            primary={fDate(row.createDate)}
            secondary={fTime(row.createDate)}
            slotProps={{
              primary: { noWrap: true, sx: { typography: 'body2' } },
              secondary: { sx: { mt: 0.5, typography: 'caption' } },
            }}
          />
        </TableCell>

        <TableCell>
          <ListItemText
            primary={fDate(row.dueDate)}
            secondary={fTime(row.dueDate)}
            slotProps={{
              primary: { noWrap: true, sx: { typography: 'body2' } },
              secondary: { sx: { mt: 0.5, typography: 'caption' } },
            }}
          />
        </TableCell>

        <TableCell>{fDopCurrency(row.totalAmount)}</TableCell>

        <TableCell align="center">{row.sent}</TableCell>

        <TableCell>
          <Label
            variant="soft"
            color={
              (row.status === 'paid' && 'success') ||
              (row.status === 'pending' && 'warning') ||
              (row.status === 'overdue' && 'error') ||
              'default'
            }
          >
            {STATUS_LABELS[row.status] || row.status}
          </Label>
        </TableCell>

        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton color={menuActions.open ? 'inherit' : 'default'} onClick={menuActions.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      {renderMenuActions()}
      {canDelete && renderConfirmDialog()}
    </>
  );
}
