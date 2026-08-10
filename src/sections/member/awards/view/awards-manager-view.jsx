'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBoolean, useSetState } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import { useTheme, useMediaQuery } from '@mui/material';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fIsAfter, fIsBetween } from 'src/utils/format-time';
import {
  isDestacamentoApprovalRole,
  canEditAcademiaMinisterial,
  isCoordinadorDestacamentoRole,
} from 'src/utils/member-access';

import { _awards } from 'src/_mock/_awards';
import { DashboardContent } from 'src/layouts/dashboard';
import { getAwardsProgressCache } from 'src/services/awards-progress-cache';
import { sincronizarProgresoAscensoFirebase } from 'src/services/member-awards-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { detectFileFormat } from 'src/components/file-thumbnail';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { useTable, rowInPage, getComparator } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { AwardsManagerTable } from '../awards-manager-table';
import { AwardsManagerFilters } from '../awards-manager-filters';
import { FileManagerFileItem } from '../awards-manager-file-item';
import { AwardsManagerGridView } from '../awards-manager-grid-view';
import { FileManagerFolderItem } from '../awards-manager-folder-item';
import { AwardsManagerFiltersResult } from '../awards-manager-filters-result';
import { useAwardsFolderNavigation } from '../hooks/use-awards-folder-navigation';
import { AwardsManagerCreateFolderDialog } from '../awards-manager-create-folder-dialog';

// ----------------------------------------------------------------------

// Se define como JSX (no como cadena con HTML) porque el `title` del Tooltip
// renderiza nodos, no marcado en texto plano.
const ASCENSO_AUDIT_NOTICE = (
  <>
    Los cambios realizados en Sistema de Ascenso{' '}
    <Box component="span" sx={{ textDecoration: 'underline' }}>
      se registrarán en el historial del miembro
    </Box>{' '}
    y serán visibles para administradores y coordinadores del destacamento{' '}
    <Box component="span" sx={{ textDecoration: 'underline' }}>
      con fines de auditoría
    </Box>
    . Además, se les enviará una notificación.
  </>
);

// Aviso de auditoría de Academia Ministerial. No menciona el certificado
// obligatorio: eso se comunica aparte, en el aviso fijo bajo el buscador.
const ACADEMIA_AUDIT_NOTICE = (
  <>
    Cada cambio en Academia Ministerial queda registrado en el historial del miembro:{' '}
    <Box component="span" sx={{ textDecoration: 'underline' }}>
      quién lo hizo, qué se agregó y cuándo
    </Box>
    . Es visible para administradores y coordinadores{' '}
    <Box component="span" sx={{ textDecoration: 'underline' }}>
      con fines de auditoría y veracidad
    </Box>
    , y se notificará a los Coordinadores de Adiestramiento y al Coordinador de Destacamento.
  </>
);

const normalizeSearchText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

  const { user } = useAuthContext();

  const table = useTable({ defaultRowsPerPage: 10 });
  const newAwardsDialog = useBoolean();

  const dateRange = useBoolean();
  const confirmDialog = useBoolean();
  // Aviso del certificado: en movil se muestra recortado y se despliega al pulsarlo.
  const noticeExpanded = useBoolean();
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
        await sincronizarProgresoAscensoFirebase(memberId);
      } catch {
        // Leave the current cache untouched if Firebase is temporarily unavailable.
      }

      if (!active) return;

      setStatusStorage(getAwardsProgressCache(memberId).status || {});
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

      setStatusStorage(getAwardsProgressCache(memberId).status || {});
    };

    window.addEventListener('awards-status-changed', syncLocalStatus);

    return () => {
      window.removeEventListener('awards-status-changed', syncLocalStatus);
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

  // Aviso de auditoría del Sistema de Ascenso: la pestaña completa es el módulo, así
  // que se muestra en cualquier carpeta de la vista. Lo ven todos los cargos de
  // nivel destacamento: el Coordinador titular y su Asistente
  // (`isCoordinadorDestacamentoRole`) más Pastor, Consejo, Capellán, Líder de Grupo
  // y Líder Asistente (`isDestacamentoApprovalRole`).
  const showAscensoAuditNotice =
    isCoordinadorDestacamentoRole(user) || isDestacamentoApprovalRole(user);

  // Academia Ministerial tiene permisos de edicion PROPIOS (cargos de
  // destacamento, seccion y region), distintos de los del Sistema de Ascenso. Por
  // eso el `readOnly` que llega de la pagina solo manda fuera de Academia.
  const isAcademiaContext = isAcademiaMinisterial || isAcademiaSubFolder;
  const canEditAcademia = canEditAcademiaMinisterial(user);
  const effectiveReadOnly = isAcademiaContext ? !canEditAcademia : readOnly;
  // Dentro de la rama de destacamento, todos menos el Coordinador y su Asistente
  // envian los cambios de Academia a aprobacion de ambos.
  // El aviso del certificado obligatorio solo tiene sentido donde se registran los
  // adiestramientos (subcarpeta de Academia) y para quien puede editarlos.
  const showCertificateRequiredNotice = isAcademiaSubFolder && canEditAcademia;

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

  // Conteo por estado dentro de la carpeta/pestaña actual (antes de aplicar el
  // propio filtro de estado), para mostrarlo en el desplegable "Estado" y
  // deshabilitar las opciones sin coincidencias.
  const statusCounts = dataWithStatus.reduce(
    (acc, item) => {
      const realStatus = item.status;
      const key =
        realStatus === 'completado' || realStatus === 'en_progreso' ? realStatus : 'no_iniciado';
      acc[key] += 1;
      return acc;
    },
    { completado: 0, en_progreso: 0, no_iniciado: 0 }
  );

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

  const searchTerm = normalizeSearchText(currentFilters.name);
  const isGlobalSearch = Boolean(searchTerm);
  const globalSearchResults = isGlobalSearch
    ? tableData.filter((item) => normalizeSearchText(item.name).includes(searchTerm))
    : [];

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

      toast.success('Elemento eliminado.');

      setTableData(deleteRow);

      table.onUpdatePageDeleteRow(dataInPage.length);
    },
    [dataInPage.length, table, tableData]
  );

  const handleDeleteItems = useCallback(() => {
    if (readOnly) return;
    const deleteRows = tableData.filter((row) => !table.selected.includes(row.id));

    toast.success('Elementos eliminados.');

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
          statusCounts={statusCounts}
          auditNotice={
            isAcademiaContext
              ? canEditAcademia
                ? ACADEMIA_AUDIT_NOTICE
                : null
              : showAscensoAuditNotice
                ? ASCENSO_AUDIT_NOTICE
                : null
          }
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
      totalResults={isGlobalSearch ? globalSearchResults.length : dataFiltered.length}
      onResetPage={table.onResetPage}
      showStatusFilter={showStatusFilter}
    />
  );

  // Aviso permanente bajo el buscador: en Academia Ministerial el certificado es
  // obligatorio para dar por completado un adiestramiento. Se muestra solo a quien
  // puede editar (a un cargo de consulta no le aporta nada).
  const renderCertificateRequiredNotice = () => (
    <Alert
      severity="info"
      // En movil se omite el icono: el ancho es escaso y el texto ya recortado
      // gana el espacio que ocupaba.
      icon={isMobile ? false : <Iconify icon="solar:diploma-verified-bold" />}
      sx={{ alignItems: 'center' }}
    >
      <Box
        // En movil el aviso ocupa demasiado alto, asi que se recorta a tres
        // lineas con puntos suspensivos y se despliega/pliega al pulsarlo. En
        // escritorio cabe entero, asi que no se recorta ni es pulsable.
        onClick={isMobile ? noticeExpanded.onToggle : undefined}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-expanded={isMobile ? noticeExpanded.value : undefined}
        onKeyDown={
          isMobile
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  noticeExpanded.onToggle();
                }
              }
            : undefined
        }
        sx={{
          ...(isMobile && {
            cursor: 'pointer',
            ...(!noticeExpanded.value && {
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
            }),
          }),
        }}
      >
        Para registrar un adiestramiento de Academia Ministerial como <strong>Completado</strong> primero debes adjuntar
        el certificado. Adicionalmente, se enviará una notificación con el <strong>primer documento</strong> cargado.
      </Box>
    </Alert>
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
            ¿Seguro que deseas eliminar <strong> {table.selected.length} </strong>
            {table.selected.length === 1 ? 'elemento' : 'elementos'}?
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
          readOnly={effectiveReadOnly}
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
          readOnly={effectiveReadOnly}
        />
      </Box>
    </Box>
  );

  const getSearchResultContext = (item) => {
    let current = item;
    let rootId = item.id;
    let ascensoSectionId;

    while (current?.parentId) {
      const parent = tableData.find((candidate) => candidate.id === current.parentId);
      if (!parent) break;

      if (parent.parentId === SISTEMA_ASCENSO_ID) {
        ascensoSectionId = parent.id;
      }

      current = parent;
      rootId = parent.id;
    }

    return {
      systemSent: rootId === SISTEMA_ASCENSO_ID ? 'sistemaAscenso' : 'academia',
      sectionId: ascensoSectionId,
    };
  };

  const renderGlobalSearchResults = () => (
    <Box
      sx={{
        gap: 2.5,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(1, 1fr)',
          sm: displayMode === 'list' ? 'repeat(1, 1fr)' : 'repeat(2, 1fr)',
          md: displayMode === 'list' ? 'repeat(1, 1fr)' : 'repeat(3, 1fr)',
          lg: displayMode === 'list' ? 'repeat(1, 1fr)' : 'repeat(4, 1fr)',
        },
      }}
    >
      {globalSearchResults.map((item, index) => {
        const context = getSearchResultContext(item);
        const resultKey = `${item.parentId || 'root'}:${item.id}:${index}`;

        return item.type === 'folder' ? (
          <FileManagerFolderItem
            key={resultKey}
            folder={{ ...item, memberId, allData: tableData }}
            selected={false}
            onSelect={() => { }}
            onDelete={() => { }}
            onOpen={() => {
              filters.setState({ name: '' });
              openFolder(item.id);
            }}
          />
        ) : (
          <FileManagerFileItem
            isGridView={displayMode === 'grid'}
            key={resultKey}
            file={{ ...item, memberId, ...context }}
            selected={false}
            onSelect={() => { }}
            onDelete={() => { }}
            readOnly={readOnly}
            inlineDetails={displayMode === 'list'}
          />
        );
      })}
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
          {showCertificateRequiredNotice && renderCertificateRequiredNotice()}
          {canReset && renderResults()}
        </Stack>

        {isGlobalSearch ? (
          globalSearchResults.length ? (
            <Box key={`global-search:${searchTerm}`}>{renderGlobalSearchResults()}</Box>
          ) : (
            <EmptyContent key={`empty-search:${searchTerm}`} filled sx={{ py: 10 }} />
          )
        ) : notFound ? (
          <EmptyContent key="empty-folder" filled sx={{ py: 10 }} />
        ) : (
          <Box key={`folder:${normalizedFolder || 'root'}`}>{renderFolderContent()}</Box>
        )}
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
      // "no iniciado" no se guarda en el storage (ausencia de estado = no iniciado),
      // por eso se normaliza aquí antes de comparar contra la selección. Con
      // varios estados seleccionados a la vez, el item debe coincidir con
      // CUALQUIERA de ellos (OR), no solo con "no_iniciado" cuando está presente.
      const normalizedStatus =
        file.status === 'completado' || file.status === 'en_progreso'
          ? file.status
          : 'no_iniciado';

      return status.includes(normalizedStatus);
    });
  }

  if (!dateError) {
    if (startDate && endDate) {
      inputData = inputData.filter((file) => fIsBetween(file.createdAt, startDate, endDate));
    }
  }

  return inputData;
}
