'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useState, useEffect, useCallback } from 'react';
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

import { normalizeText } from 'src/utils/normalize-text';
import { getStorageCollection } from 'src/utils/storage-service';
import { resolveRegionalFromMember } from 'src/utils/resolve-regional-from-member';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';

import { DashboardContent } from 'src/layouts/dashboard';
import { _leadershipRolesByLevel } from 'src/_mock/_leadership';
import { NATIONAL_X_ASSIGNED_REGIONAL_OPTIONS } from 'src/_mock';

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

import { NationalTableRow } from '../national-table-row';
import { NationalCardList } from '../national-card-list';
import { NationalTableToolbar } from '../national-table-toolbar';
import { NationalTableFiltersResult } from '../national-table-filters-result';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'nationalXname', label: 'Nombre' },
  { id: 'phoneNumber', label: 'Núm. Teléfono', width: 180 },
  { id: 'nationalXMemberPosition', label: 'Posición', width: 200 },
  { id: 'nationalEstructure', label: 'Estructura', width: 200 },
  // { id: 'nationalXAssignedRegional', label: 'Región asignada', width: 160 },
  // { id: 'status', label: 'Estado', width: 100 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export function NationalListView() {

  const [hydrated, setHydrated] = useState(false);

  const table = useTable();

  const confirmDialog = useBoolean();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const allMembers = getStorageCollection('members') || [];
  const leadershipAssignments = getStorageCollection('leadershipAssignments') || [];

  const nationalAssignments = leadershipAssignments.filter((l) =>
    ['national', 'regional', 'sectional'].includes(l.level) &&
    l.status === 'active'
  );

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [displayMode, setDisplayMode] = useState('panel');

  const filters = useSetState({ name: '', nationalXMemberPosition: [], status: 'all', nationalEstructure: [] });

  useEffect(() => {
    if (isMobile) {
      setDisplayMode('grid');
    }
  }, [isMobile]);


  const NATIONAL_STRUCTURES = {
    ministerios_infantiles: 'Ministerios Infantiles',
    consejo_ejecutivo: 'Consejo Ejecutivo',
    oficiales_especiales_nacionales: 'Oficiales Especiales Nacionales',
    directivas_regionales: 'Directivas Regionales',
    directivas_seccionales: 'Directivas Seccionales',
    directivas_zonales: 'Directivas Zonales',
    // directiva_local: 'Directiva Local',
  };

  const tableData = nationalAssignments.map((assignment, index) => {

    const member = allMembers.find((m) => m.id === assignment.memberId);

    const roleConfig =
      _leadershipRolesByLevel[assignment.level]?.find(
        (r) => r.value === assignment.role
      ) ||
      Object.values(_leadershipRolesByLevel)
        .flat()
        .find((r) => r.value === assignment.role);

    const regional = resolveRegionalFromMember(member);
    const regionalName = regional?.name || '-';

    return {
      id: assignment.id,
      memberId: member?.id,
      level: assignment.level,
      nationalXname: `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim(),
      email: member?.email,
      phoneNumber: member?.phoneNumber,

      //  Avatar aleatorio
      // avatarUrl: _mock.image.avatar(index),
      avatarUrl: member?.avatarUrl,

      nationalXMemberPosition: roleConfig?.value,
      nationalXMemberPositionLabel: roleConfig?.label,
      nationalEstructure: roleConfig?.structure || '-',
      nationalEstructureLabel:
        NATIONAL_STRUCTURES[roleConfig?.structure] || '-',

      nationalXAssignedRegional: regionalName,
    };
  });


  const { state: currentFilters, setState: updateFilters } = filters;
  const distinctPositions = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'nationalXMemberPosition',
    labelResolver: (value) =>
      tableData.find(
        (row) => row.nationalXMemberPosition === value
      )?.nationalXMemberPositionLabel,
  });

  const distinctEstructures = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'nationalEstructure',
    labelResolver: (value) =>
      tableData.find(
        (row) => row.nationalEstructure === value
      )?.nationalEstructureLabel,
  });

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

      const updatedAssignments = leadershipAssignments.filter(
        (a) => a.id !== id
      );

      localStorage.setItem(
        'leadershipAssignments',
        JSON.stringify(updatedAssignments)
      );

      toast.success('Eliminado correctamente');

      window.location.reload();
    },
    [leadershipAssignments]
  );

  const handleDeleteRows = useCallback(() => {

    const updatedAssignments = leadershipAssignments.filter(
      (a) => !table.selected.includes(a.id)
    );

    localStorage.setItem(
      'leadershipAssignments',
      JSON.stringify(updatedAssignments)
    );

    toast.success('Eliminados correctamente');

    window.location.reload();

  }, [leadershipAssignments, table.selected]);

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
          ¿Seguro que deseas eliminar <strong> {table.selected.length} </strong> registros?
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
  if (!hydrated) {
    return <></>;
  }
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
              (themeItem) => ({
                px: { md: 2.5 },
                boxShadow: `inset 0 -2px 0 0 ${varAlpha(themeItem.vars.palette.grey['500Channel'], 0.08)}`,
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
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            options={{ nationalXMemberPosition: distinctPositions, nationalEstructure: distinctEstructures, }}
          />

          {canReset && (
            <NationalTableFiltersResult
              filters={filters}
              options={{
                nationalEstructure: distinctEstructures,
                nationalXMemberPosition: distinctPositions,
              }}
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
            ) : (
              <NationalCardList nationals={dataFiltered} />
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
  const { name, status, nationalXMemberPosition, nationalEstructure } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter((national) => normalizeText(national.nationalXname).includes(normalizeText(name))
    );
  }

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
