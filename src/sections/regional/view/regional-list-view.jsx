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
import { canManageOrgLevels } from 'src/utils/admin-role-label';
import { isRegionWideSectionViewer } from 'src/utils/member-access';
import { canEditRegional, canDeleteOrgLevel } from 'src/utils/org-level-access';

import { _roles } from 'src/_mock';
import { MEMBERS, REGIONALS } from 'src/_mock/assets';
import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getSectionals } from 'src/services/sectional-service';
import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';
import { getRegionals, deleteRegional, getCachedRegionals } from 'src/services/regional-service';

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

import { RegionalTableRow } from '../regional-table-row';
import { RegionalCardList } from '../regional-card-list';
import { RegionalTableToolbar } from '../regional-table-toolbar';
import { RegionalTableFiltersResult } from '../regional-table-filters-result';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'regionalName', label: 'Región' },
  { id: 'memberFullName', label: 'Director', width: 270 },
  { id: 'regionalXSectionalCount', label: 'Secciones', width: 140 },
  { id: 'regionalXSectionalXDestCount', label: 'Destacamentos', width: 140 },
  { id: 'regionalXSectionalMemberCount', label: 'Miembros', width: 140 },
  // { id: 'status', label: 'Estado', width: 100 },
  { id: '', width: 88 },
];

const mapRegionalToBaseRow = (regional) => ({
  ...regional,
  memberFullName: 'Desconocido',
  directorId: null,
  regionalXSectionalCount: 0,
  regionalXSectionalXDestCount: 0,
  regionalXSectionalMemberCount: 0,
});

const normalizeId = (value) => String(value ?? '').trim();

const idMatches = (left, right) => {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);

  return Boolean(leftId && rightId && leftId === rightId);
};

const getRegionalId = (regional = {}) => regional?.id ?? regional?.idRegion ?? regional?.regionId;

const getSectionalRegionalId = (sectional = {}) =>
  sectional?.regionalId ?? sectional?.idRegion ?? sectional?.regionId;

const getSectionalId = (sectional = {}) =>
  sectional?.idSeccion ?? sectional?.id ?? sectional?.sectionalId;

const getChurchIdCandidates = (church = {}) =>
  [church?.id, church?.idIglesia, church?.churchId]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(normalizeId);

const getChurchSectionId = (church = {}) =>
  church?.idSeccion ?? church?.seccionId ?? church?.sectionId ?? church?.sectionalId;

const getDestId = (dest = {}) => dest?.id ?? dest?.idDestacamento ?? dest?.destId;

const getDestChurchId = (dest = {}) => dest?.churchId ?? dest?.idIglesia ?? dest?.church?.id;

const getMemberDestId = (member = {}) =>
  member?.idDestacamento ?? member?.destId ?? member?.destacamentoId;

// ----------------------------------------------------------------------

export function RegionalListView() {
  const { user } = useAuthContext();
  const canManage = canManageOrgLevels(user);
  // Cargos de solo lectura (p. ej. Lider de Grupo): los contadores de las
  // regionales se muestran deshabilitados (sin enlace y atenuados).
  const disabledCounts = isRegionWideSectionViewer(user);
  const table = useTable();

  const confirmDialog = useBoolean();

  const getLeadershipByRegional = (regionalId, role) => {
    const assignment = LEADERSHIP_ASSIGNMENTS.find(
      (a) =>
        a.level === 'regional' &&
        a.entityId === regionalId &&
        a.role === role &&
        a.status === 'active'
    );

    return MEMBERS.find((m) => m.id === assignment?.memberId) || null;
  };

  const [tableData, setTableData] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);

  useEffect(() => {
    async function loadRegionals() {
      const cachedRegionals = getCachedRegionals();

      if (cachedRegionals.length) {
        setTableData(cachedRegionals.map(mapRegionalToBaseRow));
        setTableLoading(false);
      } else {
        setTableLoading(true);
      }

      try {
        // Fase 1: una sola tanda en paralelo (antes getRegionals se resolvia
        // en serie antes del resto, sumando su latencia al total).
        const [regionals, sectionals, churches, dests, members] = await Promise.all([
          getRegionals(),
          getSectionals({ includePhotos: false }),
          getChurches(),
          getDestsApi({ includePhotos: false }),
          getMembers(),
        ]);
        setTableData(regionals.map(mapRegionalToBaseRow));
        setTableLoading(false);
        const memberById = new Map(
          [...MEMBERS, ...members].flatMap((member) =>
            [member?.id, member?.memberId].filter(Boolean).map((id) => [String(id), member])
          )
        );

        const newData = regionals.map((regional) => {
          const directorAssignment = LEADERSHIP_ASSIGNMENTS.find(
            (a) =>
              a.level === 'regional' &&
              a.entityId === regional.id &&
              a.role === 'director_regional' &&
              a.status === 'active'
          );
          const director =
            memberById.get(String(directorAssignment?.memberId || '')) ||
            getLeadershipByRegional(regional.id, 'director_regional');
          const directorName =
            director?.fullName ||
            [director?.firstName, director?.lastName].filter(Boolean).join(' ').trim() ||
            'Desconocido';
          const seccionesDeRegion = sectionals.filter((s) =>
            idMatches(getSectionalRegionalId(s), getRegionalId(regional))
          );

          const sectionIdsDeRegion = new Set(
            seccionesDeRegion.map((s) => normalizeId(getSectionalId(s)))
          );

          const churchIdsDeRegion = new Set(
            churches
              .filter((c) => sectionIdsDeRegion.has(normalizeId(getChurchSectionId(c))))
              .flatMap((c) => getChurchIdCandidates(c))
          );

          const destsDeRegion = dests.filter((d) =>
            churchIdsDeRegion.has(normalizeId(getDestChurchId(d)))
          );

          const destIdsDeRegion = new Set(destsDeRegion.map((d) => normalizeId(getDestId(d))));

          const destCount = destsDeRegion.length;
          const miembrosDeRegion = members.filter((m) =>
            destIdsDeRegion.has(normalizeId(getMemberDestId(m)))
          ).length;
          return {
            ...regional,
            memberFullName: directorName,
            directorId: director?.id ?? director?.memberId ?? null,
            directorAvatarUrl: director?.avatarUrl || '',
            directorPhoneNumber: director?.phoneNumber || '',
            regionalXSectionalCount: seccionesDeRegion.length,
            regionalXSectionalXDestCount: destCount,
            regionalXSectionalMemberCount: miembrosDeRegion,
          };
        });

        setTableData(newData);
      } catch (error) {
        console.error('Error loading regionals:', error);
        setTableData([]);
        setTableLoading(false);
      }
    }

    loadRegionals();
  }, []);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const displayMode = selectedDisplayMode || (isMobile ? 'grid' : 'panel');
  const setDisplayMode = useCallback((nextMode) => {
    setSelectedDisplayMode(nextMode);
  }, []);
  const filters = useSetState({
    name: '',
    role: [],
    status: 'all',
    regionalXSectionalXDestCount: [],
  });
  const { state: currentFilters, setState: updateFilters } = filters;
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('sectional');
  const regionParam = searchParams.get('region');
  const nationalParam = searchParams.get('national');
  const hasAppliedUrlFilter = useRef(false);

  useEffect(() => {
    if (hasAppliedUrlFilter.current) return;

    // Si viene region por ID (ej: reg-norte)
    if (regionParam) {
      const regional = REGIONALS.find((r) => r.id === regionParam);

      if (regional) {
        updateFilters({ name: regional.name });
        table.onResetPage();
        hasAppliedUrlFilter.current = true;
        return;
      }
    }

    // Si viene por nombre desde sectional o national
    const nameFromUrl = sectionParam || nationalParam;

    if (!nameFromUrl) return;

    updateFilters({ name: decodeURIComponent(nameFromUrl) });
    table.onResetPage();

    hasAppliedUrlFilter.current = true;
  }, [regionParam, sectionParam, nationalParam, updateFilters, table]);

  useEffect(() => {
    if (!sectionParam) return;
    if (hasAppliedUrlFilter.current) return;

    updateFilters({ name: decodeURIComponent(sectionParam) });
    table.onResetPage();

    hasAppliedUrlFilter.current = true;
  }, [sectionParam, updateFilters, table]);

  const dataFiltered = applyFilter({
    inputData: tableData,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset = !!currentFilters.name || currentFilters.role.length > 0;

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const { handleDeleteRow, handleDeleteRows } = useCompactEntityDelete({
    table,
    tableData,
    setTableData,
    dataInPageLength: dataInPage.length,
    dataFilteredLength: dataFiltered.length,
    deleteItem: (id) =>
      deleteRegional(id, {
        usuario: user,
        antes: tableData.find((row) => String(row.id) === String(id)),
      }),
    singleSuccessMessage: 'Regional eliminada correctamente.',
    singleErrorMessage: 'No se pudo eliminar la regional.',
    multipleSuccessMessage: 'Regionales eliminadas correctamente.',
    multipleErrorMessage: 'No se pudieron eliminar las regionales.',
  });

  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Lista de Regionales"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Región', href: paths.dashboard.level.regional.root },
            { name: 'Lista' },
          ]}
          action={
            canManage ? (
              <Button
                component={RouterLink}
                href={paths.dashboard.level.regional.new}
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
            value={currentFilters.status}
            sx={[
              (themeItem) => ({
                px: { md: 2.5 },
                boxShadow: `inset 0 -2px 0 0 ${varAlpha(themeItem.vars.palette.grey['500Channel'], 0.08)}`,
              }),
            ]}
          >
            <Tab
              value="all"
              label="Todos"
              iconPosition="end"
              icon={<Label variant="filled">{tableData.length}</Label>}
            />
          </Tabs>

          <RegionalTableToolbar
            filters={filters}
            onResetPage={table.onResetPage}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            rows={tableData}
            options={{ roles: _roles }}
          />

          {canReset && (
            <RegionalTableFiltersResult
              filters={filters}
              totalResults={dataFiltered.length}
              onResetPage={table.onResetPage}
              sx={{ p: 2.5, pt: 0 }}
            />
          )}

          {displayMode === 'panel' && (
            <Box sx={{ position: 'relative' }}>
              {canManage && (
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
                      <RegionalTableRow
                        key={row.id}
                        row={row}
                        selected={table.selected.includes(row.id)}
                        onSelectRow={() => table.onSelectRow(row.id)}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        editHref={paths.dashboard.level.regional.edit(row.id)}
                        canManage={canEditRegional(user, row)}
                        canDelete={canDeleteOrgLevel(user)}
                        disabledCounts={disabledCounts}
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
          <RegionalCardList regionals={dataFiltered} disabledCounts={disabledCounts} />
        )}
      </DashboardContent>

      <CompactEntityDeleteDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
        onConfirm={handleDeleteRows}
        selectedCount={table.selected.length}
        entityLabel="regionales"
      />
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters }) {
  const { name, role } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  //Se cambia el anterior para permitir la búsqueda tanto por regionalName como por memberFullName
  if (name) {
    const keyword = normalizeText(name);
    inputData = inputData.filter(
      (dest) =>
        normalizeText(dest.regionalName).includes(keyword) ||
        normalizeText(dest.memberFullName).includes(keyword)
    );
  }

  if (role.length) {
    inputData = inputData.filter((regional) => role.includes(regional.role));
  }

  return inputData;
}
