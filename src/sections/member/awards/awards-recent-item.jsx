import { useState, useCallback } from 'react';
import { useBoolean, usePopover, useCopyToClipboard } from 'minimal-shared/hooks';

import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';

import { fData } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';
import { CustomPopover } from 'src/components/custom-popover';

import { useAwardFavorite } from './hooks/use-award-favorite';
import { FileManagerFileDetails } from './awards-manager-file-details';
import { AwardsManagerShareDialog } from './awards-manager-share-dialog';
import {
  FileItem,
  FileItemInfo,
  FileItemAvatar,
  FileItemActions,
  FileItemActionOverlay,
} from './awards-manager-file-item-slots';

// ----------------------------------------------------------------------

export function FileRecentItem({ file, onDelete, sx, ...other }) {
  const { copy } = useCopyToClipboard();

  const menuActions = usePopover();

  const shareDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const { favorited, onToggleFavorite } = useAwardFavorite({
    memberId: file?.memberId,
    item: file,
    initialValue: file.isFavorited,
  });

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
          Share
        </MenuItem>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            onDelete();
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

  const renderFileDetailsDrawer = () => (
    <FileManagerFileDetails
      file={file}
      favorited={favorited}
      onFavorite={onToggleFavorite}
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
        sx={[
          {
            p: { xs: 2.5, sm: 2 },
            alignItems: { xs: 'unset', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        <FileItemActionOverlay
          onClick={(e) => {
            if (e.target.closest('button, input, svg')) return;
            detailsDrawer.onTrue();
          }}
        />

        <FileThumbnail file={file.type} />

        <FileItemInfo
          type="recent-file"
          title={file.name}
          values={[fData(file.size), fDateTime(file.modifiedAt)]}
        />

        <FileItemAvatar sharedUsers={file.shared} />

        <FileItemActions
          id={file.id}
          checked={favorited}
          onChange={onToggleFavorite}
          openMenu={menuActions.open}
          onOpenMenu={menuActions.onOpen}
          sx={{ position: { xs: 'absolute', sm: 'unset' } }}
        />
      </FileItem>

      {renderMenuActions()}
      {renderFileDetailsDrawer()}
      {renderShareDialog()}
    </>
  );
}
