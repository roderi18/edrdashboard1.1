'use client';


import { useState, useCallback } from 'react';
import { useBoolean, usePopover, useCopyToClipboard } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import {
  FileItem,
  FileItemInfo,
  AwardsItemIcon,
  FileItemAvatar,
  FileItemActions,
  FileItemActionOverlay,
} from 'src/sections/member/awards/awards-manager-file-item-slots';

import { useAwardFavorite } from './hooks/use-award-favorite';
import { FileManagerFileDetails } from './awards-manager-file-details';
import { AwardsManagerShareDialog } from './awards-manager-share-dialog';
import { getCompletionGridLabel } from './utils/get-completion-grid-label';

// } from 'src/sections/file-manager/awards-manager-file-item-slots';
const INSTRUCTOR_ID = 'instructor';
// ----------------------------------------------------------------------

export function FileManagerFileItem({
  file,
  selected,
  onSelect,
  isGridView = false,
  onDelete,
  readOnly = false,
  inlineDetails = false,
  sx,
  ...other
}) {


  const isAcademiaMinisterialFile =
    file.parentId === INSTRUCTOR_ID ||
    file.parentName === 'Instructor';

  const shareDialog = useBoolean();
  const confirmDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const menuActions = usePopover();

  const checkbox = useBoolean();
  const { favorited, onToggleFavorite } = useAwardFavorite({
    memberId: file?.memberId,
    item: file,
    initialValue: file.isFavorited,
  });

  const { copy } = useCopyToClipboard();

  const [inviteEmail, setInviteEmail] = useState('');

  const handleChangeInvite = useCallback((event) => {
    setInviteEmail(event.target.value);
  }, []);

  const handleCopy = useCallback(() => {
    toast.success('Copiado!');
    copy(file.url);
  }, [copy, file.url]);

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
          Compartir
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
          Eliminar
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  const renderShareDialog = () => (
    <AwardsManagerShareDialog
      open={shareDialog.value}
      shared={file.shared}
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
      content="Estás seguro que quieres eliminar?"
      action={
        <Button variant="contained" color="error" onClick={onDelete}>
          Eliminar
        </Button>
      }
    />
  );

  const isSistemaAscenso = !!file?.sectionId;


  const renderFileDetailsDrawer = () => (
    <FileManagerFileDetails
      file={file}
      memberId={file?.memberId}
      system={file?.systemSent}
      favorited={favorited}
      onFavorite={onToggleFavorite}
      onCopyLink={handleCopy}
      open={detailsDrawer.value}
      onClose={detailsDrawer.onFalse}
      onDelete={() => {
        detailsDrawer.onFalse();
        onDelete();
      }}
      isGridView={isGridView}
      readOnly={readOnly}
    />

  );


  return (
    <>
      <FileItem variant="outlined" selected={selected} sx={sx} {...other}>
        <FileItemActionOverlay
          onClick={(e) => {
            detailsDrawer.onTrue();
          }}
        />

        <AwardsItemIcon
          id={file.id}
          // parentId={file.parentId}
          fileType={file.type}
          onMouseEnter={checkbox.onTrue}
          onMouseLeave={checkbox.onFalse}
          hovered={checkbox.value}
          checked={selected}
          onChange={onSelect}
        />

        <FileItemInfo
          type="file"
          title={file.name}
          inlineDetails={inlineDetails}
          values={
            getCompletionGridLabel(file)
              ? [getCompletionGridLabel(file)]
              : []
          }



          sx={inlineDetails ? {
            gap: 0,
            '& .MuiTypography-root': { lineHeight: 1.15 },
            '& .MuiStack-root': { gap: 0, lineHeight: 1.1 },
          } : {
            gap: 0, // ✅ permitido

            // TÍTULO
            '& .MuiTypography-root': {
              lineHeight: 1.15,
              marginBottom: '-18px',
            },

            // DETALLE ("Completado...")
            '& .MuiStack-root': {
              marginTop: 0,
              paddingTop: 0,
              gap: 0,
              lineHeight: 1.1,
              marginBottom: '-8px',
            },
          }}
        />


        <FileItemAvatar sharedUsers={file.shared} />

        <FileItemActions
          id={file.id}
          checked={favorited}
          onChange={onToggleFavorite}
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
