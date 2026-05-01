import { useState, useCallback } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, usePopover, useDoubleClick, useCopyToClipboard } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import TableRow, { tableRowClasses } from '@mui/material/TableRow';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import { useRouter } from 'next/navigation';

import { fData } from 'src/utils/format-number';
import { fDate, fTime } from 'src/utils/format-time';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { FileThumbnail } from 'src/components/file-thumbnail';
import { CustomPopover } from 'src/components/custom-popover';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';

import { FileManagerShareDialog } from './logs-file-manager-share-dialog';
import { FileManagerFileDetails } from './logs-file-manager-file-details';
import { FileItemAvatar, FileItemActions } from './logs-file-manager-file-item-slots';

// ----------------------------------------------------------------------

export function FileManagerTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  onRename,

  showType = true,
  showAvatar = true,
  showThumbnail = true,
}) {
  const theme = useTheme();
  const router = useRouter();

  const { copy } = useCopyToClipboard();

  const [inviteEmail, setInviteEmail] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const extension = row.name.split('.').pop();
  const baseName = row.name.replace(`.${extension}`, '');

  const shareDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const confirmDialog = useBoolean();
  const menuActions = usePopover();
  const favorite = useBoolean(row.isFavorited);

  const handleChangeInvite = useCallback((event) => {
    setInviteEmail(event.target.value);
  }, []);

  const handleClick = useDoubleClick({
    click: () => {
      if (row.type === 'folder') {
        router.push(`?folder=${row.id}`);
        return;
      }

      detailsDrawer.onTrue();
    },
    doubleClick: () => console.info('DOUBLE CLICK'),
  });


  const handleCopy = useCallback(() => {
    toast.success('Copiado!');
    copy(row.url);
  }, [copy, row.url]);

  const defaultStyles = {
    borderTop: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    borderBottom: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    '&:first-of-type': {
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
      borderLeft: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    },
    '&:last-of-type': {
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      borderRight: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    },
  };

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <MenuItem
          onClick={() => {
            menuActions.onClose();
            handleCopy();
          }}
        >
          <Iconify icon="eva:link-2-fill" />
          Copiar link
        </MenuItem>

        <MenuItem
          onClick={() => {
            setNewName(baseName);
            setRenameOpen(true);
            menuActions.onClose();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Renombrar
        </MenuItem>

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            shareDialog.onTrue();
          }}
        >
          <Iconify icon="solar:share-bold" />
          Share
        </MenuItem>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <MenuItem
          onClick={() => {
            confirmDialog.onTrue();
            menuActions.onClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Delete
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  const renderFileDetailsDrawer = () => (
    <FileManagerFileDetails
      file={row}
      favorited={favorite.value}
      onFavorite={favorite.onToggle}
      onCopyLink={handleCopy}
      open={detailsDrawer.value}
      onClose={detailsDrawer.onFalse}
      onDelete={onDeleteRow}
    />
  );

  const renderShareDialog = () => (
    <FileManagerShareDialog
      open={shareDialog.value}
      shared={row.shared}
      inviteEmail={inviteEmail}
      onChangeInvite={handleChangeInvite}
      onCopyLink={handleCopy}
      onClose={() => {
        shareDialog.onFalse();
        setInviteEmail('');
      }}
    />
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content="Are you sure want to delete?"
      action={
        <Button variant="contained" color="error" onClick={onDeleteRow}>
          Delete
        </Button>
      }
    />
  );

  return (
    <>
      <TableRow
        selected={selected}
        sx={{
          borderRadius: 2,
          cursor: row.type === 'folder' ? 'pointer' : 'default',
          [`&.${tableRowClasses.selected}, &:hover`]: {
            backgroundColor: 'background.paper',
            boxShadow: theme.vars.customShadows.z20,
            transition: theme.transitions.create(['background-color', 'box-shadow'], {
              duration: theme.transitions.duration.shortest,
            }),
            '&:hover': {
              backgroundColor: 'background.paper',
              boxShadow: theme.vars.customShadows.z20,
            },
          },
          [`& .${tableCellClasses.root}`]: {
            ...defaultStyles,
          },
          ...(detailsDrawer.value && {
            [`& .${tableCellClasses.root}`]: {
              ...defaultStyles,
            },
          }),
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onClick={onSelectRow}
            onDoubleClick={() => console.info('ON DOUBLE CLICK')}
            slotProps={{
              input: {
                id: `${row.id}-checkbox`,
                'aria-label': `${row.id} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell onClick={handleClick}>
          <Box
            sx={{
              gap: 2,
              display: 'flex',
              alignItems: 'center',
              cursor: row.type === 'folder' ? 'pointer' : 'default',
            }}
          >

            {showThumbnail && <FileThumbnail file={row.type} />}

            <Typography
              noWrap
              variant="inherit"
              sx={{
                maxWidth: 360,
                cursor: 'pointer',
                ...(detailsDrawer.value && { fontWeight: 'fontWeightBold' }),
              }}
            >
              {row.name}
            </Typography>
          </Box>
        </TableCell>


        <TableCell onClick={handleClick} sx={{ whiteSpace: 'nowrap' }}>
          {fData(row.size)}
        </TableCell>


        {showType && (
          <TableCell onClick={handleClick} sx={{ whiteSpace: 'nowrap' }}>
            {row.type}
          </TableCell>
        )}


        <TableCell onClick={handleClick} sx={{ whiteSpace: 'nowrap' }}>
          <ListItemText
            primary={fDate(row.modifiedAt)}
            secondary={
              <span suppressHydrationWarning>
                {fTime(row.modifiedAt)}
              </span>
            }
            slotProps={{
              primary: { sx: { typography: 'body2' } },
              secondary: {
                sx: { mt: 0.5, typography: 'caption' },
              },
            }}
          />

        </TableCell>

        {showAvatar && (
          <TableCell align="right" onClick={handleClick}>
            <FileItemAvatar sharedUsers={row.shared} />
          </TableCell>
        )}


        <TableCell align="right" sx={{ px: 1 }}>
          <FileItemActions
            id={row.id}
            checked={favorite.value}
            onChange={favorite.onToggle}
            openMenu={menuActions.open}
            onOpenMenu={menuActions.onOpen}
            sx={{ position: 'static' }}
          />
        </TableCell>
      </TableRow >

      {renderFileDetailsDrawer()}
      {renderShareDialog()}

      {renderMenuActions()}
      {renderConfirmDialog()}

      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 0 }}>
          Renombrar documento
        </DialogTitle>

        {/* 🔥 CONTENEDOR MANUAL */}
        <Box
          sx={{
            px: 3,
            pt: 2,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <TextField
            autoFocus
            fullWidth
            label="Nombre del archivo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            helperText={`La extensión .${extension} se mantiene`}
          />
        </Box>

        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => {
              if (!newName.trim()) return;

              const success = onRename?.(row.id, newName.trim());

              if (success) {
                setRenameOpen(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>


    </>
  );
}
