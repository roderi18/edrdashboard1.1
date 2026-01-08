'use client';

import { useState, useCallback } from 'react';
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

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';
import { _nationalXMemberPositions, _roles, _nationalList, NATIONAL_X_ASSIGNED_REGIONAL_OPTIONS, NATIONAL_ESTRUCTURE_OPTIONS } from 'src/_mock';

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

import { NationalTableRow } from '../national-table-row';
import { NationalTableToolbar } from '../national-table-toolbar';
import { NationalTableFiltersResult } from '../national-table-filters-result';

// ----------------------------------------------------------------------

// const STATUS_OPTIONS = [{ value: 'all', label: 'All' }, ...USER_STATUS_OPTIONS];

// const TABLE_HEAD = [
//   { id: 'name', label: 'Name' },
//   { id: 'phoneNumber', label: 'Núm. Teléfono', width: 180 },
//   { id: 'company', label: 'Company', width: 220 },
//   { id: 'Role', label: 'Role', width: 180 },
//   { id: 'status', label: 'Estado', width: 100 },
//   { id: '', width: 88 },
// ];

const TABLE_HEAD = [
  { id: 'nationalXMemberName', label: 'Nombre' },
  { id: 'phoneNumber', label: 'Núm. Teléfono', width: 160 },
  { id: 'nationalXMemberPosition', label: 'Posición', width: 180 },
  { id: 'nationalEstructure', label: 'Estructura', width: 180 },
  { id: 'nationalXAssignedRegional', label: 'Región asignada', width: 160 },
  // { id: 'status', label: 'Estado', width: 100 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export function NationalListView() {
  const table = useTable();

  const confirmDialog = useBoolean();

  const [tableData, setTableData] = useState(_nationalList);

  const filters = useSetState({ name: '', nationalXMemberPosition: [], status: 'all', nationalEstructure: [] });
  const { state: currentFilters, setState: updateFilters } = filters;
  const distinctPositions = [...new Set(_nationalXMemberPositions)];
  const distinctEstructures = NATIONAL_ESTRUCTURE_OPTIONS;

  const dataFiltered = applyFilter({
    inputData: tableData,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name || currentFilters.nationalXMemberPosition.length > 0 || currentFilters.nationalEstructure.length > 0 || currentFilters.status !== 'all';

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
          heading="Lista de nacionales"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Nacional', href: paths.dashboard.level.national.root },
            { name: 'Lista' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.level.national.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Agregar nacional
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
            {NATIONAL_X_ASSIGNED_REGIONAL_OPTIONS.map((tab) => (
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
                    // color={
                    //   (tab.value === 'active' && 'success') ||
                    //   (tab.value === 'pending' && 'warning') ||
                    //   (tab.value === 'banned' && 'error') ||
                    //   'default'
                    // }
                    color={
                      (tab.value === 'Región Central' && 'success') ||
                      (tab.value === 'Región Norte' && 'warning') ||
                      (tab.value === 'Región Sur' && 'error') ||
                      (tab.value === 'Región Este' && 'error') ||
                      'default'
                    }
                  >
                    {/* {['active', 'pending', 'banned', 'rejected'].includes(tab.value) */}
                    {['Región Central', 'Región Norte', 'Región Sur', 'Región Este'].includes(tab.value)
                      // ? tableData.filter((national) => national.status === tab.value).length
                      ? tableData.filter((national) => national.nationalXAssignedRegional === tab.value).length
                      : tableData.length}
                  </Label>
                }
              />
            ))}
          </Tabs>

          <NationalTableToolbar
            filters={filters}
            onResetPage={table.onResetPage}
            // options={{ roles: _roles }}
            options={{ nationalXMemberPosition: distinctPositions, nationalEstructure: distinctEstructures, }}
          />

          {canReset && (
            <NationalTableFiltersResult
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
                      <NationalTableRow
                        key={row.id}
                        row={row}
                        selected={table.selected.includes(row.id)}
                        onSelectRow={() => table.onSelectRow(row.id)}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        editHref={paths.dashboard.level.national.edit(row.id)}
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

          <TablePaginationCustom
            page={table.page}
            dense={table.dense}
            count={dataFiltered.length}
            rowsPerPage={table.rowsPerPage}
            onPageChange={table.onChangePage}
            onChangeDense={table.onChangeDense}
            onRowsPerPageChange={table.onChangeRowsPerPage}
          />
        </Card>
      </DashboardContent>

      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters }) {
  const { name, status, nationalXMemberPosition, nationalEstructure } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter((national) => normalizeText(national.nationalXMemberName).includes(normalizeText(name))
    );
  }
  // if (name) {
  //   const keyword = normalizeText(name);
  //   inputData = inputData.filter(
  //     (dest) =>
  //       normalizeText(dest.nationalXMemberName).includes(keyword) ||
  //       normalizeText(dest.nationalXMemberPosition).includes(keyword)
  //   );
  // }

  if (status !== 'all') {
    inputData = inputData.filter((national) => national.nationalXAssignedRegional === status);
  }

  if (nationalEstructure.length) {
    inputData = inputData.filter((national) => nationalEstructure.includes(national.nationalEstructure));
  }

  if (nationalXMemberPosition.length) {
    inputData = inputData.filter((national) => nationalXMemberPosition.includes(national.nationalXMemberPosition));
  }

  return inputData;
}
