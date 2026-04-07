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
import { REGIONAL_FULL_NAME_OPTIONS } from 'src/_mock';

import { getSectionals } from 'src/services/sectional-service';
import { getRegionals } from 'src/services/regional-service';
import { getChurches } from 'src/services/church-service';
import { countMembersByDestId } from 'src/utils/member-count';

import { getMembers } from 'src/services/member-service';
import { getLeadershipAssignments } from 'src/services/member-service';

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

import { DestTableRow } from '../dest-table-row';
import { DestTableToolbar } from '../dest-table-toolbar';
import { DestTableFiltersResult } from '../dest-table-filters-result';
import { DestCardList } from '../dest-card-list';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';
// ----------------------------------------------------------------------

const REGIONAL_FULL_NAME = [{ value: 'all', label: 'Todos' }, ...REGIONAL_FULL_NAME_OPTIONS];

const TABLE_HEAD = [
  { id: 'destName', label: 'Destacamento' },
  { id: 'memberFullName', label: 'Coord. Dest', width: 280 },
  { id: 'destMemberCount', label: 'Miembros', width: 120 },
  // { id: 'sectionalName', label: 'Membresía', width: 160 },
  { id: 'sectionalName', label: 'Sección', width: 160 },
  { id: 'regionalName', label: 'Región', width: 140 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------
export function DestListView() {

  const table = useTable();
  const confirmDialog = useBoolean();
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [churches, setChurches] = useState([]);
  const [members, setMembers] = useState([]);

  const buildDestList = (apiDests) => {
    console.log("DESTS API:", apiDests);
    const allDests = apiDests;

    return allDests.map((dest) => {
      if (dest.name === 'Leones De Sion') {
        console.log('DEST PROCESADO:', dest);
      }
      const leadershipAssignments = getLeadershipAssignments();

      const leadership = leadershipAssignments.find(
        (l) =>
          l.level === 'dest' &&
          l.entityId === dest.id &&
          l.role === 'coordinador_dest' &&
          l.status === 'active'
      );

      const coordinator =
        members.find(
          (m) => String(m.memberId) === String(dest.coordinatorId)
        ) ||
        (leadership
          ? members.find(
            (m) =>
              String(m.memberId) === String(leadership.memberId) ||
              String(m.id) === String(leadership.memberId)
          )
          : null);
      const allMembers = members;
      if (dest.name === 'Leones De Sion') {
        console.log('LEADERSHIP ENCONTRADO:', leadership);
        console.log('COORDINADOR ENCONTRADO:', coordinator);
      }

      const sectional = sectionals.find(
        (s) => s.id === dest.sectionalId
      );
      if (dest.name === 'Leones De Sion') {
        console.log('SECTION BUSCADA:', dest.sectionalId);
        console.log('SECTION ENCONTRADA:', sectional);
      }

      const church = churches.find(
        (c) => c.id === dest.churchId
      );
      if (dest.name === 'Leones De Sion') {
        console.log('CHURCH BUSCADA:', dest.churchId);
        console.log('CHURCH ENCONTRADA:', church);
      }

      const regional = regionals.find(
        (r) => r.id === sectional?.regionalId || r.id === church?.regionalId
      );
      if (dest.name === 'Leones De Sion') {
        console.log('REGION BUSCADA:', sectional?.regionalId);
        console.log('REGION ENCONTRADA:', regional);
      }

      return {
        ...dest,
        destName: dest.name,

        churchName: church?.name ?? dest?.churchName ?? '',

        sectionalId: church?.sectionalName,

        memberFullName: coordinator
          ? `${coordinator.firstName ?? ''} ${coordinator.lastName ?? ''}`.trim()
          : 'Desconocido',

        memberFirstName: coordinator?.firstName ?? '',
        memberLastName: coordinator?.lastName ?? '',

        destMemberCount: countMembersByDestId(allMembers, dest.id),

        sectionalName: church?.sectionalName,
        regionalName: regional?.name ?? '-',
      };
    });
  };

  const [tableData, setTableData] = useState([]);

  const [displayMode, setDisplayMode] = useState('panel');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  useEffect(() => {
    if (isMobile) {
      setDisplayMode('grid');
    }
  }, [isMobile]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dest');
      const data = await res.json();

      const built = buildDestList(data?.Data || []);
      setTableData(built);
    };

    load();
  }, [members, churches, sectionals, regionals]);

  useEffect(() => {
    async function load() {
      const [
        sectionalsData,
        regionalsData,
        churchesData,
        membersData,
      ] = await Promise.all([
        getSectionals(),
        getRegionals(),
        getChurches(),
        getMembers(),
      ]);

      setSectionals(Array.isArray(sectionalsData) ? sectionalsData : []);
      setRegionals(Array.isArray(regionalsData) ? regionalsData : []);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
    }

    load();
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

    return tableData.filter(
      (dest) => dest.regionalName === regionName
    ).length;
  };

  const distinctSectionalFullName = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'sectionalId',
    labelResolver: (name) => name,
  });

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

    const church = getChurches().find(
      (c) => c.id === dest.churchId
    );

    if (!sectional) return;

    updateFilters({ sectionalName: [sectional.id] });
    table.onResetPage();

    appliedFromUrl.current = true;
  }, [sectionalFromUrl, updateFilters, table]);

  useEffect(() => { //vista panel en pantalla pequeña, use DENSE true
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

    const regional = regionals.find(
      (r) => r.id === regionFromUrl
    );
    console.log("REGION BUSCADA:", sectional?.regionalId);
    console.log("REGION ENCONTRADA:", regional);

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


  const dataFiltered = applyFilter({
    inputData: tableData,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name || currentFilters.sectionalName.length > 0 || currentFilters.regionalName !== 'all';

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

  const handleFilterRegionalFullName = useCallback(
    (event, newValue) => {
      table.onResetPage();
      updateFilters({ regionalName: newValue });
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
          heading="Lista Destacamentos"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Destacamentos', href: paths.dashboard.level.dest.root },
            { name: 'Lista' },
          ]}
          action={
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
              (theme) => ({
                px: { md: 2.5 },
                boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
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
                      ((tab.value === 'all' || tab.value === currentFilters.regionalName) && 'filled') ||
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
            options={{ sectionalName: distinctSectionalFullName }}
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
                          <DestTableRow
                            key={`${row.id || row.idDestacamento}-${row.destName}`}
                            row={row}
                            selected={table.selected.includes(row.id)}
                            onSelectRow={() => table.onSelectRow(row.id)}
                            onDeleteRow={() => handleDeleteRow(row.id)}
                            editHref={paths.dashboard.level.dest.edit(row.id)}
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
              </>
            ) : (
              <DestCardList dests={dataFiltered} />
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

    inputData = inputData.filter((dest) => {
      const coordinator =
        members.find(
          (m) => String(m.memberId) === String(dest.coordinatorId)
        );

      return normalizeText(
        `${coordinator?.firstName || ''} ${coordinator?.lastName || ''} ${dest.destName || ''} ${dest.churchName || ''} ${dest.coordinatorId || ''}`
      ).includes(keyword);
    });
  }

  if (regionalName !== 'all') {
    inputData = inputData.filter(
      (dest) => dest.regionalName === regionalName
    );
  }

  if (sectionalName.length) {
    inputData = inputData.filter((dest) =>
      sectionalName.includes(dest.sectionalName)
    );
  }

  return inputData;
}
