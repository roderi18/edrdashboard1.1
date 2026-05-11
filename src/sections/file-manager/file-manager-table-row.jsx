import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, usePopover, useDoubleClick, useCopyToClipboard } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import TableRow, { tableRowClasses } from '@mui/material/TableRow';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';

import { fData } from 'src/utils/format-number';
import { fDate, fTime } from 'src/utils/format-time';
import { downloadFileFromUrl } from 'src/utils/download-file';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { FileThumbnail } from 'src/components/file-thumbnail';
import { CustomPopover } from 'src/components/custom-popover';

import { getFileManagerShareLink } from './utils/share-link';
import { FileManagerShareDialog } from './file-manager-share-dialog';
import { FileManagerFileDetails } from './file-manager-file-details';
import { FileItemAvatar, FileItemActions } from './file-manager-file-item-slots';

// ----------------------------------------------------------------------

const FILE_TYPE_LABELS = {
  folder: 'Carpeta',
  pdf: 'PDF',
  jpg: 'Imagen',
  jpeg: 'Imagen',
  png: 'Imagen',
  webp: 'Imagen',
  gif: 'Imagen',
  image: 'Imagen',
};

const getFileTypeLabel = (type) => FILE_TYPE_LABELS[type] || type;

export function FileManagerTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  onUpload,
  onRename,
  canDelete = false,

  showType = true,
  showAvatar = true,
  showThumbnail = true,
  showRowOutline = true,
}) {
  const theme = useTheme();
  const router = useRouter();

  const { copy } = useCopyToClipboard();

  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const extension = row.name.split('.').pop();
  const baseName = row.name.replace(`.${extension}`, '');

  const shareDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const confirmDialog = useBoolean();
  const menuActions = usePopover();
  const favorite = useBoolean(row.isFavorited);

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


  const handleCopy = useCallback((link) => {
    toast.success('Copiado!');
    copy(link || getFileManagerShareLink(row));
  }, [copy, row]);

  const handleDownload = useCallback(() => {
    downloadFileFromUrl(row.url, row.name || 'archivo');
  }, [row.name, row.url]);

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
        {onUpload && (
          <MenuItem
            onClick={() => {
              menuActions.onClose();
              onUpload();
            }}
          >
            <Iconify icon="eva:cloud-upload-fill" />
            Subir
          </MenuItem>
        )}

        {onUpload && <Divider sx={{ borderStyle: 'dashed' }} />}

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            handleCopy();
          }}
        >
          <Iconify icon="eva:link-2-fill" />
          Copiar link
        </MenuItem>

        {row.type !== 'folder' && (
          <MenuItem
            onClick={() => {
              menuActions.onClose();
              handleDownload();
            }}
          >
            <Iconify icon="eva:cloud-download-fill" />
            Descargar
          </MenuItem>
        )}

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
          Compartir
        </MenuItem>

        {canDelete && row.type !== 'folder' && <Divider sx={{ borderStyle: 'dashed' }} />}

        {canDelete && row.type !== 'folder' && (
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
      item={row}
      shared={row.shared}
      onCopyLink={handleCopy}
      onClose={() => {
        shareDialog.onFalse();
      }}
    />
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content="¿Seguro que deseas eliminar este elemento?"
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            confirmDialog.onFalse();
            onDeleteRow();
          }}
        >
          Eliminar
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
            ...(showRowOutline && defaultStyles),
          },
          ...(detailsDrawer.value && {
            [`& .${tableCellClasses.root}`]: {
              ...(showRowOutline && defaultStyles),
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

            <Box sx={{ minWidth: 0 }}>
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

              {row.uploading && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Cargando...
                </Typography>
              )}
            </Box>
          </Box>
        </TableCell>


        <TableCell onClick={handleClick} sx={{ whiteSpace: 'nowrap' }}>
          {fData(row.size)}
        </TableCell>


        {showType && (
          <TableCell onClick={handleClick} sx={{ whiteSpace: 'nowrap' }}>
            {getFileTypeLabel(row.type)}
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
