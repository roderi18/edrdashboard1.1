'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { DESTS, SECTIONALS } from 'src/_mock/assets';
import { _allLeadershipRoles } from 'src/_mock/_leadership';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';
import { getMembers } from 'src/services/member-service';
import { getLeadershipAssignments } from 'src/services/member-service';

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
import { MEMBER_DIVISION_OPTIONS } from 'src/_mock';
import { useTheme, useMediaQuery } from '@mui/material';
import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { normalizeText } from 'src/utils/normalize-text';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { getMemberFullName } from 'src/utils/get-member-fullname';
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

import { MemberTableRow } from '../member-table-row';
import { MemberTableToolbar } from '../member-table-toolbar';
import { MemberTableFiltersResult } from '../member-table-filters-result';
import { MemberCardList } from '../member-card-list';
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Nombre' },
  // { id: 'phoneNumber', label: 'Núm. Teléfono', width: 220 },
  { id: 'destName', label: 'Destacamento', width: 250 },
  { id: 'memberPosition', label: 'Posición', width: 180 },
  { id: 'sectionalName', label: 'Sección', width: 160 },
  { id: 'memberDivision', label: 'División', width: 90 },

  // { id: 'status', label: 'Estado', width: 100 },
  { id: '', width: 88 },
];
// ----------------------------------------------------------------------

export function MemberListView() {
  const table = useTable();
  const [displayMode, setDisplayMode] = useState('panel');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (isMobile) {
      setDisplayMode('grid');
    }
  }, [isMobile]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const confirmDialog = useBoolean();

  const [tableData, setTableData] = useState(() => {
    const members = getMembers();
    const leadershipAssignments = getLeadershipAssignments();

    return members.map((member) => {
      const dest = DESTS.find((d) => d.id === member.destId);
      const memberLeaderships = leadershipAssignments.filter(
        (l) =>
          (l.memberId === member.id || l.member_id === member.id) &&
          (l.status === 'active' || !l.status)
      );
      const sectional = SECTIONALS.find((s) => s.id === dest?.sectionalId);

      return {
        ...member,
        id: member.id,
        memberId: member.id,
        name: getMemberFullName(member),
        sectionalId: dest?.sectionalId,
        sectionalName: sectional?.name,
        memberPosition: memberLeaderships.map((l) => l.role),
      };
    });
  });

  const filters = useSetState({ name: '', memberPosition: [], memberDivision: [], sectionalId: [], destName: [] });
  const { state: currentFilters, setState: updateFilters } = filters;
  const distinctdestName = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'destId',
    labelResolver: (id) =>
      DESTS.find((d) => d.id === id)?.name,
  });
  const distinctPositions = [
    ...new Set(tableData.flatMap((m) => m.memberPosition || [])),
  ].map((role) => {
    const roleInfo = _allLeadershipRoles.find((r) => r.value === role);

    return {
      value: role,
      label: roleInfo?.label || role,
    };
  });
  const distinctSectionals = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'sectionalId',
    labelResolver: (id) =>
      SECTIONALS.find((s) => s.id === id)?.name,
  });
  const searchParams = useSearchParams();
  const memberIdFromUrl = searchParams.get('member');
  const destFromUrl = searchParams.get('dest');
  const sectionFromUrl = searchParams.get('sectional');
  const appliedFromUrl = useRef(false);

  useEffect(() => {
    if (appliedFromUrl.current) return;

    if (destFromUrl) {
      updateFilters({ destName: [destFromUrl] });
      table.onResetPage();
      appliedFromUrl.current = true;
      return;
    }

    if (sectionFromUrl) {
      updateFilters({ sectionalId: [sectionFromUrl] });
      table.onResetPage();
      appliedFromUrl.current = true;
    }
  }, [destFromUrl, sectionFromUrl, updateFilters, table]);


  const memberFromUrl = memberIdFromUrl
    ? tableData.find((m) => m.id === memberIdFromUrl || m.memberId === memberIdFromUrl)
    : null;

  const dataFiltered = applyFilter({
    inputData: tableData,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name || currentFilters.destName.length > 0 || currentFilters.memberPosition.length > 0 || currentFilters.memberDivision.length > 0 || currentFilters.sectionalId.length > 0;;

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

  const handleFilterdestName = useCallback(
    (event, newValue) => {
      table.onResetPage();
      updateFilters({
        destName: newValue === 'all' ? [] : [newValue],
      });
    },
    [updateFilters, table]
  );

  const handleFilterSectionalId = useCallback((event) => {
    const newValue =
      typeof event.target.value === 'string'
        ? event.target.value.split(',')
        : event.target.value;

    table.onResetPage();
    updateFilters({ sectionalId: newValue });
  }, [table, updateFilters]);

  const handleFilterMemberDivisionTab = useCallback(
    (event, newValue) => {
      table.onResetPage();
      updateFilters({
        memberDivision: newValue === 'all' ? [] : [newValue],
      });
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

  if (!hydrated) return null;

  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Lista de miembros"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Miembros', href: paths.dashboard.level.member.root },

            ...(memberFromUrl
              ? [{ name: `${memberFromUrl.firstName} ${memberFromUrl.lastName}` }]
              : [{ name: 'Lista' }]),
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.level.member.new}
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
            value={currentFilters.memberDivision[0] || 'all'}
            onChange={handleFilterMemberDivisionTab}
            sx={[
              (theme) => ({
                px: { md: 2.5 },
                boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
              }),
            ]}
          >
            {/* <Tab label="Todos" value="all" /> */}
            {MEMBER_DIVISION_OPTIONS.map((tab) => (
              <Tab
                key={tab.value}
                iconPosition="end"
                value={tab.value}
                label={tab.label}
                icon={
                  <Label
                    variant={
                      ((tab.value === 'all' || tab.value === currentFilters.memberDivision) && 'filled') ||
                      'soft'
                    }
                    color={
                      (tab.value === 'Liderazgo' && 'default') ||
                      (tab.value === 'Exploradores' && 'success') ||
                      (tab.value === 'Seguidores' && 'error') ||
                      (tab.value === 'Pioneros' && 'error') ||
                      (tab.value === 'Navegantes' && 'warning') ||
                      'default'
                    }
                  >
                    {['Liderazgo', 'Exploradores', 'Seguidores', 'Pioneros', 'Navegantes'].includes(tab.value)
                      ? tableData.filter((sectional) => sectional.memberDivision === tab.value).length
                      : tableData.length}
                  </Label>
                }
              />
            ))}
          </Tabs>

          <MemberTableToolbar
            filters={filters}
            onResetPage={table.onResetPage}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            options={{
              destName: distinctdestName,
              memberPosition: distinctPositions,
              memberDivision: MEMBER_DIVISION_OPTIONS,
              sectionalId: distinctSectionals,
            }}
          />

          {canReset && (
            <MemberTableFiltersResult
              filters={filters}
              options={{
                destName: distinctdestName,
                memberPosition: distinctPositions,
                sectionalId: distinctSectionals,
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
              <>
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
                          <MemberTableRow
                            key={row.id}
                            row={row}
                            selected={table.selected.includes(row.id)}
                            onSelectRow={() => table.onSelectRow(row.id)}
                            onDeleteRow={() => handleDeleteRow(row.id)}
                            editHref={paths.dashboard.level.member.edit(row.id)}
                          />
                        ))}

                      <TableEmptyRows
                        height={table.dense ? 56 : 76}
                        emptyRows={emptyRows(
                          table.page,
                          table.rowsPerPage,
                          dataFiltered.length
                        )}
                      />

                      <TableNoData notFound={notFound} />
                    </TableBody>
                  </Table>
                </Scrollbar>


              </>
            ) : (
              <MemberCardList members={dataFiltered} />
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
  const { name, memberDivision, memberPosition, sectionalId, destName } = filters;

  // if (status && status !== 'all') {
  //   inputData = inputData.filter((member) => member.status === status);
  // }
  if (destName.length) {
    inputData = inputData.filter((member) =>
      destName.includes(member.destId)
    );
  }

  if (memberDivision.length) {
    inputData = inputData.filter((member) =>
      memberDivision.includes(member.memberDivision)
    );
  }

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter((member) =>
      normalizeText(
        `${member.firstName || ''} ${member.lastName || ''}`
      ).includes(normalizeText(name))
    );
  }

  if (sectionalId.length) {
    inputData = inputData.filter((member) =>
      sectionalId.includes(member.sectionalId)
    );
  }

  if (memberPosition?.length) {
    inputData = inputData.filter((member) =>
      member.memberPosition?.some((role) => memberPosition.includes(role))
    );
  }

  return inputData;
}
