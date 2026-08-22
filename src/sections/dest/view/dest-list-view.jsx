'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useSearchParams } from 'next/navigation';
import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { sortOwnFirst } from 'src/utils/sort-own-first';
import { normalizeText } from 'src/utils/normalize-text';
import { countMembersByDestId } from 'src/utils/member-count';
import { isDestacamentoAdminRole } from 'src/utils/admin-role-label';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import {
  getOwnDestIdsForUser,
  getOwnRegionIdsForUser,
  getOwnSectionIdsForUser,
  filterDestsByMemberScope,
} from 'src/utils/member-access';
import {
  canEditDest,
  isAdminGlobal,
  esRolDeDestacamento,
  canCreateDestInSection,
  isForeignDestForMembers,
} from 'src/utils/org-level-access';

import { REGIONAL_FULL_NAME_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { getDests, getDestsApi, deleteDestApi } from 'src/services/dest-service';
import { obtenerAsignacionesDirectivaMiembros } from 'src/services/directivas-organizacionales-service';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  rowInPage,
  getComparator,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { CompactEntityListView } from 'src/sections/common/compact-entity-list-view';
import { useCompactEntityDelete } from 'src/sections/common/use-compact-entity-delete';
import { CompactEntityDeleteDialog } from 'src/sections/common/compact-entity-delete-dialog';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISOS, puedeModificar } from 'src/auth/permissions';

import { DestTableRow } from '../dest-table-row';
import { DestCardList } from '../dest-card-list';
import { DestTableToolbar } from '../dest-table-toolbar';
import { DestTableFiltersResult } from '../dest-table-filters-result';
// ----------------------------------------------------------------------

const REGIONAL_FULL_NAME = [{ value: 'all', label: 'Todos' }, ...REGIONAL_FULL_NAME_OPTIONS];

// Casilla del organigrama de la que sale el Coordinador de Destacamento.
const POSICION_COORDINADOR_DEST = 'destacamento-coordinador-destacamento';

const TABLE_HEAD = [
  { id: 'destName', label: 'Destacamento' },
  { id: 'memberFullName', label: 'Coord. Dest', width: 280 },
  { id: 'destMemberCount', label: 'Miembros', width: 120 },
  { id: 'sectionalName', label: 'Sección', width: 160 },
  { id: 'regionalName', label: 'Región', width: 140 },
  { id: '', width: 88 },
];

const mapDestToBaseRow = (dest) => ({
  ...dest,
  idIglesia: dest.idIglesia || dest.churchId || null,
  nombre: dest.nombre || dest.name || '',
  numero: dest.numero || dest.destNumber || '',
  destName: dest.nombre || dest.name || '',
  churchName: dest?.churchName || '',
  memberFullName: 'Desconocido',
  coordinatorId: dest.coordinatorId || null,
  coordinatorPhoneNumber: '',
  destMemberCount: 0,
  sectionalId: null,
  sectionalName: '',
  regionalId: null,
  regionalName: '-',
});

const normalizeDestId = (value) => String(value ?? '').trim();

const hasAdminRole = (user) =>
  ['admin', 'administrador'].includes(String(user?.role || user?.rol || '').trim().toLowerCase());

const canModifyDest = (user, permissionCode, actionKey) => {
  if (isDestacamentoAdminRole(user)) {
    return false;
  }

  // Las sesiones con rolId (coordinadores de sección/región y afines) se rigen
  // por el catálogo de permisos del rol, NO por el objeto user.permisos: este
  // puede traer los valores por defecto de miembro (destacamentos.crear=false) y
  // ocultaría el botón de crear aunque el rol sí tenga el permiso.
  if (user?.rolId || user?.roleId) {
    return puedeModificar(user, permissionCode);
  }

  const modulePermissions = user?.permisos?.destacamentos || user?.permissions?.destacamentos;

  if (modulePermissions && typeof modulePermissions === 'object') {
    return Boolean(modulePermissions[actionKey]);
  }

  if (hasAdminRole(user)) {
    return true;
  }

  return puedeModificar(user, permissionCode);
};

// ----------------------------------------------------------------------
export function DestListView() {
  const table = useTable();
  const confirmDialog = useBoolean();
  const { user } = useAuthContext();
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [churches, setChurches] = useState([]);
  const [members, setMembers] = useState([]);
  // Asignaciones de la Directiva: de aqui sale el Coordinador de cada
  // destacamento, para que la lista diga lo mismo que el organigrama y que la
  // ficha del destacamento.
  const [asignaciones, setAsignaciones] = useState([]);
  const [fotosMiembros, setFotosMiembros] = useState({});
  const [tableLoading, setTableLoading] = useState(true);

  const coordinadorPorDestacamento = useMemo(() => {
    const mapa = new Map();

    asignaciones.forEach((asignacion) => {
      if (asignacion?.nivel !== 'destacamento') return;
      if (asignacion?.idPosicionDirectiva !== POSICION_COORDINADOR_DEST) return;
      if (!asignacion?.idEntidad || !asignacion?.idMiembro) return;

      mapa.set(String(asignacion.idEntidad), String(asignacion.idMiembro));
    });

    return mapa;
  }, [asignaciones]);

  const isValidCoordinator = (member) => {
    if (!member) return false;

    const firstName = String(member.firstName || '')
      .trim()
      .toLowerCase();
    const lastName = String(member.lastName || '')
      .trim()
      .toLowerCase();
    const phoneNumber = String(member.phoneNumber || '').trim();

    if (firstName === 'juan' && lastName === 'perez' && phoneNumber === '8090000000') {
      return false;
    }

    if (firstName === 'juan' && lastName === 'perez' && phoneNumber === '(809) 000-0000') {
      return false;
    }

    return true;
  };

  const buildDestList = (apiDests) => {
    const allDests = apiDests;

    return allDests.map((dest) => {
      const allMembers = members;

      const coordinatorByDestField = dest.coordinatorId
        ? members.find(
            (m) =>
              String(m.memberId) === String(dest.coordinatorId) ||
              String(m.id) === String(dest.coordinatorId)
          )
        : null;

      const realMembersInDest = allMembers.filter(
        (member) =>
          String(member.destId || member.idDestacamento || '') === String(dest.id) &&
          isValidCoordinator(member)
      );

      const fallbackCoordinator = realMembersInDest.length === 1 ? realMembersInDest[0] : null;

      // MANDA la Directiva: quien ocupa la casilla "Coordinador de Destacamento"
      // en el organigrama es el coordinador, y punto. Es la misma fuente que lee
      // la ficha del destacamento, asi que los tres sitios dicen lo mismo.
      //
      // Detras quedan los dos criterios de antes, para los destacamentos que
      // todavia no tienen esa casilla asignada: el campo del propio destacamento
      // y, si tampoco, el unico miembro que haya dentro.
      const idCoordinadorDirectiva = coordinadorPorDestacamento.get(String(dest.id));
      const coordinatorByDirectiva = idCoordinadorDirectiva
        ? members.find(
            (m) =>
              String(m.id) === idCoordinadorDirectiva ||
              String(m.idMiembros) === idCoordinadorDirectiva
          )
        : null;

      const coordinator =
        coordinatorByDirectiva ||
        (isValidCoordinator(coordinatorByDestField) ? coordinatorByDestField : fallbackCoordinator);

      const church = churches.find(
        (c) =>
          Number(c.idIglesia) === Number(dest.idIglesia || dest.churchId) ||
          Number(c.id) === Number(dest.idIglesia || dest.churchId)
      );

      const sectional = sectionals.find(
        (s) =>
          Number(s.idSeccion) === Number(church?.idSeccion) ||
          Number(s.id) === Number(church?.idSeccion) ||
          Number(s.idSeccion) === Number(church?.sectionId) ||
          Number(s.id) === Number(church?.sectionId)
      );

      const regional = regionals.find(
        (r) =>
          Number(r.id) === Number(sectional?.regionalId) ||
          Number(r.idRegion) === Number(sectional?.regionalId)
      );

      return {
        ...dest,
        idIglesia: dest.idIglesia || dest.churchId || null,
        nombre: dest.nombre || dest.name || '',
        numero: dest.numero || dest.destNumber || '',

        destName: dest.nombre || dest.name || '',
        debugDestName: dest.name || dest.destName || '',

        churchName: church?.name ?? dest?.churchName ?? '',

        memberFullName: coordinator
          ? `${coordinator.firstName ?? ''} ${coordinator.lastName ?? ''}`.trim()
          : 'Desconocido',
        coordinatorId: coordinator?.memberId || coordinator?.id || null,
        coordinatorAvatarUrl:
          fotosMiembros[String(coordinator?.id)]?.urlFoto || coordinator?.avatarUrl || '',

        memberFirstName: coordinator?.firstName ?? '',
        memberLastName: coordinator?.lastName ?? '',
        coordinatorPhoneNumber: coordinator?.phoneNumber || '',

        destMemberCount: countMembersByDestId(allMembers, dest.id),

        sectionalId: sectional?.idSeccion || sectional?.id || null,
        sectionalName: sectional?.sectionalName || sectional?.nombre || sectional?.name || null,
        regionalId: regional?.idRegion || regional?.id || null,

        debugChurchIdSeccion: church?.idSeccion,
        debugChurchSectionId: church?.sectionId,

        regionalName: regional?.regionalName || regional?.name || regional?.nombre || '-',
      };
    });
  };

  const [tableData, setTableData] = useState([]);
  // Alcance propio (derivado del destacamento/seccion del usuario) para bloquear
  // el contador de miembros de destacamentos ajenos.
  const ownScope = useMemo(
    () => ({
      regionIds: getOwnRegionIdsForUser(user, { dests: tableData, churches, sectionals }),
      sectionIds: getOwnSectionIdsForUser(user, { dests: tableData, churches }),
      destIds: getOwnDestIdsForUser(user),
    }),
    [user, tableData, churches, sectionals]
  );
  // Coordinador Regional y Sub-Director Regional dan de alta destacamentos en las
  // secciones de su región. No pasan por `canModifyDest` porque son cargos
  // `soloLectura` y `puedeModificar` los descartaría.
  const canCreateDest =
    canCreateDestInSection(user) || canModifyDest(user, PERMISOS.DESTACAMENTOS_CREAR, 'crear');
  // Eliminar destacamentos: solo el Administrador Global.
  const canDeleteDest = isAdminGlobal(user);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const displayMode = selectedDisplayMode || (isMobile ? 'grid' : 'panel');
  const setDisplayMode = useCallback((nextMode) => {
    setSelectedDisplayMode(nextMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBaseDests() {
      const cachedDests = getDests();
      const cachedScopedDests = filterDestsByMemberScope(cachedDests, user, {
        churches,
        sectionals,
      });

      if (cachedScopedDests.length) {
        setTableData(cachedScopedDests.map(mapDestToBaseRow));
        setTableLoading(false);
      } else {
        setTableLoading(true);
      }

      try {
        const data = await getDestsApi({ includePhotos: false });
        if (cancelled) return;

        const scopedDests = filterDestsByMemberScope(data || [], user, { churches, sectionals });

        setTableData(scopedDests.map(mapDestToBaseRow));
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading base dests:', error);
          setTableData([]);
        }
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    }

    loadBaseDests();

    return () => {
      cancelled = true;
    };
  }, [churches, sectionals, user]);

  useEffect(() => {
    if (tableLoading) return;
    if (!members.length || !churches.length || !sectionals.length || !regionals.length) {
      return;
    }

    const load = async () => {
      const data = await getDestsApi();

      const scopedDests = filterDestsByMemberScope(data || [], user, { churches, sectionals });

      const built = buildDestList(scopedDests);

      setTableData(built);
    };

    load();
    // `coordinadorPorDestacamento` entra en las dependencias para que las filas se
    // reconstruyan cuando llegan las asignaciones de la Directiva; si no, la
    // columna del coordinador se quedaria con lo que hubiera en el primer render.
  }, [members, churches, sectionals, regionals, user, tableLoading, coordinadorPorDestacamento, fotosMiembros]);

  useEffect(() => {
    let cancelled = false;

    // Fase 1: la metadata (secciones/regiones/iglesias/miembros) se carga en
    // paralelo desde el montaje, en vez de esperar a los destacamentos base.
    // Solo iglesias necesita resolverse para el alcance; secciones/regiones se
    // usan para nombres y conteos, sin fotos.
    async function load() {
      const [sectionalsData, regionalsData, churchesData, membersData, asignacionesData, fotosData] =
        await Promise.all([
          getSectionals({ includePhotos: false }),
          getRegionals({ includePhotos: false }),
          getChurches(),
          getMembers(),
          obtenerAsignacionesDirectivaMiembros().catch(() => []),
          // Las fotos de los miembros viven en Firebase, no en la lista que
          // devuelve la API: sin pedirlas aparte, el coordinador salia siempre
          // con el avatar generico aunque tuviera foto. Es lo que ya hace la
          // lista de miembros.
          obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
        ]);

      if (cancelled) return;

      setSectionals(Array.isArray(sectionalsData) ? sectionalsData : []);
      setRegionals(Array.isArray(regionalsData) ? regionalsData : []);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setAsignaciones(Array.isArray(asignacionesData) ? asignacionesData : []);
      setFotosMiembros(fotosData || {});
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useSetState({ name: '', sectionalName: [], regionalName: 'all' });
  const searchParams = useSearchParams();
  const nameFromUrl = searchParams.get('name');
  const sectionalFromUrl = searchParams.get('sectional');
  const regionFromUrl = searchParams.get('region');
  const memberFromUrl = searchParams.get('member');
  const appliedFromUrl = useRef(false);
  const { state: currentFilters, setState: updateFilters } = filters;

  const getDestCountByRegion = (regionName) => {
    if (regionName === 'all') return tableData.length;

    return tableData.filter((dest) => dest.regionalName === regionName).length;
  };

  const distinctSectionalFullName = (sectionals || []).map((s) => ({
    value: s.idSeccion || s.id,
    label: s.nombre || s.sectionalName || s.name || 'Sin nombre',
  }));

  useEffect(() => {
    if (appliedFromUrl.current) return;
    if (!nameFromUrl) return;

    updateFilters({ name: nameFromUrl });
    table.onResetPage();

    appliedFromUrl.current = true;
  }, [nameFromUrl]);

  useEffect(() => {
    if (!sectionalFromUrl) return;
    if (appliedFromUrl.current) return;

    const sectional = sectionals.find(
      (item) => String(item.idSeccion || item.id || '') === String(sectionalFromUrl)
    );

    if (!sectional) return;

    updateFilters({ sectionalName: [sectional.idSeccion || sectional.id] });
    table.onResetPage();

    appliedFromUrl.current = true;
  }, [sectionalFromUrl, sectionals, updateFilters, table]);

  useEffect(() => {
    //vista panel en pantalla pequeña, use DENSE true
    if (isMobile) {
      table.setDense(true);
    } else {
      table.setDense(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    if (!regionFromUrl) return;
    if (appliedFromUrl.current) return;

    const regional = regionals.find((r) => r.id === regionFromUrl);

    if (!regional) return;

    updateFilters({ regionalName: regional.name });
    table.onResetPage();
    appliedFromUrl.current = true;
  }, [regionFromUrl, updateFilters, table]);

  useEffect(() => {
    if (!memberFromUrl) return;
    if (appliedFromUrl.current) return;

    updateFilters({ name: decodeURIComponent(memberFromUrl) });
    table.onResetPage();

    appliedFromUrl.current = true;
  }, [memberFromUrl, updateFilters, table]);

  // Orden inicial: primero los destacamentos del alcance del usuario (el propio
  // y, para los cargos seccionales/regionales, los de su sección o región). Si el
  // usuario ordena por una columna, manda su criterio (ver `sortOwnFirst`).
  const dataFiltered = useMemo(() => {
    const filtered = applyFilter({
      inputData: tableData,
      comparator: getComparator(table.order, table.orderBy),
      filters: currentFilters,
      members,
    });

    const hasOwnScope =
      ownScope.destIds.size || ownScope.sectionIds.size || ownScope.regionIds.size;

    if (table.hasUserSorted || !hasOwnScope) return filtered;

    // Manda el alcance MAS ESTRECHO que tenga la persona. Si se sabe a que
    // destacamento pertenece, ese va primero y punto: emparejar tambien por
    // seccion marcaria como propios todos los de su seccion, y entonces no habria
    // nada que separar y el suyo podia acabar el ultimo. Solo cuando no hay
    // destacamento propio —cargos seccionales y regionales— se ordena por
    // seccion o por region.
    if (ownScope.destIds.size) {
      return sortOwnFirst(filtered, (row) => ownScope.destIds.has(normalizeDestId(row.id)));
    }

    return sortOwnFirst(
      filtered,
      (row) =>
        ownScope.sectionIds.has(normalizeDestId(row.sectionalId)) ||
        ownScope.regionIds.has(normalizeDestId(row.regionalId))
    );
  }, [
    tableData,
    table.order,
    table.orderBy,
    table.hasUserSorted,
    currentFilters,
    members,
    ownScope,
  ]);

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name ||
    currentFilters.sectionalName.length > 0 ||
    currentFilters.regionalName !== 'all';

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const { handleDeleteRow, handleDeleteRows } = useCompactEntityDelete({
    table,
    tableData,
    setTableData,
    dataInPageLength: dataInPage.length,
    dataFilteredLength: dataFiltered.length,
    deleteItem: (id) =>
      deleteDestApi(id, {
        usuario: user,
        antes: tableData.find((row) => String(row.id) === String(id)),
      }),
    singleSuccessMessage: 'Destacamento eliminado correctamente.',
    singleErrorMessage: 'No se pudo eliminar el destacamento.',
    multipleSuccessMessage: 'Destacamentos eliminados correctamente.',
    multipleErrorMessage: 'No se pudieron eliminar los destacamentos.',
  });

  const handleFilterRegionalFullName = useCallback(
    (event, newValue) => {
      table.onResetPage();
      updateFilters({ regionalName: newValue });
    },
    [updateFilters, table]
  );

  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Lista Destacamentos"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Destacamentos', href: paths.dashboard.level.dest.root },
            { name: 'Lista' },
          ]}
          action={
            canCreateDest ? (
              <Button
                component={RouterLink}
                href={paths.dashboard.level.dest.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                sx={{
                  position: { xs: 'absolute', md: 'static' },
                  right: { xs: 0, md: 'auto' },
                  top: { xs: 0, md: 'auto' },
                }}
              >
                Crear nuevo
              </Button>
            ) : null
          }
          sx={{
            mb: { xs: 3, md: 5 },
            position: 'relative',
          }}
        />

        <Card>
          <Tabs
            value={currentFilters.regionalName}
            onChange={handleFilterRegionalFullName}
            sx={[
              (muiTheme) => ({
                px: { md: 2.5 },
                boxShadow: `inset 0 -2px 0 0 ${varAlpha(muiTheme.vars.palette.grey['500Channel'], 0.08)}`,
              }),
            ]}
          >
            {REGIONAL_FULL_NAME.map((tab) => (
              <Tab
                key={tab.value}
                iconPosition="end"
                value={tab.value}
                label={tab.label}
                icon={
                  <Label
                    variant={
                      ((tab.value === 'all' || tab.value === currentFilters.regionalName) &&
                        'filled') ||
                      'soft'
                    }
                    color={
                      (tab.value === 'Región Central' && 'default') ||
                      (tab.value === 'Región Norte' && 'default') ||
                      (tab.value === 'Región Sur' && 'default') ||
                      'default'
                    }
                  >
                    {getDestCountByRegion(tab.value)}
                  </Label>
                }
              />
            ))}
          </Tabs>

          <DestTableToolbar
            filters={filters}
            onResetPage={table.onResetPage}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            rows={tableData}
            options={{ sectionalName: distinctSectionalFullName }}
            showSectionFilter={!isDestacamentoAdminRole(user)}
          />

          {canReset && (
            <DestTableFiltersResult
              filters={filters}
              options={{ sectionalName: distinctSectionalFullName }}
              totalResults={dataFiltered.length}
              onResetPage={table.onResetPage}
              sx={{ p: 2.5, pt: 0 }}
            />
          )}

          {displayMode === 'panel' && (
            <Box sx={{ position: 'relative' }}>
              {canDeleteDest && (
                <TableSelectedAction
                  dense={table.dense}
                  numSelected={table.selected.length}
                  rowCount={dataFiltered.length}
                  onSelectAllRows={(checked) =>
                    table.onSelectAllRows(
                      checked,
                      dataFiltered.map((row) => row.id)
                    )
                  }
                  action={
                    <Tooltip title="Eliminar">
                      <IconButton color="primary" onClick={confirmDialog.onTrue}>
                        <Iconify icon="solar:trash-bin-trash-bold" />
                      </IconButton>
                    </Tooltip>
                  }
                />
              )}

              <Scrollbar>
                <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                  <TableHeadCustom
                    order={table.order}
                    orderBy={table.orderBy}
                    headCells={TABLE_HEAD}
                    rowCount={dataFiltered.length}
                    numSelected={table.selected.length}
                    onSort={table.onSort}
                    onSelectAllRows={(checked) =>
                      table.onSelectAllRows(
                        checked,
                        dataFiltered.map((row) => row.id)
                      )
                    }
                  />

                  <CompactEntityListView
                    loading={tableLoading}
                    rows={dataFiltered.slice(
                      table.page * table.rowsPerPage,
                      table.page * table.rowsPerPage + table.rowsPerPage
                    )}
                    renderRow={(row) => (
                      <DestTableRow
                        key={`${row.id || row.idDestacamento}-${row.destName}`}
                        row={row}
                        selected={table.selected.includes(row.id)}
                        onSelectRow={() => table.onSelectRow(row.id)}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        editHref={paths.dashboard.level.dest.edit(row.id)}
                        canManage={canEditDest(user, row)}
                        canDelete={canDeleteDest}
                        // El contador de OTRO destacamento se ve, pero apagado y
                        // sin enlace. A un cargo de destacamento (o al Usuario
                        // Comun) no le vale que coincida la seccion: se compara
                        // solo con el suyo.
                        lockMemberCount={
                          (esRolDeDestacamento(user) &&
                            !ownScope.destIds.has(String(row.id ?? '').trim())) ||
                          isForeignDestForMembers(user, {
                            destId: row.id,
                            sectionId: row.sectionalId,
                            regionId: row.regionalId,
                            ownRegionIds: ownScope.regionIds,
                            ownSectionIds: ownScope.sectionIds,
                            ownDestIds: ownScope.destIds,
                          })
                        }
                      />
                    )}
                    notFound={notFound}
                    skeletonRows={table.rowsPerPage}
                    skeletonCellCount={TABLE_HEAD.length + 1}
                    emptyRowsHeight={table.dense ? 56 : 56 + 20}
                    emptyRowsCount={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)}
                  />
                </Table>
              </Scrollbar>
            </Box>
          )}

          {displayMode === 'panel' && (
            <TablePaginationCustom
              page={table.page}
              dense={table.dense}
              count={dataFiltered.length}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onChangeDense={table.onChangeDense}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          )}
        </Card>

        {displayMode !== 'panel' && <DestCardList dests={dataFiltered} />}
      </DashboardContent>

      <CompactEntityDeleteDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
        onConfirm={handleDeleteRows}
        selectedCount={table.selected.length}
        entityLabel="destacamentos"
      />
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters, members }) {
  const { name, regionalName, sectionalName } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  //Se reemplaza el anterior por el siguiente. Este busca tanto por destNasme como por memberFullName.
  if (name) {
    const keyword = normalizeText(name);

    inputData = inputData.filter((dest) =>
      normalizeText(
        `${dest.nombre || ''} ${dest.destName || ''} ${dest.numero || ''} ${dest.memberFullName || ''} ${dest.churchName || ''} ${dest.sectionalName || ''} ${dest.regionalName || ''}`
      ).includes(keyword)
    );
  }

  if (regionalName !== 'all') {
    inputData = inputData.filter((dest) => dest.regionalName === regionalName);
  }

  if (sectionalName.length) {
    inputData = inputData.filter((dest) => sectionalName.includes(dest.sectionalId));
  }

  return inputData;
}
