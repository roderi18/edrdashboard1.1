'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useSearchParams } from 'next/navigation';
import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useRef, useState, useEffect, useCallback } from 'react';

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

import { normalizeText } from 'src/utils/normalize-text';
import {
  getOwnSectionIdsForUser,
  isRegionWideSectionViewer,
  filterSectionalsByMemberScope,
} from 'src/utils/member-access';
import {
  canEditSectional,
  canDeleteOrgLevel,
  isForeignSectionForMembers,
  canCreateSectionalInRegion,
} from 'src/utils/org-level-access';

import { REGIONALS } from 'src/_mock/assets';
import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { _roles, REGIONAL_FULL_NAME_OPTIONS } from 'src/_mock';
import { getMembers, getLeadershipAssignments } from 'src/services/member-service';
import { getSectionals, deleteSectional, getCachedSectionals } from 'src/services/sectional-service';

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

import { SectionalTableRow } from '../sectional-table-row';
import { SectionalCardList } from '../sectional-card-list';
import { SectionalTableToolbar } from '../sectional-table-toolbar';
import { SectionalTableFiltersResult } from '../sectional-table-filters-result';
// ----------------------------------------------------------------------

const REGIONAL_FULL_NAME = [{ value: 'all', label: 'Todos' }, ...REGIONAL_FULL_NAME_OPTIONS];

const TABLE_HEAD = [
  { id: 'sectionalName', label: 'Sección' },
  { id: 'memberFullName', label: 'Director', width: 270 },
  { id: 'sectionalDestCount', label: 'Destacamentos', width: 140 },
  { id: 'sectionalXDestMemberCount', label: 'Miembros', width: 140 },
  { id: 'regionalName', label: 'Región', width: 140 },
  { id: '', width: 88 },
];

const mapSectionalToBaseRow = (sectional) => ({
  ...sectional,
  sectionalName: sectional.sectionalName || sectional.nombre || sectional.name || '',
  regionalName: '-',
  email: sectional.email ?? '',
  sectionalDestCount: 0,
  sectionalXDestMemberCount: 0,
  memberFullName: 'Desconocido',
  directorId: sectional.directorId || null,
});

// ----------------------------------------------------------------------

const normalizeId = (value) => String(value ?? '').trim();

const idMatches = (left, right) => {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);

  return Boolean(leftId && rightId && leftId === rightId);
};

const getSectionalId = (sectional = {}) =>
  sectional?.idSeccion ?? sectional?.id ?? sectional?.sectionalId;

const getRegionalId = (regional = {}) => regional?.id ?? regional?.idRegion ?? regional?.regionId;

const getChurchId = (church = {}) => church?.id ?? church?.idIglesia ?? church?.churchId;

const getChurchSectionId = (church = {}) =>
  church?.idSeccion ?? church?.seccionId ?? church?.sectionId ?? church?.sectionalId;

const getDestId = (dest = {}) => dest?.id ?? dest?.idDestacamento ?? dest?.destId;

const getDestChurchId = (dest = {}) => dest?.churchId ?? dest?.idIglesia ?? dest?.church?.id;

const getMemberDestId = (member = {}) =>
  member?.idDestacamento ?? member?.destId ?? member?.destacamentoId;

const getLeadershipBySectional = (sectionalId, role) => {
  const leaderships = getLeadershipAssignments();
  const members = getMembers();

  const assignment = leaderships.find(
    (a) => a.level === 'sectional' && a.entityId === sectionalId && a.role === role && a.memberId
  );

  return members.find((m) => m.id === assignment?.memberId) || null;
};

const buildSectionalList = ({
  sectionals = [],
  regionals = [],
  members = [],
  dests = [],
  churches = [],
}) =>
  sectionals.map((sectional) => {
    const sectionalId = getSectionalId(sectional);
    const regional = regionals.find((r) => idMatches(getRegionalId(r), sectional.regionalId));

    const director = members.find(
      (m) =>
        String(m.id) === String(sectional.directorId) ||
        String(m.memberId) === String(sectional.directorId)
    );

    const iglesiasDeSeccion = churches.filter(
      (church) => idMatches(getChurchSectionId(church), sectionalId)
    );

    const churchIdsDeSeccion = new Set(iglesiasDeSeccion.map(getChurchId).map(normalizeId));

    const destCount = dests.filter((d) =>
      churchIdsDeSeccion.has(normalizeId(getDestChurchId(d)))
    ).length;

    const destsBySectional = dests.filter((d) =>
      churchIdsDeSeccion.has(normalizeId(getDestChurchId(d)))
    );

    const destIdsDeSeccion = new Set(destsBySectional.map(getDestId).map(normalizeId));

    const membersCount = members.filter((member) =>
      destIdsDeSeccion.has(normalizeId(getMemberDestId(member)))
    ).length;

    return {
      ...sectional,

      sectionalName: sectional.sectionalName,

      regionalName:
        regional?.regionalName ||
        REGIONALS.find((r) => String(r.id) === String(sectional.regionalId))?.name ||
        '-',

      email: sectional.email ?? '',

      sectionalDestCount: destCount,
      sectionalXDestMemberCount: membersCount,

      memberFullName: director
        ? `${director.firstName || ''} ${director.lastName || ''}`.trim()
        : 'Desconocido',

      directorId: director?.id ?? null,
      directorAvatarUrl: director?.avatarUrl || '',
      directorPhoneNumber: director?.phoneNumber || '',
    };
  });

export function SectionalListView() {
  const { user } = useAuthContext();
  // Crear secciones: administradores de region (en su region) y global/funcional.
  // Se muestra el boton si el alcance ya lo permite O si el rol tiene el permiso
  // `secciones.crear` en el catalogo (coordinador regional y su asistente), de
  // forma coherente con el boton de crear destacamento del coordinador seccional.
  // La region concreta se acota luego en el formulario/guardado.
  const canCreate =
    canCreateSectionalInRegion(user) || puedeModificar(user, PERMISOS.SECCIONES_CREAR);
  // Eliminar: reservado exclusivamente al Administrador Global.
  const canDelete = canDeleteOrgLevel(user);
  const getRegionalNameByDest = (sectional) => {
    const regionals = getRegionals();
    const regional =
      regionals.find((r) => String(r.id) === String(sectional.regionalId)) ||
      REGIONALS.find((r) => String(r.id) === String(sectional.regionalId));
    return regional?.name;
  };

  const table = useTable();

  const confirmDialog = useBoolean();

  const [tableData, setTableData] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const [isClient, setIsClient] = useState(false);

  const [regionals, setRegionals] = useState([]);
  // Cargos que ven toda su region pero solo interactuan con su propia seccion.
  const restrictSections = isRegionWideSectionViewer(user);
  const [ownSectionIds, setOwnSectionIds] = useState(() => new Set());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const displayMode = selectedDisplayMode || (isMobile ? 'grid' : 'panel');
  const setDisplayMode = useCallback((nextMode) => {
    setSelectedDisplayMode(nextMode);
  }, []);
  const filters = useSetState({ name: '', role: [], regionalName: 'all' });
  const { state: currentFilters, setState: updateFilters } = filters;
  const searchParams = useSearchParams();
  const sectionFromUrl = searchParams.get('sectional');
  const memberFromUrl = searchParams.get('member');
  const regionFromUrl = searchParams.get('region');
  const hasAppliedUrlFilter = useRef(false);

  const dataFiltered = applyFilter({
    inputData: tableData,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name ||
    currentFilters.role.length > 0 ||
    currentFilters.regionalName !== 'all';

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const { handleDeleteRow, handleDeleteRows } = useCompactEntityDelete({
    table,
    tableData,
    setTableData,
    dataInPageLength: dataInPage.length,
    dataFilteredLength: dataFiltered.length,
    deleteItem: (id) =>
      deleteSectional(id, {
        usuario: user,
        antes: tableData.find((row) => String(row.id) === String(id)),
      }),
    singleSuccessMessage: 'Seccion eliminada correctamente.',
    singleErrorMessage: 'No se pudo eliminar la seccion.',
    multipleSuccessMessage: 'Secciones eliminadas correctamente.',
    multipleErrorMessage: 'No se pudieron eliminar las secciones.',
  });

  const handleFilterRegionalFullName = useCallback(
    (event, newValue) => {
      table.onResetPage();
      updateFilters({ regionalName: newValue });
    },
    [updateFilters, table]
  );

  useEffect(() => {
    async function loadData() {
      const cachedSectionals = getCachedSectionals();

      if (cachedSectionals.length) {
        setTableData(cachedSectionals.map(mapSectionalToBaseRow));
        setTableLoading(false);
      } else {
        setTableLoading(true);
      }

      try {
        // Fase 1: una sola tanda en paralelo, cada dataset una vez (antes se
        // pedian secciones/regiones/iglesias/destacamentos hasta 3 veces y en
        // serie dentro de buildSectionalList).
        const [sectionalsData, destsData, churchesData, regionalsData, membersData] =
          await Promise.all([
            getSectionals(),
            getDestsApi({ includePhotos: false }),
            getChurches(),
            getRegionals({ includePhotos: false }),
            getMembers(),
          ]);

        setRegionals(regionalsData);

        if (restrictSections) {
          setOwnSectionIds(
            getOwnSectionIdsForUser(user, { dests: destsData, churches: churchesData })
          );
        }

        const scopedSectionals = filterSectionalsByMemberScope(sectionalsData, user, {
          dests: destsData,
          churches: churchesData,
        });

        setTableData(scopedSectionals.map(mapSectionalToBaseRow));
        setTableLoading(false);

        const data = buildSectionalList({
          sectionals: sectionalsData,
          regionals: regionalsData,
          members: membersData,
          dests: destsData,
          churches: churchesData,
        });
        setTableData(
          filterSectionalsByMemberScope(data, user, { dests: destsData, churches: churchesData })
        );
      } catch (error) {
        console.error('Error loading sectionals:', error);
        setTableData([]);
        setTableLoading(false);
      }
    }

    loadData();
  }, [user, restrictSections]);

  useEffect(() => {
    if (hasAppliedUrlFilter.current) return;

    const hasParams = !!(regionFromUrl || sectionFromUrl || memberFromUrl);
    if (!hasParams) {
      hasAppliedUrlFilter.current = true;
      return;
    }

    if (regionFromUrl) {
      updateFilters({
        regionalName: regionFromUrl,
      });
    }
    if (memberFromUrl) {
      updateFilters({ name: memberFromUrl });
    } else if (sectionFromUrl) {
      updateFilters({ name: sectionFromUrl });
    }

    table.onResetPage();
    hasAppliedUrlFilter.current = true;
  }, []);

  useEffect(() => {
    if (!sectionFromUrl) return;
    if (hasAppliedUrlFilter.current) return;

    updateFilters({ name: decodeURIComponent(sectionFromUrl) });
    table.onResetPage();

    hasAppliedUrlFilter.current = true;
  }, [sectionFromUrl, updateFilters, table]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Una seccion se muestra deshabilitada (no clickable + texto atenuado) cuando
  // el usuario ve toda su region pero la seccion no es la suya asignada.
  const isRowDisabled = useCallback(
    (row) => restrictSections && !ownSectionIds.has(normalizeId(getSectionalId(row))),
    [restrictSections, ownSectionIds]
  );

  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Lista de Seccionales"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Sección', href: paths.dashboard.level.sectional.root },
            { name: 'Lista' },
          ]}
          action={
            canCreate ? (
              <Button
                component={RouterLink}
                href={paths.dashboard.level.sectional.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Crear nuevo
              </Button>
            ) : null
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <Tabs
            value={currentFilters.regionalName || 'all'}
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
                    {/* {['Región Central', 'Región Norte', 'Región Sur', 'Región Este'].includes(tab.value)
                      ? tableData.filter((sectional) => sectional.regionalName === tab.value).length
                      : tableData.length} */}
                    {isClient
                      ? tab.value === 'all'
                        ? tableData.length
                        : tableData.filter(
                            (row) =>
                              regionals.find((r) => String(r.id) === String(row.regionalId))
                                ?.regionalName === tab.value
                          ).length
                      : 0}
                  </Label>
                }
              />
            ))}
          </Tabs>

          <SectionalTableToolbar
            filters={filters}
            onResetPage={table.onResetPage}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            rows={tableData}
            options={{ roles: _roles }}
          />

          {canReset && (
            <SectionalTableFiltersResult
              filters={filters}
              totalResults={dataFiltered.length}
              onResetPage={table.onResetPage}
              sx={{ p: 2.5, pt: 0 }}
            />
          )}

          {displayMode === 'panel' && (
            <Box sx={{ position: 'relative' }}>
              {canDelete && (
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
                      <SectionalTableRow
                        key={row.id}
                        row={row}
                        disabled={isRowDisabled(row)}
                        selected={table.selected.includes(row.id)}
                        onSelectRow={() => table.onSelectRow(row.id)}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        editHref={paths.dashboard.level.sectional.edit(row.id)}
                        canManage={canEditSectional(user, row) && !isRowDisabled(row)}
                        canDelete={canDelete && !isRowDisabled(row)}
                        lockMemberCount={isForeignSectionForMembers(user, {
                          sectionId: row.id,
                          regionId: row.regionalId,
                        })}
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

        {displayMode !== 'panel' && (
          <SectionalCardList
            sectionals={dataFiltered.map((row) => ({ ...row, disabled: isRowDisabled(row) }))}
          />
        )}
      </DashboardContent>

      <CompactEntityDeleteDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
        onConfirm={handleDeleteRows}
        selectedCount={table.selected.length}
        entityLabel="secciones"
      />
    </>
  );
}

const getRegionalNameBySectional = (sectional) =>
  sectional?.regionalName || sectional?.regionName || sectional?.nombreRegion || '-';

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters }) {
  const { name, regionalName, role } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  // if (name) {
  //   inputData = inputData.filter((sectional) => normalizeText(sectional.sectionalName).includes(normalizeText(name))
  //   );
  // }
  //Se cambia el anterior para permitir la búsqueda tanto por sectionalName como por memberFullName
  if (name) {
    const keyword = normalizeText(name);
    inputData = inputData.filter(
      (dest) =>
        normalizeText(dest.sectionalName).includes(keyword) ||
        normalizeText(dest.memberFullName).includes(keyword)
    );
  }

  if (regionalName !== 'all') {
    inputData = inputData.filter(
      (sectional) => getRegionalNameBySectional(sectional) === regionalName
    );
  }

  if (role.length) {
    inputData = inputData.filter((sectional) => role.includes(sectional.role));
  }

  return inputData;
}
