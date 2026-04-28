import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';

import { Iconify } from 'src/components/iconify';

import { AwardsManagerPanel } from './awards-manager-panel';
import { FileManagerFileItem } from './member-grid-item';
import dayjs from 'dayjs';

// ----------------------------------------------------------------------

export function MemberGridView({ table, dataFiltered, allData, onDeleteItem, onOpenConfirm, onOpenFolder }) {
  const { selected, onSelectRow: onSelectItem, onSelectAllRows: onSelectAllItems } = table;
  const memberId = table?.memberId;
  const parentId = table?.parentId;
  const systemSent = table?.systemSent;
  const sectionId = table?.sectionId;

  const currentSystem = table?.systemSent;

  const containerRef = useRef(null);

  const handleChangeInvite = useCallback((event) => {
    setInviteEmail(event.target.value);
  }, []);

  const handleChangeFolderName = useCallback((event) => {
    setFolderName(event.target.value);
  }, []);

  const renderShareDialog = () => (
    <AwardsManagerShareDialog
      open={shareDialog.value}
      inviteEmail={inviteEmail}
      onChangeInvite={handleChangeInvite}
      onClose={() => {
        shareDialog.onFalse();
        setInviteEmail('');
      }}
    />
  );

  const renderUploadAwardsDialog = () => (
    <AwardsManagerCreateFolderDialog open={newAwardsDialog.value} onClose={newAwardsDialog.onFalse} />
  );

  const renderCreateFolderDialog = () => (
    <AwardsManagerCreateFolderDialog
      open={newFolderDialog.value}
      onClose={newFolderDialog.onFalse}
      title="Add folder"
      onCreate={() => {
        newFolderDialog.onFalse();
        setFolderName('');
        console.info('CREATE NEW FOLDER', folderName);
      }}
      folderName={folderName}
      onChangeFolderName={handleChangeFolderName}
    />
  );

  const renderFolders = () => (
    <>

      <Collapse in={!foldersCollapse.value} unmountOnExit>
        <Box
          sx={{
            gap: 2.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
          }}
        >
          {dataFiltered
            .filter((i) => i.type === 'folder')
            .map((folder) => (
              <FileManagerFolderItem
                key={folder.id}
                folder={{
                  ...folder,
                  memberId: table.memberId,
                  allData,
                }}
                selected={selected.includes(folder.id)}
                onSelect={() => onSelectItem(folder.id)}
                onDelete={() => onDeleteItem(folder.id)}
                onOpen={() => onOpenFolder(folder.id)}
              />
            ))}
        </Box>
      </Collapse>
    </>
  );

  const renderSelectedActions = () =>
    !!selected?.length && (
      <AwardsManagerActionSelected
        numSelected={selected.length}
        rowCount={dataFiltered.length}
        selected={selected}
        onSelectAllItems={(checked) =>
          onSelectAllItems(
            checked,
            dataFiltered.map((row) => row.id)
          )
        }
        onMarkCompleted={handleMarkCompleted}
        action={
          <>
            <Button
              size="small"
              color="error"
              variant="contained"
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
              onClick={onOpenConfirm}
              sx={{ mr: 1 }}
            >
              Delete
            </Button>

            <Button
              color="primary"
              size="small"
              variant="contained"
              startIcon={<Iconify icon="solar:share-bold" />}
              onClick={shareDialog.onTrue}
            >
              Share
            </Button>
          </>
        }
      />
    );

  return (
    <>
      <Box ref={containerRef}>
        <Box
          sx={{
            gap: 2.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
          }}
        >
          {dataFiltered.map((member) => (
            <FileManagerFileItem
              key={member.id}
              file={member}
              selected={selected.includes(member.id)}
              onSelect={() => onSelectItem(member.id)}
              onDelete={() => onDeleteItem(member.id)}
            />
          ))}



        </Box>

      </Box>
    </>
  );
}
