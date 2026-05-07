import { useCallback } from 'react';
import { useBoolean, usePopover, useCopyToClipboard } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';

import { fData } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';
import { downloadFileFromUrl } from 'src/utils/download-file';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { getFileManagerShareLink } from './utils/share-link';
import { FileManagerShareDialog } from './file-manager-share-dialog';
import { FileManagerFileDetails } from './file-manager-file-details';
import {
  FileItem,
  FileItemIcon,
  FileItemInfo,
  FileItemAvatar,
  FileItemActions,
  FileItemActionOverlay,
} from './file-manager-file-item-slots';

// ----------------------------------------------------------------------

export function FileManagerFileItem({
  sx,
  file,
  selected,
  onSelect,
  onDelete,
  canDelete = false,
  disableDetails = false,
  ...other
}) {
  const shareDialog = useBoolean();
  const confirmDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const menuActions = usePopover();

  const checkbox = useBoolean();
  const favorite = useBoolean(file.isFavorited);

  const { copy } = useCopyToClipboard();

  const handleCopy = useCallback((link) => {
    toast.success('Copiado!');
    copy(link || getFileManagerShareLink(file));
  }, [copy, file]);

  const handleDownload = useCallback(() => {
    downloadFileFromUrl(file.url, file.name || 'archivo');
  }, [file.name, file.url]);

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
            menuActions.onClose();
            handleDownload();
          }}
        >
          <Iconify icon="eva:cloud-download-fill" />
          Descargar
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

  const renderShareDialog = () => (
    <FileManagerShareDialog
      open={shareDialog.value}
      item={file}
      shared={file.shared}
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
      content="¿Seguro que deseas eliminar este archivo?"
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            confirmDialog.onFalse();
            onDelete();
          }}
        >
          Eliminar
        </Button>
      }
    />
  );

  const renderFileDetailsDrawer = () => (
    <FileManagerFileDetails
      file={file}
      favorited={favorite.value}
      onFavorite={favorite.onToggle}
      onCopyLink={handleCopy}
      open={detailsDrawer.value}
      onClose={detailsDrawer.onFalse}
      onDelete={() => {
        detailsDrawer.onFalse();
        onDelete();
      }}
    />
  );

  return (
    <>
      <FileItem variant="outlined" selected={selected} sx={sx} {...other}>
        {/* <FileItemActionOverlay onClick={detailsDrawer.onTrue} /> */}
        {!disableDetails && (
          <FileItemActionOverlay
            onClick={(e) => {
              e.stopPropagation();
              detailsDrawer.onTrue();
            }}
          />
        )}

        <FileItemIcon
          id={file.id}
          onMouseEnter={checkbox.onTrue}
          onMouseLeave={checkbox.onFalse}
          hovered={checkbox.value}
          checked={selected}
          onChange={onSelect}
          fileType={file.type}
        />

        <FileItemInfo
          type="file"
          title={file.name}
          values={file.uploading ? [fData(file.size), 'Cargando...'] : [fData(file.size), fDateTime(file.modifiedAt)]}
        />

        <FileItemAvatar sharedUsers={file.shared} />

        <FileItemActions
          id={file.id}
          checked={favorite.value}
          onChange={favorite.onToggle}
          openMenu={menuActions.open}
          onOpenMenu={menuActions.onOpen}
        />
      </FileItem>

      {renderMenuActions()}

      {renderShareDialog()}
      {renderConfirmDialog()}

      {renderFileDetailsDrawer()}
    </>
  );
}
