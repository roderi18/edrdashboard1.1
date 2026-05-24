import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useBoolean, usePopover, useCopyToClipboard } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';

import { fData } from 'src/utils/format-number';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { getFileManagerShareLink } from './utils/share-link';
import { FileManagerShareDialog } from './file-manager-share-dialog';
import { FileManagerFileDetails } from './file-manager-file-details';
import { FileManagerCreateFolderDialog } from './file-manager-create-folder-dialog';
import {
  FileItem,
  FileItemIcon,
  FileItemInfo,
  FileItemAvatar,
  FileItemActions,
  FileItemActionOverlay,
} from './file-manager-file-item-slots';

// ----------------------------------------------------------------------

export function FileManagerFolderItem({
  sx,
  folder,
  selected,
  onSelect,
  onDelete,
  canDelete = false,
  disableDetails = false,
  ...other
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shareDialog = useBoolean();
  const confirmDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const editFolderDialog = useBoolean();

  const checkbox = useBoolean();
  const favorite = useBoolean(folder.isFavorited);

  const menuActions = usePopover();

  const { copy } = useCopyToClipboard();

  const [folderName, setFolderName] = useState(folder.name);

  const handleChangeFolderName = useCallback((event) => {
    setFolderName(event.target.value);
  }, []);

  const handleCopy = useCallback(
    (link) => {
      toast.success('Copiado!');
      copy(link || getFileManagerShareLink(folder));
    },
    [copy, folder]
  );

  const handleOpenFolder = useCallback(() => {
    const isFileManagerPath = pathname?.includes('/dashboard/file-manager');
    const params = new URLSearchParams(searchParams.toString());

    params.set('folder', folder.id);

    if (!isFileManagerPath && folder.source === 'storage') {
      params.set('source', 'storage');
      params.set('view', 'grid');
    }

    router.push(`${isFileManagerPath ? '' : '/dashboard/file-manager/'}?${params.toString()}`);
  }, [folder.id, folder.source, pathname, router, searchParams]);

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
          Copiar enlace
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

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            editFolderDialog.onTrue();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Editar
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
      item={folder}
      shared={folder.shared}
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
      content="¿Seguro que deseas eliminar esta carpeta?"
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

  const renderEditFolderDialog = () => (
    <FileManagerCreateFolderDialog
      open={editFolderDialog.value}
      onClose={editFolderDialog.onFalse}
      title="Editar carpeta"
      onUpdate={() => {
        editFolderDialog.onFalse();
        setFolderName(folderName);
        console.info('UPDATE FOLDER', folderName);
      }}
      folderName={folderName}
      onChangeFolderName={handleChangeFolderName}
    />
  );

  const renderFileDetailsDrawer = () => (
    <FileManagerFileDetails
      file={folder}
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
      <FileItem
        variant="outlined"
        selected={selected}
        onClick={handleOpenFolder}
        sx={{ cursor: 'pointer', ...sx }}
        {...other}
      >
        {/* <FileItemActionOverlay onClick={detailsDrawer.onTrue} /> */}
        {!disableDetails && (
          <FileItemActionOverlay
            onClick={(e) => {
              e.stopPropagation();
              handleOpenFolder();
            }}
          />
        )}

        <FileItemIcon
          id={folder.id}
          onMouseEnter={checkbox.onTrue}
          onMouseLeave={checkbox.onFalse}
          hovered={checkbox.value}
          checked={selected}
          onChange={onSelect}
        />

        <FileItemInfo
          type="folder"
          title={folder.name}
          values={[fData(folder.size), `${folder.totalFiles} archivos`]}
        />

        <FileItemAvatar sharedUsers={folder.shared} />

        <FileItemActions
          id={folder.id}
          checked={favorite.value}
          onChange={favorite.onToggle}
          openMenu={menuActions.open}
          onOpenMenu={menuActions.onOpen}
        />
      </FileItem>

      {renderMenuActions()}

      {renderShareDialog()}
      {renderConfirmDialog()}
      {renderEditFolderDialog()}

      {renderFileDetailsDrawer()}
    </>
  );
}
