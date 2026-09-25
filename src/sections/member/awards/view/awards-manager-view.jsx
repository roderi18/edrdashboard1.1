'use client';

import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback, useDeferredValue } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import { useTheme, useMediaQuery } from '@mui/material';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fIsAfter, fIsBetween } from 'src/utils/format-time';
import { esCarpetaDePremios } from 'src/utils/insignias-de-premios.mjs';
import { resumirProgresoDeAscenso } from 'src/utils/progreso-de-ascenso.mjs';
import {
  isDestacamentoApprovalRole,
  canEditAcademiaMinisterial,
  isCoordinadorDestacamentoRole,
} from 'src/utils/member-access';

import { _awards } from 'src/_mock/_awards';
import { DashboardContent } from 'src/layouts/dashboard';
import { sincronizarProgresoAscensoFirebase } from 'src/services/member-awards-service';
import { hayProgresoEnCache, getAwardsProgressCache } from 'src/services/awards-progress-cache';

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
import { AwardsProgressSummary } from '../awards-progress-summary';
import { AwardsManagerGridView } from '../awards-manager-grid-view';
import { FileManagerFolderItem } from '../awards-manager-folder-item';
import { buildStatusChangeMessage } from '../utils/status-change-message';
import { AwardsManagerFiltersResult } from '../awards-manager-filters-result';
import { AwardsManagerCreateFolderDialog } from '../awards-manager-create-folder-dialog';
import { irACarpeta, useAwardsFolderNavigation } from '../hooks/use-awards-folder-navigation';
import {
  imagenDelPremio,
  HUECO_DE_INSIGNIAS,
  COLUMNAS_DE_INSIGNIAS,
} from '../awards-insignia-item';
import {
  varianteDeCarpeta,
  SX_PREMIOS_EN_FICHA,
  AwardsManagerSkeleton,
} from '../awards-manager-skeleton';
import {
  createAwardsActions,
  completarPremiosAscenso,
  cambiarEstadoPremiosAscenso,
} from '../components/core/AwardsActionsCore';

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

// ORDEN NATURAL: "1, 2, 3… 10, 11… 100", no "1, 10, 100, 101, 2". El orden de la
// tabla compara texto letra a letra y los premios numerados (Retos Espirituales,
// lecciones, trimestres, "SS-A1T1S2") salían saltados. Sin mayúsculas ni tildes.
const ordenNatural = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const comparadorNatural = (order, orderBy) => {
  const base = getComparator(order, orderBy);

  return (a, b) => {
    const valorA = a?.[orderBy];
    const valorB = b?.[orderBy];
    if (typeof valorA !== 'string' || typeof valorB !== 'string') return base(a, b);

    const resultado = ordenNatural.compare(valorA, valorB);
    return order === 'desc' ? -resultado : resultado;
  };
};

const normalizeSearchText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function AwardsManagerView({ memberId, readOnly = false, enFicha = false }) {
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
    // Cuadrícula por defecto en todas las pantallas (la lista sigue a un clic);
    // en el móvil, además, la tabla compacta por si se cambia a lista.
    setDisplayMode('grid');
    table.setDense(isMobile);
  }, [isMobile]);

  const [displayMode, setDisplayMode] = useState('grid');
  const [renderMode, setRenderMode] = useState('list');
  const [tableData, setTableData] = useState(_awards);
  // Se arranca con lo que ya hay en memoria: volver a la pestaña (o saltar de
  // carpeta) pinta al momento, y la lectura de Firestore solo lo refresca.
  // Antes arrancaba vacío y la tabla enseñaba ceros hasta que llegaba.
  const [statusStorage, setStatusStorage] = useState(
    () => getAwardsProgressCache(memberId).status || {}
  );
  // Sin nada en memoria (primera visita a este miembro en la sesión), esqueleto
  // hasta la primera lectura en vez de cifras a cero.
  const [progresoListo, setProgresoListo] = useState(() => hayProgresoEnCache(memberId));
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
      // También si falló: mejor la tabla sin progreso que un esqueleto eterno.
      setProgresoListo(true);
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

      // Copia: las acciones cambian el MISMO objeto del caché y lo vuelven a
      // guardar. Con la misma referencia React no repintaba, y un premio recién
      // completado no enseñaba su check hasta recargar.
      setStatusStorage({ ...(getAwardsProgressCache(memberId).status || {}) });
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

  // Un `?folder=` que no está en el catálogo (enlace viejo, mal copiado, o un
  // premio renombrado) dejaba la pestaña vacía y sin migas para volver: se abre
  // la raíz en su lugar.
  const carpetaPedida = currentFolder?.toString().trim();
  const normalizedFolder =
    carpetaPedida && tableData.some((item) => item.id === carpetaPedida && item.type === 'folder')
      ? carpetaPedida
      : '';

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
  // Academia tiene su propio permiso, pero el alcance manda igual: si la ficha
  // llega en solo lectura —porque el miembro es de otro destacamento— tampoco se
  // toca Academia.
  const effectiveReadOnly = readOnly || (isAcademiaContext && !canEditAcademia);
  // Dentro de la rama de destacamento, todos menos el Coordinador y su Asistente
  // envian los cambios de Academia a aprobacion de ambos.
  // El aviso del certificado obligatorio solo tiene sentido donde se registran los
  // adiestramientos (subcarpeta de Academia) y para quien puede editarlos.
  const showCertificateRequiredNotice = isAcademiaSubFolder && canEditAcademia;

  // La selección es de la carpeta en que se hizo: al cambiar de carpeta se
  // vacía, para que "Completar" nunca actúe sobre premios que no se ven.
  // Y cada carpeta abre en cuadrícula: pasar a lista en una no arrastra la
  // lista a las siguientes (antes se quedaba en todas).
  useEffect(() => {
    table.onSelectAllRows(false, []);
    setDisplayMode('grid');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedFolder]);

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
    let tieneCertificado = false;
    let vecesGanado = 0;

    if (isSistemaAscensoDeepSubFolder) {
      const divisionId = folderBreadcrumbs[sistemaAscensoIndex + 1]?.id;
      realStatus =
        statusStorage?.sistemaAscenso?.[divisionId]?.[normalizedFolder]?.[item.id] ?? null;
      // Para el check de la insignia: completado sin certificado va en amarillo.
      // Y las veces ganado, para el "x2" de debajo del nombre.
      const nodo =
        getAwardsProgressCache(memberId).data?.sistemaAscenso?.[divisionId]?.[normalizedFolder]?.[
          item.id
        ];
      tieneCertificado = Boolean(nodo?.certificate);
      vecesGanado = Number(nodo?.timesCompleted) || (realStatus === 'completado' ? 1 : 0);
    } else {
      realStatus = statusStorage?.[systemKey]?.[normalizedFolder]?.[item.id] ?? null;
      // Academia: el certificado da el color del check (en Academia no hay
      // "veces ganado": el "x2" no sale).
      if (isAcademiaSubFolder) {
        tieneCertificado = Boolean(
          getAwardsProgressCache(memberId).data?.academia?.[normalizedFolder]?.[item.id]?.certificate
        );
      }
    }

    return {
      ...item,
      status: realStatus,
      tieneCertificado,
      vecesGanado,
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
    comparator: comparadorNatural(table.order, table.orderBy),
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

  // Solo en la pantalla inicial se busca en TODO el árbol de premios. Dentro de
  // una carpeta, el buscador filtra lo de esa carpeta (lo hace `applyFilter`):
  // antes buscaba siempre en todo y, dentro de "Destreza - Verde", salían premios
  // de otras divisiones mezclados.
  //
  // Instantáneo: el campo se actualiza en el acto y la búsqueda en el árbol
  // (cientos de premios y sus tarjetas) va con `useDeferredValue`, por detrás;
  // mientras se pone al día, esqueleto. Los nombres se normalizan una sola vez.
  const searchTerm = normalizeSearchText(currentFilters.name);
  const terminoBuscado = normalizeSearchText(useDeferredValue(currentFilters.name));
  const isGlobalSearch = Boolean(searchTerm) && isRootFolder;
  const buscando = isGlobalSearch && terminoBuscado !== searchTerm;
  const nombresNormalizados = useMemo(
    () => tableData.map((item) => [item, normalizeSearchText(item.name)]),
    [tableData]
  );
  const globalSearchResults = useMemo(
    () =>
      isRootFolder && terminoBuscado
        ? nombresNormalizados
            .filter(([, nombre]) => nombre.includes(terminoBuscado))
            .map(([item]) => item)
            .sort((a, b) => ordenNatural.compare(a.name, b.name))
        : [],
    [isRootFolder, terminoBuscado, nombresNormalizados]
  );

  // Resumen de la raíz: se recalcula con el mismo `statusStorage` que pinta la
  // tabla, así que al marcar un adiestramiento se mueve a la vez que su fila.
  const resumenDeProgreso = useMemo(
    () => resumirProgresoDeAscenso(tableData, statusStorage),
    [tableData, statusStorage]
  );

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

  // SELECCIÓN MÚLTIPLE en las carpetas con insignia: Ctrl/Cmd + clic marca
  // tarjetas y "Completar" las completa todas de una vez (`completarPremiosAscenso`:
  // un solo repintado y Firestore en paralelo). Completar no pide aprobación ni
  // certificado en el Sistema de Ascenso, igual que uno a uno.
  const seleccionConInsignia =
    isSistemaAscensoDeepSubFolder &&
    esCarpetaDePremios(normalizedFolder, tableData) &&
    !effectiveReadOnly;
  const premiosSeleccionados = seleccionConInsignia
    ? dataWithStatus.filter((item) => item.type !== 'folder' && table.selected.includes(item.id))
    : [];
  const porCompletar = premiosSeleccionados.filter((item) => item.status !== 'completado');

  const yaCompletados = premiosSeleccionados.filter((item) => item.status === 'completado');
  // Todo lo elegido ya está completado: el botón pasa a "Quitar completado".
  const modoQuitar = premiosSeleccionados.length > 0 && !porCompletar.length;
  const quitarDialog = useBoolean();
  const [enviandoLote, setEnviandoLote] = useState(false);
  const necesitaAprobacion = isDestacamentoApprovalRole(user);

  const datosDelLote = (items) => {
    const sectionId = folderBreadcrumbs[sistemaAscensoIndex + 1]?.id;
    const nombreGrupo = folderBreadcrumbs[folderBreadcrumbs.length - 1]?.name;

    return items.map((item) => ({
      sectionId,
      parentId: normalizedFolder,
      rowId: item.id,
      metadata: {
        nombreItemAscenso: item.name,
        idGrupo: normalizedFolder,
        nombreGrupo,
        idDivision: sectionId,
        nombreDivision: folderBreadcrumbs[sistemaAscensoIndex + 1]?.name,
      },
    }));
  };

  const avisarSiFallo = async (fallidos, cuantos) => {
    if (!fallidos) return;
    toast.error(`No se pudieron guardar ${fallidos} de ${cuantos}. Se vuelve a leer lo guardado.`);
    await sincronizarProgresoAscensoFirebase(memberId, { fresco: true }).catch(() => null);
  };

  // Completar: al instante en pantalla; Firestore en paralelo por detrás.
  const completarSeleccion = async () => {
    const cuantos = porCompletar.length;
    const premios = datosDelLote(porCompletar);

    table.onSelectAllRows(false, []);
    toast.success(cuantos === 1 ? '1 premio completado.' : `${cuantos} premios completados.`);

    const { fallidos } = await completarPremiosAscenso({ memberId, user, premios });
    await avisarSiFallo(fallidos, cuantos);
  };

  // Quitar el completado de varios: la misma regla que uno a uno. Siempre con
  // aviso; el Coordinador de Destacamento y su Asistente lo aplican al
  // confirmar (y se borra el certificado que hubiera), los demás cargos envían
  // una solicitud por premio y el estado no cambia hasta que se apruebe.
  const quitarSeleccion = async () => {
    const cuantos = yaCompletados.length;
    const premios = datosDelLote(yaCompletados);

    if (!necesitaAprobacion) {
      quitarDialog.onFalse();
      table.onSelectAllRows(false, []);
      toast.success(
        cuantos === 1 ? '1 premio ya no está completado.' : `${cuantos} premios ya no están completados.`
      );
      const { fallidos } = await cambiarEstadoPremiosAscenso({
        memberId,
        user,
        premios,
        nextStatus: 'no_iniciado',
      });
      await avisarSiFallo(fallidos, cuantos);
      return;
    }

    setEnviandoLote(true);
    const resultados = await Promise.allSettled(
      premios.map(({ sectionId, parentId, rowId, metadata }) =>
        createAwardsActions({
          system: 'sistemaAscenso',
          memberId,
          context: { sectionId, parentId, rowId },
          metadata,
          user,
        }).requestStatusChange({ nextStatus: 'no_iniciado', nextTimesCompleted: 0 })
      )
    );
    setEnviandoLote(false);
    quitarDialog.onFalse();
    table.onSelectAllRows(false, []);

    const fallidas = resultados.filter((r) => r.status === 'rejected').length;
    if (fallidas) toast.error(`No se pudieron enviar ${fallidas} de ${cuantos} solicitudes.`);
    else {
      toast.success(
        cuantos === 1
          ? 'Solicitud enviada a los Coordinadores de Destacamento.'
          : `${cuantos} solicitudes enviadas a los Coordinadores de Destacamento.`
      );
    }
  };

  const cancelarSeleccion = useCallback(() => table.onSelectAllRows(false, []), [table]);

  // Esc cancela la selección (en escritorio, junto a Ctrl + clic).
  const haySeleccion = premiosSeleccionados.length > 0;
  useEffect(() => {
    if (!haySeleccion) return undefined;
    const alPulsarTecla = (event) => {
      if (event.key === 'Escape') cancelarSeleccion();
    };
    window.addEventListener('keydown', alPulsarTecla);
    return () => window.removeEventListener('keydown', alPulsarTecla);
  }, [haySeleccion, cancelarSeleccion]);

  const conCertificado = yaCompletados.filter((item) => item.tieneCertificado);

  const renderCompletarSeleccion = () =>
    haySeleccion ? (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
        <Button
          variant="contained"
          color={modoQuitar ? 'inherit' : 'primary'}
          startIcon={
            <Iconify icon={modoQuitar ? 'solar:restart-bold' : 'eva:checkmark-circle-2-outline'} />
          }
          onClick={modoQuitar ? quitarDialog.onTrue : completarSeleccion}
          sx={{ height: 54 }}
        >
          {modoQuitar
            ? `Quitar completado (${yaCompletados.length})`
            : `Completar (${porCompletar.length})`}
        </Button>
        <IconButton aria-label="Cancelar selección" onClick={cancelarSeleccion}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Stack>
    ) : null;

  const renderQuitarSeleccionDialog = () => (
    <ConfirmDialog
      open={quitarDialog.value}
      onClose={enviandoLote ? undefined : quitarDialog.onFalse}
      title={necesitaAprobacion ? 'Solicitar cambio de estado' : 'Quitar completado'}
      content={
        <Stack spacing={1.5}>
          <span>
            {yaCompletados.length === 1
              ? '1 premio seleccionado.'
              : `${yaCompletados.length} premios seleccionados.`}{' '}
            {buildStatusChangeMessage({
              needsApproval: necesitaAprobacion,
              hasCertificate: conCertificado.length > 0,
            })}
          </span>
          {/* Los del check verde, por nombre: su certificado se borra y hay
              que volver a cargarlo. */}
          {conCertificado.length > 0 && (
            <Alert severity="warning" icon={<Iconify icon="solar:shield-check-bold" />}>
              {conCertificado.length === 1
                ? 'Tiene el certificado cargado'
                : `Tienen el certificado cargado (${conCertificado.length})`}
              : <strong>{conCertificado.map((item) => item.name).join(', ')}</strong>.
            </Alert>
          )}
        </Stack>
      }
      action={
        <Button variant="contained" loading={enviandoLote} onClick={quitarSeleccion}>
          {necesitaAprobacion ? 'Enviar solicitudes' : 'Quitar completado'}
        </Button>
      }
    />
  );

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
          selectionAction={renderCompletarSeleccion()}
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

      {/* TOGGLE: en pantalla pequeña no sale. Allí la pestaña va siempre en
          cuadrícula y el botón solo quitaba sitio al buscador y al filtro. */}
      <Box
        sx={{
          flexShrink: 0,
          display: { xs: 'none', sm: 'flex' },
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
        {/* Solo la vista activa se monta. Antes la lista y la cuadrícula estaban
            las dos montadas (una invisible), y cada clic repintaba las dos. */}
        {displayMode === 'list' && (
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
        )}
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
        {displayMode === 'grid' && (
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
        )}
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

    const systemSent = rootId === SISTEMA_ASCENSO_ID ? 'sistemaAscenso' : 'academia';

    // El MISMO premio que dentro de su carpeta: su estado, certificado y veces
    // salen del mismo sitio (antes salía como "No completado" aunque lo estuviera).
    const { data = {} } = getAwardsProgressCache(memberId);
    const nodo =
      systemSent === 'sistemaAscenso'
        ? data.sistemaAscenso?.[ascensoSectionId]?.[item.parentId]?.[item.id]
        : data.academia?.[item.parentId]?.[item.id];
    const status =
      systemSent === 'sistemaAscenso'
        ? statusStorage?.sistemaAscenso?.[ascensoSectionId]?.[item.parentId]?.[item.id]
        : statusStorage?.academia?.[item.parentId]?.[item.id];

    return {
      systemSent,
      sectionId: ascensoSectionId,
      status: status ?? null,
      tieneCertificado: Boolean(nodo?.certificate),
      vecesGanado:
        systemSent === 'sistemaAscenso'
          ? Number(nodo?.timesCompleted) || (status === 'completado' ? 1 : 0)
          : 0,
    };
  };

  // Como mucho estas tarjetas a la vez: con una letra coinciden cientos y
  // pintarlas todas hacía lenta la búsqueda. Se afina escribiendo más.
  const MAXIMO_RESULTADOS = 60;

  // Resultados: primero las carpetas (tarjetas de carpeta) y luego los premios,
  // con la MISMA tarjeta de insignia y las mismas propiedades que en su carpeta
  // (estado, check, veces, completar desde el menú, panel lateral).
  const renderGlobalSearchResults = () => {
    const carpetas = globalSearchResults.filter((item) => item.type === 'folder');
    const premios = globalSearchResults.filter((item) => item.type !== 'folder');
    const premiosVisibles = premios.slice(0, MAXIMO_RESULTADOS);

    return (
      <Stack spacing={2.5}>
        {!!carpetas.length && (
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
            {carpetas.map((item) => (
              <FileManagerFolderItem
                key={item.id}
                folder={{ ...item, memberId, allData: tableData }}
                selected={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onOpen={() => {
                  filters.setState({ name: '' });
                  openFolder(item.id);
                }}
              />
            ))}
          </Box>
        )}

        {!!premiosVisibles.length && (
          <Box
            sx={{
              display: 'grid',
              gap: HUECO_DE_INSIGNIAS,
              gridTemplateColumns: COLUMNAS_DE_INSIGNIAS,
            }}
          >
            {premiosVisibles.map((item) => {
              const context = getSearchResultContext(item);

              return (
                <FileManagerFileItem
                  key={`${item.parentId}:${item.id}`}
                  isGridView
                  insignia
                  file={{
                    ...item,
                    memberId,
                    ...context,
                    imagenInsignia: imagenDelPremio(item),
                  }}
                  selected={false}
                  onDelete={() => {}}
                  // En la Academia manda su propio permiso, como en su carpeta.
                  readOnly={readOnly || (context.systemSent === 'academia' && !canEditAcademia)}
                />
              );
            })}
          </Box>
        )}

        {premios.length > premiosVisibles.length && (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Se muestran {premiosVisibles.length} de {premios.length} premios. Escribe más para
            afinar la búsqueda.
          </Typography>
        )}
      </Stack>
    );
  };

  return (
    <>
      {/* Dentro de la ficha ya hay un DashboardContent alrededor, y el de aquí
          sumaba su relleno al de fuera: abajo, 128 px vacíos que no dejaban ver
          la raíz sin desplazarse; a los lados, 40 px por lado que estrechaban
          la tabla frente a las demás pestañas. En la ficha se quita, y en
          pantalla grande la pestaña se abre además sobre el margen de la ficha:
          solo esta, porque sus tablas son anchas (General y las otras no se tocan). */}
      <DashboardContent sx={enFicha ? SX_PREMIOS_EN_FICHA : undefined}>
        {/* En la raíz la miga "Premios" sola no decía nada; dentro de un programa
            sigue siendo el camino de vuelta. */}
        {!isRootFolder && (
          <Box
            sx={{ mt: -3, mb: -1 }}
            // Las migas son enlaces de Next y cada una volvía a pedir la página
            // al servidor; aquí basta con cambiar `?folder=` (ver `irACarpeta`).
            // Con Ctrl/Cmd se deja al navegador abrirla en otra pestaña.
            onClickCapture={(event) => {
              const enlace = event.target.closest?.('a[href]');
              const destino = enlace && new URL(enlace.href, window.location.href);
              if (
                !destino ||
                destino.pathname !== window.location.pathname ||
                !destino.searchParams.has('folder') ||
                event.metaKey ||
                event.ctrlKey
              ) {
                return;
              }
              event.preventDefault();
              irACarpeta(destino.searchParams.get('folder'));
            }}
          >
            <CustomBreadcrumbs
              links={[{ name: 'Premios', href: '?folder=' }, ...folderBreadcrumbs]}
              // El mismo separador que las migas de la ficha y de los demás niveles.
              slotProps={{ breadcrumbs: { separator: '•' } }}
            />
          </Box>
        )}

        <Stack
          spacing={2.5}
          // Sin la miga de pan en la raíz, el margen de arriba dejaba un hueco
          // vacío bajo las pestañas: el buscador sube hasta ocuparlo.
          sx={{
            mt: isRootFolder ? 0 : { xs: 3, md: 5 },
            mb: isRootFolder ? 2.5 : { xs: 3, md: 5 },
          }}
        >
          {renderFilters()}
          {showCertificateRequiredNotice && renderCertificateRequiredNotice()}
          {canReset && renderResults()}
          {/* Solo en la raíz: dentro de un programa ya se está viendo su detalle. */}
          {isRootFolder && !isGlobalSearch && progresoListo && (
            <AwardsProgressSummary resumen={resumenDeProgreso} onAbrirPrograma={openFolder} />
          )}
        </Stack>

        {!progresoListo ? (
          <AwardsManagerSkeleton
            soloContenido
            variante={isGlobalSearch ? 'carpetas' : varianteDeCarpeta(normalizedFolder)}
            lista={displayMode === 'list'}
          />
        ) : buscando ? (
          <AwardsManagerSkeleton soloContenido variante="insignias" />
        ) : isGlobalSearch ? (
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
      {renderQuitarSeleccionDialog()}
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
    // Sin tildes ni mayúsculas, como la búsqueda global ("aviacion" encuentra "Aviación").
    const termino = normalizeSearchText(name);
    inputData = inputData.filter((file) => normalizeSearchText(file.name).includes(termino));
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
