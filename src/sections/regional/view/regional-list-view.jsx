'use client';



import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, useSetState } from 'minimal-shared/hooks';

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

import { DashboardContent } from 'src/layouts/dashboard';
import { _roles, USER_STATUS_OPTIONS } from 'src/_mock';
import { REGIONALS, SECTIONALS, DESTS, MEMBERS } from 'src/_mock/assets';
import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { normalizeText } from 'src/utils/normalize-text';
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
import { RegionalTableToolbar } from '../regional-table-toolbar';
import { RegionalTableFiltersResult } from '../regional-table-filters-result';
import { RegionalCardList } from '../regional-card-list';

// ----------------------------------------------------------------------

const STATUS_OPTIONS = [{ value: 'all', label: 'Todos' }, ...USER_STATUS_OPTIONS];

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

  const buildRegionalList = () =>
    REGIONALS.map((regional) => {
      const sectionals = SECTIONALS.filter(
        (s) => s.regionalId === regional.id
      );

      const sectionalCount = sectionals.length;

      const destCount = DESTS.filter((d) =>
        sectionals.some((s) => s.id === d.sectionalId)
      ).length;

      const memberCount = MEMBERS.filter((m) =>
        sectionals.some((s) => s.id === m.sectionalId)
      ).length;

      const director = getLeadershipByRegional(
        regional.id,
        'director_regional'
      );

      return {
        ...regional,

        regionalName: regional.name,
        email: regional.email,

        regionalXSectionalCount: sectionalCount,
        regionalXSectionalXDestCount: destCount,
        regionalXSectionalMemberCount: memberCount,

        memberFullName: director?.fullName ?? 'Desconocido',
        directorId: director?.id ?? null,

        status: 'active',
      };
    });

  const [tableData, setTableData] = useState(buildRegionalList());
  const [displayMode, setDisplayMode] = useState('panel');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const filters = useSetState({ name: '', role: [], status: 'all', regionalXSectionalXDestCount: [], });
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
      const regional = REGIONALS.find(r => r.id === regionParam);

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

  const canReset =
    !!currentFilters.name || currentFilters.role.length > 0 || currentFilters.status !== 'all';

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const handleDeleteRow = useCallback(
    (id) => {
      const deleteRow = tableData.filter((row) => row.id !== id);

      toast.success('Delete success!');

      setTableData(deleteRow);

      table.onUpdatePageDeleteRow(dataInPage.length);
    },
    [dataInPage.length, table, tableData]
  );

  const handleDeleteRows = useCallback(() => {
    const deleteRows = tableData.filter((row) => !table.selected.includes(row.id));

    toast.success('Delete success!');

    setTableData(deleteRows);

    table.onUpdatePageDeleteRows(dataInPage.length, dataFiltered.length);
  }, [dataFiltered.length, dataInPage.length, table, tableData]);

  const handleFilterStatus = useCallback(
    (event, newValue) => {
      table.onResetPage();
      updateFilters({ status: newValue });
    },
    [updateFilters, table]
  );

  const renderConfirmDialog = () => (
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
            handleDeleteRows();
            confirmDialog.onFalse();
          }}
        >
          Delete
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
            { name: 'Regional', href: paths.dashboard.level.regional.root },
            { name: 'Lista' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.level.regional.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              disabled
            >
              Crear nuevo
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <Tabs
            value={currentFilters.status}
            onChange={handleFilterStatus}
            sx={[
              (theme) => ({
                px: { md: 2.5 },
                boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
              }),
            ]}
          >
            {STATUS_OPTIONS.map((tab) => (
              <Tab
                key={tab.value}
                iconPosition="end"
                value={tab.value}
                label={tab.label}
                icon={
                  <Label
                    variant={
                      ((tab.value === 'all' || tab.value === currentFilters.status) && 'filled') ||
                      'soft'
                    }
                    color={
                      (tab.value === 'active' && 'success') ||
                      (tab.value === 'pending' && 'warning') ||
                      (tab.value === 'banned' && 'error') ||
                      'default'
                    }
                  >
                    {['active', 'pending', 'banned', 'rejected'].includes(tab.value)
                      ? tableData.filter((regional) => regional.status === tab.value).length
                      : tableData.length}
                  </Label>
                }
              />
            ))}
          </Tabs>

          <RegionalTableToolbar
            filters={filters}
            onResetPage={table.onResetPage}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
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

            {displayMode === 'panel' ? (
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
            ) : (
              <RegionalCardList regionals={dataFiltered} />
            )}
          </Box>

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
      </DashboardContent>

      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters }) {
  const { name, status, role } = filters;

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

  if (status !== 'all') {
    inputData = inputData.filter((regional) => regional.status === status);
  }

  if (role.length) {
    inputData = inputData.filter((regional) => role.includes(regional.role));
  }

  return inputData;
}
