'use client';

import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useRouter, useSearchParams } from 'src/routes/hooks';

import { fIsAfter, fIsBetween } from 'src/utils/format-time';
import { isMemberSessionUser } from 'src/utils/member-access';

import { _folders, FILE_TYPE_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { getFirebaseStorageUsageSummary } from 'src/services/firebase-storage-usage-service';
import {
  listarArchivosGestorFirestore,
  eliminarArchivoGestorFirestore,
} from 'src/services/file-manager-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { detectFileFormat } from 'src/components/file-thumbnail';
import { useTable, rowInPage, getComparator } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { FileManagerTable } from '../file-manager-table';
import { FileManagerFilters } from '../file-manager-filters';
import { FileManagerGridView } from '../file-manager-grid-view';
import { FileManagerUploadDialog } from '../file-manager-upload-dialog';
import { FileManagerFiltersResult } from '../file-manager-filters-result';

// ----------------------------------------------------------------------

const getFolderFiles = (files, folderId) => files.filter((file) => file.parentId === folderId);

const getFilesSize = (files = []) =>
  files.reduce((total, file) => total + Number(file?.size || file?.tamano || 0), 0);

const buildFileManagerData = (files = []) => [
  ..._folders.map((folder) => {
    const folderFiles = getFolderFiles(files, folder.id);

    return {
      ...folder,
      size: getFilesSize(folderFiles),
      totalFiles: folderFiles.length,
    };
  }),
  ...files,
];

export function FileManagerView() {
  const { user } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get('folder');
  const isStorageSource = searchParams.get('source') === 'storage';
  const table = useTable({ defaultRowsPerPage: 10 });

  const dateRange = useBoolean();
  const confirmDialog = useBoolean();
  const newFilesDialog = useBoolean();

  const [displayMode, setDisplayMode] = useState(
    searchParams.get('view') === 'grid' ? 'grid' : 'list'
  );
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [storageFileManagerItems, setStorageFileManagerItems] = useState([]);
  const [storageLoading, setStorageLoading] = useState(false);

  const canDeleteFiles = Boolean(user) && !isMemberSessionUser(user);

  const tableData = useMemo(
    () => (isStorageSource ? storageFileManagerItems : buildFileManagerData(uploadedFiles)),
    [isStorageSource, storageFileManagerItems, uploadedFiles]
  );

  const filters = useSetState({
    name: '',
    type: [],
    startDate: null,
    endDate: null,
  });
  const { state: currentFilters } = filters;

  const dateError = fIsAfter(currentFilters.startDate, currentFilters.endDate);

  const currentFolder = tableData.find((item) => item.id === currentFolderId);
  const folderItems = tableData.filter((item) =>
    currentFolderId ? item.parentId === currentFolderId : !item.parentId
  );

  const dataFiltered = applyFilter({
    inputData: folderItems,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
    dateError,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name ||
    currentFilters.type.length > 0 ||
    (!!currentFilters.startDate && !!currentFilters.endDate);

  const notFound = !storageLoading && ((!dataFiltered.length && canReset) || !dataFiltered.length);

  useEffect(() => {
    if (isStorageSource) return undefined;

    let mounted = true;

    listarArchivosGestorFirestore()
      .then((files) => {
        if (mounted) {
          setUploadedFiles(files);
        }
      })
      .catch((error) => {
        console.error('No se pudieron cargar los archivos del gestor:', error);
      });

    return () => {
      mounted = false;
    };
  }, [isStorageSource]);

  useEffect(() => {
    if (!isStorageSource) {
      setStorageFileManagerItems([]);
      return undefined;
    }

    let mounted = true;

    setStorageLoading(true);
    getFirebaseStorageUsageSummary()
      .then((summary) => {
        if (mounted) {
          setStorageFileManagerItems(summary.fileManagerItems || summary.folders || []);
        }
      })
      .catch((error) => {
        console.error('No se pudo cargar el resumen de Firebase Storage:', error);
        if (mounted) {
          setStorageFileManagerItems([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setStorageLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isStorageSource]);

  const handleChangeView = useCallback((event, newView) => {
    if (newView !== null) {
      setDisplayMode(newView);
    }
  }, []);

  const handleDeleteItem = useCallback(
    (id) => {
      const itemToDelete = tableData.find((row) => row.id === id);

      if (!canDeleteFiles) {
        toast.error('Solo los administradores pueden eliminar archivos.');
        return;
      }

      if (itemToDelete?.type !== 'folder') {
        eliminarArchivoGestorFirestore(itemToDelete).catch((error) => {
          console.error('No se pudo eliminar el archivo de Firestore:', error);
        });

        setUploadedFiles((currentFiles) => currentFiles.filter((row) => row.id !== id));
      }

      toast.success('Eliminado correctamente.');

      table.onUpdatePageDeleteRow(dataInPage.length);
    },
    [canDeleteFiles, dataInPage.length, table, tableData]
  );

  const handleDeleteItems = useCallback(() => {
    if (!canDeleteFiles) {
      toast.error('Solo los administradores pueden eliminar archivos.');
      return;
    }

    const selectedFiles = tableData.filter(
      (row) => table.selected.includes(row.id) && row.type !== 'folder'
    );

    selectedFiles.forEach((file) => {
      eliminarArchivoGestorFirestore(file).catch((error) => {
        console.error('No se pudo eliminar el archivo de Firestore:', error);
      });
    });

    setUploadedFiles((currentFiles) =>
      currentFiles.filter((row) => !table.selected.includes(row.id))
    );

    toast.success('Eliminado correctamente.');

    table.onUpdatePageDeleteRows(dataInPage.length, dataFiltered.length);
  }, [canDeleteFiles, dataFiltered.length, dataInPage.length, table, tableData]);

  const handleUploadStart = useCallback((files) => {
    setUploadedFiles((currentFiles) => [...currentFiles, ...files]);
  }, []);

  const handleUploadComplete = useCallback((files, pendingIds = []) => {
    setUploadedFiles((currentFiles) => [
      ...currentFiles.filter((file) => !pendingIds.includes(file.id)),
      ...files,
    ]);
  }, []);

  const handleUploadError = useCallback((pendingIds = []) => {
    setUploadedFiles((currentFiles) =>
      currentFiles.filter((file) => !pendingIds.includes(file.id))
    );
  }, []);

  const handleOpenUpload = useCallback(() => {
    if (!currentFolderId) {
      toast.info('Entra a una carpeta antes de subir archivos.');
      return;
    }

    newFilesDialog.onTrue();
  }, [currentFolderId, newFilesDialog]);

  const handleBackToRoot = useCallback(() => {
    router.push(
      isStorageSource
        ? '/dashboard/file-manager/?source=storage&view=grid'
        : '/dashboard/file-manager/'
    );
  }, [isStorageSource, router]);

  const renderFilters = () => (
    <Box
      sx={{
        gap: 2,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-end', md: 'center' },
      }}
    >
      <FileManagerFilters
        filters={filters}
        dateError={dateError}
        onResetPage={table.onResetPage}
        openDateRange={dateRange.value}
        onOpenDateRange={dateRange.onTrue}
        onCloseDateRange={dateRange.onFalse}
        options={{ types: FILE_TYPE_OPTIONS }}
      />

      <ToggleButtonGroup size="small" value={displayMode} exclusive onChange={handleChangeView}>
        <ToggleButton value="list">
          <Iconify icon="solar:list-bold" />
        </ToggleButton>

        <ToggleButton value="grid">
          <Iconify icon="mingcute:dot-grid-fill" />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );

  const renderResults = () => (
    <FileManagerFiltersResult
      filters={filters}
      totalResults={dataFiltered.length}
      onResetPage={table.onResetPage}
    />
  );

  const renderUploadFilesDialog = () => (
    <FileManagerUploadDialog
      open={newFilesDialog.value}
      parentId={currentFolderId}
      onClose={newFilesDialog.onFalse}
      onUploadStart={handleUploadStart}
      onUploadError={handleUploadError}
      onUploadComplete={handleUploadComplete}
    />
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content={
        <>
          ¿Seguro que deseas eliminar <strong> {table.selected.length} </strong> elementos?
        </>
      }
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            handleDeleteItems();
            confirmDialog.onFalse();
          }}
        >
          Eliminar
        </Button>
      }
    />
  );

  const renderList = () =>
    displayMode === 'list' ? (
      <FileManagerTable
        table={table}
        dataFiltered={dataFiltered}
        onDeleteRow={handleDeleteItem}
        canDelete={canDeleteFiles}
        notFound={notFound}
        onOpenConfirm={confirmDialog.onTrue}
      />
    ) : (
      <FileManagerGridView
        table={table}
        dataFiltered={dataFiltered}
        onDeleteItem={handleDeleteItem}
        canDelete={canDeleteFiles}
        onOpenConfirm={confirmDialog.onTrue}
      />
    );

  return (
    <>
      <DashboardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
            {currentFolder && (
              <Button
                color="inherit"
                variant="outlined"
                startIcon={<Iconify icon="eva:arrow-back-fill" />}
                onClick={handleBackToRoot}
              >
                Volver
              </Button>
            )}

            <Typography variant="h4">
              {currentFolder ? currentFolder.name : 'Gestor de archivos'}
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<Iconify icon="eva:cloud-upload-fill" />}
            onClick={handleOpenUpload}
          >
            Subir
          </Button>
        </Box>

        <Stack spacing={2.5} sx={{ my: { xs: 3, md: 5 } }}>
          {renderFilters()}
          {canReset && renderResults()}
        </Stack>

        {storageLoading ? (
          <EmptyContent filled title="Cargando archivos..." sx={{ py: 10 }} />
        ) : notFound ? (
          <EmptyContent filled sx={{ py: 10 }} />
        ) : (
          renderList()
        )}
      </DashboardContent>

      {renderUploadFilesDialog()}
      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters, dateError }) {
  const { name, type, startDate, endDate } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter((file) => file.name.toLowerCase().includes(name.toLowerCase()));
  }

  if (type.length) {
    inputData = inputData.filter((file) => type.includes(detectFileFormat(file.type)));
  }

  if (!dateError) {
    if (startDate && endDate) {
      inputData = inputData.filter((file) => fIsBetween(file.createdAt, startDate, endDate));
    }
  }

  return inputData;
}
