import dayjs from 'dayjs';
import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';

import { guardarProgresoAscensoMiembro } from 'src/services/member-awards-service';
import {
  getAwardsProgressCache,
  setAwardsProgressCache,
  notifyAwardsProgressChanged,
} from 'src/services/awards-progress-cache';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { FileManagerFileItem } from './awards-manager-file-item';
import { FileManagerFolderItem } from './awards-manager-folder-item';
import { AwardsManagerShareDialog } from './awards-manager-share-dialog';
import { AwardsManagerActionSelected } from './awards-manager-action-selected';
import { AwardsManagerCreateFolderDialog } from './awards-manager-create-folder-dialog';

// ----------------------------------------------------------------------

export function AwardsManagerGridView({ table, dataFiltered, allData, onDeleteItem, onOpenConfirm, onOpenFolder, readOnly = false }) {
  const { user } = useAuthContext();
  const { selected, onSelectRow: onSelectItem, onSelectAllRows: onSelectAllItems } = table;
  const memberId = table?.memberId;
  const parentId = table?.parentId;
  const systemSent = table?.systemSent;
  const sectionId = table?.sectionId;

  const currentSystem = table?.systemSent;



  const handleMarkCompleted = () => {
    if (readOnly || !memberId) return;

    const now = new Date().toISOString();
    const today = dayjs().toISOString();

    const { status: currentStatus = {}, data: currentData = {} } = getAwardsProgressCache(memberId);

    const ROOT_ID = 'academia-ministerial';

    selected.forEach((rowId) => {
      currentStatus[ROOT_ID] ??= {};
      currentStatus[ROOT_ID][parentId] ??= {};
      currentStatus[ROOT_ID][parentId][rowId] = 'completado';

      currentData.academia ??= {};
      currentData.academia[parentId] ??= {};
      currentData.academia[parentId][rowId] = {
        ...(currentData.academia[parentId][rowId] || {}),
        status: 'completado',
        completedDate: today,
        updatedAt: now,
      };

      guardarProgresoAscensoMiembro({
        idMiembro: memberId,
        vinculo: {
          id: `academia_${parentId}_${rowId}`,
          idItemAscenso: rowId,
          nombreItemAscenso: dataFiltered.find((item) => item.id === rowId)?.name || rowId,
          sistema: 'academia',
          idDivision: '',
          nombreDivision: '',
          idGrupo: parentId,
          nombreGrupo: allData.find((item) => item.id === parentId)?.name || parentId,
          activo: true,
        },
        estado: 'completado',
        fechaCompletado: today,
        vecesCompletado: 1,
        user,
      }).catch(() => null);
    });

    setAwardsProgressCache(memberId, { status: currentStatus, data: currentData });
    notifyAwardsProgressChanged(memberId);
  };

  const containerRef = useRef(null);

  const shareDialog = useBoolean();
  const filesCollapse = useBoolean();
  const foldersCollapse = useBoolean();

  const newAwardsDialog = useBoolean();
  const newFolderDialog = useBoolean();

  const [folderName, setFolderName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const folders = dataFiltered.filter((item) => item.type === 'folder');
  const files = dataFiltered.filter((item) => item.type !== 'folder');

  const orderedItems = [...folders, ...files];

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
  );

  // const renderAwards = () => (
  //   <>
  //     {/* Desplegable */}
  //     {/* <FileManagerPanel
  //       title="Awards"
  //       subtitle={`${dataFiltered.filter((item) => item.type !== 'folder').length} awards`}
  //       onOpen={newAwardsDialog.onTrue}
  //       collapse={filesCollapse.value}
  //       onCollapse={filesCollapse.onToggle}
  //     /> */}

  //     <Collapse in={!filesCollapse.value} unmountOnExit>
  //       <Box
  //         sx={{
  //           gap: 2.5,
  //           display: 'grid',
  //           gridTemplateColumns: {
  //             xs: 'repeat(1, 1fr)',
  //             sm: 'repeat(2, 1fr)',
  //             md: 'repeat(3, 1fr)',
  //             lg: 'repeat(4, 1fr)',
  //           },
  //         }}
  //       >
  //         {dataFiltered
  //           .filter((i) => i.type !== 'folder')
  //           .map((file) => (
  //             <FileManagerFileItem
  //               isGridView
  //               key={file.id}
  //               file={{
  //                 ...file,
  //                 memberId: table.memberId,
  //                 parentId: parentId ?? file.parentId,

  //                 sectionId: file.sectionId ?? allData?.find((x) => x.id === (parentId ?? file.parentId))?.parentId,
  //                 parentId: file.parentId,


  //               }}
  //               selected={selected.includes(file.id)}
  //               onSelect={() => onSelectItem(file.id)}
  //               onDelete={() => onDeleteItem(file.id)}
  //             />

  //           ))}
  //       </Box>
  //     </Collapse>
  //   </>
  // );

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
          {orderedItems.map((item) =>
            item.type === 'folder' ? (
              <FileManagerFolderItem
                key={item.id}
                folder={{
                  ...item,
                  memberId: table.memberId,
                  allData,
                }}
                selected={selected.includes(item.id)}
                onSelect={() => onSelectItem(item.id)}
                onDelete={() => onDeleteItem(item.id)}
                onOpen={() => onOpenFolder?.(item.id)}
              />
            ) : (
              <FileManagerFileItem
                isGridView
                key={item.id}
                file={{
                  ...item,
                  memberId: table.memberId,
                  parentId: parentId ?? item.parentId,
                  systemSent: table.systemSent,
                  sectionId: table.sectionId,
                }}
                selected={selected.includes(item.id)}
                onSelect={() => onSelectItem(item.id)}
                onDelete={() => onDeleteItem(item.id)}
              />
            )
          )}


        </Box>

        {renderSelectedActions()}
      </Box>
      {renderShareDialog()}
      {renderUploadAwardsDialog()}
      {renderCreateFolderDialog()}
    </>
  );
}
