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
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { normalizeText } from 'src/utils/normalize-text';

import { _roles } from 'src/_mock';
import { MEMBERS, REGIONALS } from 'src/_mock/assets';
import { DashboardContent } from 'src/layouts/dashboard';
import { getSectionals } from 'src/services/sectional-service';
import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';
import { getRegionals, deleteRegional } from 'src/services/regional-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  rowInPage,
  TableNoData,
  getComparator,
  TableEmptyRows,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

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

// ----------------------------------------------------------------------

export function RegionalListView() {
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

  useEffect(() => {
    async function loadRegionals() {
      const regionals = await getRegionals();
      const sectionals = await getSectionals();

      const resChurches = await fetch('/api/churches');
      const dataChurches = await resChurches.json();
      const churches = dataChurches?.data || dataChurches?.Data || [];

      const resDests = await fetch('/api/dest');
      const dataDests = await resDests.json();
      const dests = dataDests?.data || dataDests?.Data || [];

      const resMembers = await fetch('/api/members');
      const dataMembers = await resMembers.json();
      const members = dataMembers?.data || dataMembers?.Data || [];

      const newData = regionals.map((regional) => {
        const director = getLeadershipByRegional(regional.id, 'director_regional');
        const seccionesDeRegion = sectionals.filter(
          (s) => Number(s.regionalId) === Number(regional.id)
        );

        const iglesiasDeRegion = churches.filter((c) =>
          seccionesDeRegion.some((s) => Number(s.idSeccion) === Number(c.idSeccion))
        );

        const destCount = dests.filter((d) =>
          iglesiasDeRegion.some((ig) => Number(ig.idIglesia) === Number(d.idIglesia))
        ).length;
        const miembrosDeRegion = members.filter(
          (m) =>
            m.idDestacamento !== null &&
            dests.some(
              (d) =>
                Number(d.idDestacamento) === Number(m.idDestacamento) &&
                iglesiasDeRegion.some((ig) => Number(ig.idIglesia) === Number(d.idIglesia))
            )
        ).length;
        return {
          ...regional,
          memberFullName: director?.fullName || 'Desconocido',
          directorId: director?.id ?? null,
          regionalXSectionalXDestCount: destCount,
          regionalXSectionalMemberCount: miembrosDeRegion,
        };
      });

      setTableData(newData);
    }

    loadRegionals();
  }, []);
  const [displayMode, setDisplayMode] = useState('panel');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  const isFirstLoad = useRef(true);

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

  useEffect(() => {
    if (isMobile) {
      setDisplayMode('grid');
    }
  }, [isMobile]);

  const dataFiltered = applyFilter({
    inputData: tableData,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset = !!currentFilters.name || currentFilters.role.length > 0;

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        await deleteRegional(id);

        const deleteRow = tableData.filter((row) => row.id !== id);

        toast.success('Regional eliminada correctamente.');

        setTableData(deleteRow);

        table.onUpdatePageDeleteRow(dataInPage.length);
      } catch (error) {
        console.error('Error eliminando regional:', error);
        toast.error(error?.message || 'No se pudo eliminar la regional.');
      }
    },
    [dataInPage.length, table, tableData]
  );

  const handleDeleteRows = useCallback(async () => {
    try {
      await Promise.all(table.selected.map((id) => deleteRegional(id)));

      const deleteRows = tableData.filter((row) => !table.selected.includes(row.id));

      toast.success('Regionales eliminadas correctamente.');

      setTableData(deleteRows);

      table.onUpdatePageDeleteRows(dataInPage.length, dataFiltered.length);
    } catch (error) {
      console.error('Error eliminando regionales:', error);
      toast.error(error?.message || 'No se pudieron eliminar las regionales.');
    }
  }, [dataFiltered.length, dataInPage.length, table, tableData]);

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content={
        <>
          ¿Seguro que deseas eliminar <strong> {table.selected.length} </strong> regionales?
        </>
      }
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            handleDeleteRows();
            confirmDialog.onFalse();
          }}
        >
          Eliminar
        </Button>
      }
    />
  );

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
            <Button
              component={RouterLink}
              href={paths.dashboard.level.regional.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Crear nuevo
            </Button>
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

                  <TableBody>
                    {dataFiltered
                      .slice(
                        table.page * table.rowsPerPage,
                        table.page * table.rowsPerPage + table.rowsPerPage
                      )
                      .map((row) => (
                        <RegionalTableRow
                          key={row.id}
                          row={row}
                          selected={table.selected.includes(row.id)}
                          onSelectRow={() => table.onSelectRow(row.id)}
                          onDeleteRow={() => handleDeleteRow(row.id)}
                          editHref={paths.dashboard.level.regional.edit(row.id)}
                        />
                      ))}

                    <TableEmptyRows
                      height={table.dense ? 56 : 56 + 20}
                      emptyRows={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)}
                    />

                    <TableNoData notFound={notFound} />
                  </TableBody>
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

        {displayMode !== 'panel' && <RegionalCardList regionals={dataFiltered} />}
      </DashboardContent>

      {renderConfirmDialog()}
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
