'use client';

import { useState , useEffect, useCallback } from 'react';
import { useBoolean, useSetState } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import { useTheme, useMediaQuery } from '@mui/material';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fIsAfter, fIsBetween } from 'src/utils/format-time';

import { _awards } from 'src/_mock/_awards';
import { DashboardContent } from 'src/layouts/dashboard';
import { sincronizarProgresoAscensoLocal } from 'src/services/member-awards-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { detectFileFormat } from 'src/components/file-thumbnail';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { useTable, rowInPage, getComparator } from 'src/components/table';

import { AwardsManagerTable } from '../awards-manager-table';
import { AwardsManagerFilters } from '../awards-manager-filters';
import { AwardsManagerGridView } from '../awards-manager-grid-view';
import { AwardsManagerFiltersResult } from '../awards-manager-filters-result';
import { useAwardsFolderNavigation } from '../hooks/use-awards-folder-navigation';
import { AwardsManagerCreateFolderDialog } from '../awards-manager-create-folder-dialog';

// ----------------------------------------------------------------------

export function AwardsManagerView({ memberId, readOnly = false }) {
  const ROOT_TABLE_HEAD = [
    { id: 'program', label: 'Programa' },
    { id: 'target', label: 'Dirigido a', width: 160 },
    { id: 'total', label: 'Adiestramientos', width: 180 },
    { id: 'completed', label: 'Completados', width: 140 },
    { id: 'updatedAt', label: 'Última actualización', width: 200 },
    { id: '', width: 88 },
  ];

  const ACADEMIA_SUBFOLDER_HEAD = [
    { id: 'training', label: 'Adiestramiento' },
    { id: 'status', label: 'Estado', width: 140 },
    { id: 'completedDate', label: 'Completado en fecha', width: 160 },
    // { id: 'description', label: 'Descripción', width: 140 },
    { id: 'certificate', label: 'Certificado', width: 130 },
    { id: '', width: 88 },
  ];

  const SISTEMA_ASCENSO_SUBFOLDER_HEAD = [
    { id: 'awardName', label: 'Premio', width: 150 },
    { id: 'total', label: 'Cantidad premios', width: 150 },
    { id: 'completedDate', label: 'Completados', width: 100 },
    { id: 'updatedAt', label: 'Última actualización', width: 190 },
    // { id: 'certificate', label: 'Certificado', width: 140 },
    { id: '', width: 88 },
  ];

  const table = useTable({ defaultRowsPerPage: 10 });
  const newAwardsDialog = useBoolean();

  const dateRange = useBoolean();
  const confirmDialog = useBoolean();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  useEffect(() => {
    if (isMobile) {
      setDisplayMode('grid');
      table.setDense(true); // activar vista compacta
    } else {
      setDisplayMode('list');
      table.setDense(false); // desactivar compacta
    }
  }, [isMobile]);

  const [displayMode, setDisplayMode] = useState('list');
  const [renderMode, setRenderMode] = useState('list');
  const [tableData, setTableData] = useState(_awards);
  const [statusStorage, setStatusStorage] = useState({});
  const [activeInput, setActiveInput] = useState(null);
  const [delayedActiveInput, setDelayedActiveInput] = useState(null);

  const { currentFolder, folderBreadcrumbs, openFolder } = useAwardsFolderNavigation({
    table,
    awardFolders: tableData,
  });

  useEffect(() => {
    if (!isMobile) {
      setDelayedActiveInput(null);
      return undefined;
    }

    if (activeInput) {
      setDelayedActiveInput(activeInput);
    } else {
      const timeout = setTimeout(() => {
        setDelayedActiveInput(null);
      }, 1);

      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [activeInput, isMobile]);

  useEffect(() => {
    let active = true;

    const loadProgress = async () => {
      if (typeof window === 'undefined' || !memberId) return;

      try {
        await sincronizarProgresoAscensoLocal(memberId);
      } catch (error) {
        console.error('[Awards] No se pudo sincronizar el progreso desde Firebase.', error);
      }

      if (!active) return;

      const stored = JSON.parse(localStorage.getItem(`awards-status-${memberId}`) || '{}');
      setStatusStorage(stored);
    };

    loadProgress();

    return () => {
      active = false;
    };
  }, [memberId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !memberId) return undefined;

    const syncLocalStatus = (event) => {
      if (event?.detail?.memberId && String(event.detail.memberId) !== String(memberId)) return;

      const stored = JSON.parse(localStorage.getItem(`awards-status-${memberId}`) || '{}');
      setStatusStorage(stored);
    };

    window.addEventListener('awards-status-changed', syncLocalStatus);
    window.addEventListener('storage', syncLocalStatus);

    return () => {
      window.removeEventListener('awards-status-changed', syncLocalStatus);
      window.removeEventListener('storage', syncLocalStatus);
    };
  }, [memberId]);

  const filters = useSetState({
    name: '',
    type: [],
    status: [],
    startDate: null,
    endDate: null,
  });
  const { state: currentFilters } = filters;

  const dateError = fIsAfter(currentFilters.startDate, currentFilters.endDate);

  const normalizedFolder = currentFolder?.toString().trim();

  const isRootFolder = !normalizedFolder;

  const ACADEMIA_MINISTERIAL_ID = 'academia-ministerial';
  const SISTEMA_ASCENSO_ID = 'sistema-de-ascenso';
  const sistemaAscensoIndex = folderBreadcrumbs.findIndex((b) => b.name === 'Sistema de Ascenso');

  const isAcademiaMinisterial = normalizedFolder === ACADEMIA_MINISTERIAL_ID;
  const isAcademiaSubFolder =
    !!normalizedFolder &&
    !isAcademiaMinisterial &&
    tableData.some(
      (item) => item.id === normalizedFolder && item.parentId === ACADEMIA_MINISTERIAL_ID
    );

  const isSistemaAscenso = normalizedFolder === SISTEMA_ASCENSO_ID;
  const isSistemaAscensoRootFolder = normalizedFolder === SISTEMA_ASCENSO_ID;

  const isSistemaAscensoSubFolder =
    sistemaAscensoIndex !== -1 && folderBreadcrumbs.length === sistemaAscensoIndex + 2;

  const isSistemaAscensoDeepSubFolder =
    sistemaAscensoIndex !== -1 && folderBreadcrumbs.length >= sistemaAscensoIndex + 3;
  const showStatusFilter = isAcademiaSubFolder || isSistemaAscensoDeepSubFolder;

  useEffect(() => {
    if (!showStatusFilter && currentFilters.status?.length) {
      filters.setState({ status: [] });
      table.onResetPage();
    }
  }, [currentFilters.status, filters, showStatusFilter, table]);

  const SISTEMA_ASCENSO_DEEP_SUBFOLDER_HEAD = [
    { id: 'award', label: 'Premio', width: 50 },
    { id: 'status', label: 'Estado', width: 100 },
    { id: 'completedDate', label: 'Completado en fecha', width: 100 },
    { id: 'timesCompleted', label: 'N.° de veces', width: 120 },
    { id: 'certificate', label: 'Certificado', width: 50 },
    { id: '', width: 88 },
  ];

  const tableHead = isSistemaAscensoDeepSubFolder
    ? SISTEMA_ASCENSO_DEEP_SUBFOLDER_HEAD
    : isSistemaAscensoSubFolder
      ? SISTEMA_ASCENSO_SUBFOLDER_HEAD
      : isSistemaAscenso
        ? [
            { id: 'division', label: 'División', width: 180 },
            // { id: 'target', label: 'Dirigidos a', width: 120 },
            { id: 'total', label: 'Cantidad Premios', width: 180 },
            { id: 'completed', label: 'Completados', width: 160 },
            { id: 'updatedAt', label: 'Última actualización', width: 200 },
            { id: '', width: 88 },
          ]
        : isAcademiaSubFolder
          ? ACADEMIA_SUBFOLDER_HEAD
          : isAcademiaMinisterial
            ? [
                { id: 'program', label: 'Programa' },
                // target en acaMinow{ id: 'required', label: 'Requerido', width: 140 },
                { id: 'total', label: 'Cantidad adiestramientos', width: 240 },
                { id: 'completed', label: 'Completados', width: 180 },
                { id: 'updatedAt', label: 'Última actualización', width: 200 },
                { id: '', width: 88 },
              ]
            : isRootFolder
              ? ROOT_TABLE_HEAD
              : undefined;

  const dataByFolder = tableData.filter((item) =>
    normalizedFolder ? item.parentId === normalizedFolder : item.parentId == null
  );

  // INYECTAR STATUS EN CADA ITEM
  const dataWithStatus = dataByFolder.map((item) => {
    const systemKey = isSistemaAscenso ? 'sistemaAscenso' : 'academia';

    let realStatus = null;

    if (isSistemaAscensoDeepSubFolder) {
      const divisionId = folderBreadcrumbs[sistemaAscensoIndex + 1]?.id;
      realStatus =
        statusStorage?.sistemaAscenso?.[divisionId]?.[normalizedFolder]?.[item.id] ?? null;
    } else {
      realStatus = statusStorage?.[systemKey]?.[normalizedFolder]?.[item.id] ?? null;
    }

    return {
      ...item,
      status: realStatus,
    };
  });

  const dataFiltered = applyFilter({
    inputData: dataWithStatus,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
    dateError,
    showStatusFilter,
  });

  const dataWithStats = dataFiltered.map((item) => ({
    ...item,
    memberId,
    totalFiles: item.total ?? 0,
    completed: item.completed ?? 0,
  }));

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name ||
    currentFilters.type.length > 0 ||
    (showStatusFilter && currentFilters.status?.length > 0) ||
    (!!currentFilters.startDate && !!currentFilters.endDate);

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const handleChangeView = useCallback((event, newView) => {
    if (newView !== null) {
      setDisplayMode(newView);
    }
  }, []);

  const handleDeleteItem = useCallback(
    (id) => {
      if (readOnly) return;
      const deleteRow = tableData.filter((row) => row.id !== id);

      toast.success('Delete success!');

      setTableData(deleteRow);

      table.onUpdatePageDeleteRow(dataInPage.length);
    },
    [dataInPage.length, table, tableData]
  );

  const handleDeleteItems = useCallback(() => {
    if (readOnly) return;
    const deleteRows = tableData.filter((row) => !table.selected.includes(row.id));

    toast.success('Delete success!');

    setTableData(deleteRows);

    table.onUpdatePageDeleteRows(dataInPage.length, dataFiltered.length);
  }, [dataFiltered.length, dataInPage.length, table, tableData]);

  const renderFilters = () => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: 1,
      }}
    >
      {/* SEARCH */}
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        <AwardsManagerFilters
          filters={filters}
          dateError={dateError}
          onResetPage={table.onResetPage}
          openDateRange={dateRange.value}
          onCloseDateRange={dateRange.onFalse}
          activeInput={activeInput}
          setActiveInput={setActiveInput}
          showStatusFilter={showStatusFilter}
        />
      </Box>

      {/* TOGGLE */}
      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ToggleButtonGroup
          size="small"
          value={displayMode}
          exclusive
          onChange={handleChangeView}
          //tamaño toggle
          sx={{
            flexDirection: { xs: 'row-reverse', md: 'row' },
            '& .MuiToggleButton-root': {
              minWidth: 44, // ancho
              height: 44, // alto
              padding: 0, // elimina padding interno
            },

            '& .MuiSvgIcon-root, & svg': {
              fontSize: 20, // icono proporcional
            },
          }}
        >
          {!delayedActiveInput && (
            <ToggleButton
              value="list"
              sx={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',

                opacity: delayedActiveInput ? 0 : 1,
                transform: delayedActiveInput ? 'scale(0.9)' : 'scale(1)',
                pointerEvents: delayedActiveInput ? 'none' : 'auto',

                transition: 'opacity 300ms ease, transform 300ms ease',
              }}
            >
              <Iconify icon="solar:list-bold" />
            </ToggleButton>
          )}

          <ToggleButton value="grid">
            <Iconify icon="mingcute:dot-grid-fill" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );

  const renderResults = () => (
    <AwardsManagerFiltersResult
      filters={filters}
      totalResults={dataFiltered.length}
      onResetPage={table.onResetPage}
      showStatusFilter={showStatusFilter}
    />
  );

  const renderUploadAwardsDialog = () =>
    readOnly ? null : (
      <AwardsManagerCreateFolderDialog
        open={newAwardsDialog.value}
        onClose={newAwardsDialog.onFalse}
      />
    );

  const renderConfirmDialog = () =>
    readOnly ? null : (
      <ConfirmDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
        title="Eliminar"
        content={
          <>
            Are you sure want to delete <strong> {table.selected.length} </strong> items?
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
            Delete
          </Button>
        }
      />
    );

  const renderFolderContent = () => (
      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            opacity: displayMode === 'list' ? 1 : 0,
            transform: displayMode === 'list' ? 'translateX(0)' : 'translateX(-10px)',
            transition: 'opacity 300ms ease, transform 300ms ease',
            position: displayMode === 'list' ? 'relative' : 'absolute',
            width: 1,
          }}
        >
          <AwardsManagerTable
            memberId={memberId}
            table={table}
            dataFiltered={dataFiltered}
            allData={tableData}
            headCells={tableHead}
            isRootFolder={isRootFolder}
            isAcademiaSubFolder={isAcademiaSubFolder}
            isSistemaAscensoSubFolder={isSistemaAscensoSubFolder}
            isSistemaAscensoDeepSubFolder={isSistemaAscensoDeepSubFolder}
            isSistemaAscenso={isSistemaAscenso}
            onDeleteRow={handleDeleteItem}
            notFound={notFound}
            onOpenConfirm={confirmDialog.onTrue}
          />
        </Box>

        <Box
          sx={{
            opacity: displayMode === 'grid' ? 1 : 0,
            transform: displayMode === 'grid' ? 'translateX(0)' : 'translateX(10px)',
            transition: 'opacity 300ms ease, transform 300ms ease',
            position: displayMode === 'grid' ? 'relative' : 'absolute',
            width: 1,
          }}
        >
          <AwardsManagerGridView
            table={{
              ...table,
              memberId,
              parentId: normalizedFolder,
              systemSent:
                isSistemaAscenso || isSistemaAscensoSubFolder || isSistemaAscensoDeepSubFolder
                  ? 'sistemaAscenso'
                  : 'academia',
              sectionId: isSistemaAscensoDeepSubFolder
                ? folderBreadcrumbs[sistemaAscensoIndex + 1]?.id
                : undefined,
            }}
            dataFiltered={dataWithStats}
            allData={tableData}
            onDeleteItem={handleDeleteItem}
            onOpenConfirm={confirmDialog.onTrue}
            onOpenFolder={openFolder}
          />
        </Box>
      </Box>
    );

  return (
    <>
      <DashboardContent>
        <Box sx={{ mt: -3, mb: -1 }}>
          <CustomBreadcrumbs
            links={[{ name: 'Premios', href: '?folder=' }, ...folderBreadcrumbs]}
          />
        </Box>

        <Stack spacing={2.5} sx={{ my: { xs: 3, md: 5 } }}>
          {renderFilters()}
          {canReset && renderResults()}
        </Stack>

        {notFound ? <EmptyContent filled sx={{ py: 10 }} /> : renderFolderContent()}
      </DashboardContent>
      {renderUploadAwardsDialog()}
      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters, dateError, showStatusFilter = true }) {
  const { name, type, status, startDate, endDate } = filters;

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

  if (showStatusFilter && status?.length) {
    inputData = inputData.filter((file) => {
      const realStatus = file.status;

      // 🔥 Si están filtrando "no_iniciado". Esto se hace porque "no iniciado" no está en local storage
      if (status.includes('no_iniciado')) {
        return realStatus !== 'completado' && realStatus !== 'en_progreso';
      }

      // 🔥 Si están filtrando completado o en_progreso
      return status.includes(realStatus);
    });
  }

  if (!dateError) {
    if (startDate && endDate) {
      inputData = inputData.filter((file) => fIsBetween(file.createdAt, startDate, endDate));
    }
  }

  return inputData;
}
