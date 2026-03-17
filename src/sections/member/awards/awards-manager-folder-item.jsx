import { useState, useCallback } from 'react';
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

import { AwardsManagerShareDialog } from './awards-manager-share-dialog';
import { FileManagerFileDetails } from './awards-manager-file-details';
import { AwardsManagerCreateFolderDialog } from './awards-manager-create-folder-dialog';
import { getCompletedAwards, getTotalAwards } from './utils/get-awards-count';

import {
  FileItem,
  AwardsItemIcon,
  FileItemInfo,
  FileItemAvatar,
  FileItemActions,
  FileItemActionOverlay,
} from 'src/sections/member/awards/awards-manager-file-item-slots';

// ----------------------------------------------------------------------

export function FileManagerFolderItem({ sx, folder, selected, onSelect, onDelete, onOpen, ...other }) {
  console.log('FOLDER ID:', folder.id);

  const shareDialog = useBoolean();
  const confirmDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const editFolderDialog = useBoolean();

  const checkbox = useBoolean();
  const favorite = useBoolean(folder.isFavorited);

  const menuActions = usePopover();

  const { copy } = useCopyToClipboard();

  const [inviteEmail, setInviteEmail] = useState('');
  const [folderName, setFolderName] = useState(folder.name);

  const handleChangeInvite = useCallback((event) => {
    setInviteEmail(event.target.value);
  }, []);

  const handleChangeFolderName = useCallback((event) => {
    setFolderName(event.target.value);
  }, []);

  const handleCopy = useCallback(() => {
    toast.success('Copiado!');
    copy(folder.url);
  }, [copy, folder.url]);

  const isSistemaAscenso =
    folder.id === 'sistema-de-ascenso' ||
    folder.parentId === 'sistema-de-ascenso' ||
    folder.parentName === 'Sistema de Ascenso' ||
    folder.parentPath?.includes('Sistema de Ascenso');


  const isAcademiaMinisterial =
    folder.id === 'academia-ministerial' ||
    folder.parentName === 'Academia Ministerial' ||
    folder.parentId === 'academia-ministerial';

  const label = isSistemaAscenso
    ? 'premios'
    : isAcademiaMinisterial
      ? 'adiestramientos'
      : 'premios';

  const completed = getCompletedAwards(
    folder.memberId,
    folder.id
  );

  const total = getTotalAwards(
    folder.id,
    folder.allData || []
  );


  const ACADEMIA_MINISTERIAL_ID = 'academia-ministerial';
  const INSTRUCTOR_ID = 'instructor';

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
            shareDialog.onTrue();
          }}
        >
          <Iconify icon="solar:share-bold" />
          Share
        </MenuItem>

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            editFolderDialog.onTrue();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Edit
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

  const renderShareDialog = () => (
    <AwardsManagerShareDialog
      open={shareDialog.value}
      shared={folder.shared}
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
        <Button variant="contained" color="error" onClick={onDelete}>
          Delete
        </Button>
      }
    />
  );

  const renderEditFolderDialog = () => (
    <AwardsManagerCreateFolderDialog
      open={editFolderDialog.value}
      onClose={editFolderDialog.onFalse}
      title="Edit Folder"
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
        sx={sx}
        onClick={(e) => {
          if (e.target.closest('button, input, svg')) return;
          onOpen?.();
        }}
      >

        <AwardsItemIcon
          id={folder.id}
          // parentId={folder.parentId}
          folder={folder}
          fileType="folder"
          onMouseEnter={checkbox.onTrue}
          onMouseLeave={checkbox.onFalse}
          hovered={checkbox.value}
          checked={selected}
          onChange={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect?.();
          }}
        />

        <FileItemInfo
          type="folder"
          title={folder.name}
          values={
            isAcademiaMinisterial
              ? [`${completed} de ${total} adiestramientos completados`]
              : [`${completed} de ${total} ${label} completados`]
          }
          sx={{
            gap: 0,

            /* TÍTULO (nombre del folder) */
            '& .MuiTypography-root': {
              lineHeight: 1.15,
              marginBottom: '8px',
            },

            /* DETALLE (completados...) */
            '& .MuiStack-root': {
              marginTop: 0,
              paddingTop: 0,
              gap: 0,
              lineHeight: 1.1,
              marginBottom: '-8px',
            },
          }}
        />


        <FileItemAvatar sharedUsers={folder.shared} />

        <FileItemActions
          id={folder.id}
          checked={favorite.value}
          onChange={(e) => {
            e.preventDefault();
            e.stopPropagation();
            favorite.onToggle();
          }}
          openMenu={menuActions.open}
          onOpenMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            menuActions.onOpen(e);
          }}
        />
      </FileItem>


      {renderMenuActions()}

      {renderShareDialog()}
      {renderConfirmDialog()}
      {renderEditFolderDialog()}

      {/* {renderFileDetailsDrawer()} */}
    </>
  );
}
