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

import { REGIONALS } from 'src/_mock/assets';
import { DashboardContent } from 'src/layouts/dashboard';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { _roles, REGIONAL_FULL_NAME_OPTIONS } from 'src/_mock';
import { getMembers , getLeadershipAssignments } from 'src/services/member-service';

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

// ----------------------------------------------------------------------

const getLeadershipBySectional = (sectionalId, role) => {
  const leaderships = getLeadershipAssignments();
  const members = getMembers();

  const assignment = leaderships.find(
    (a) =>
      a.level === 'sectional' &&
      a.entityId === sectionalId &&
      a.role === role &&
      a.memberId
  );

  return members.find((m) => m.id === assignment?.memberId) || null;
};

const buildSectionalList = async () => {
  const sectionals = await getSectionals();
  const regionals = await getRegionals();
  const members = await getMembers();

  const res = await fetch('/api/dest');
  const data = await res.json();
  const dests = data?.data || data?.Data || [];
  const resChurches = await fetch('/api/churches');
  const dataChurches = await resChurches.json();
  const churches = dataChurches?.data || dataChurches?.Data || [];


  const leaderships = getLeadershipAssignments();

  return sectionals.map((sectional) => {
    const regional = regionals.find((r) => r.id === sectional.regionalId);


    const director = members.find(
      (m) =>
        String(m.id) === String(sectional.directorId) ||
        String(m.memberId) === String(sectional.directorId)
    );

    const iglesiasDeSeccion = churches.filter(
      (c) =>
        c.idSeccion &&
        Number(c.idSeccion) === Number(sectional.idSeccion)
    );


    const destCount = dests.filter((d) =>
      iglesiasDeSeccion.some(
        (ig) => Number(ig.idIglesia) === Number(d.idIglesia)
      )
    ).length;

    const destsBySectional = dests.filter((d) =>
      iglesiasDeSeccion.some(
        (ig) => Number(ig.idIglesia || ig.id) === Number(d.idIglesia)
      )
    );

    const membersCount = members.filter((member) =>
      destsBySectional.some(
        (dest) => Number(dest.idDestacamento) === Number(member.idDestacamento)
      )
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
    };
  });
};

export function SectionalListView() {
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
  const [displayMode, setDisplayMode] = useState('panel');
  const [isClient, setIsClient] = useState(false);

  const [regionals, setRegionals] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
    !!currentFilters.name || currentFilters.role.length > 0 || currentFilters.regionalName !== 'all';

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

  useEffect(() => {
    async function loadData() {
      const regionalsData = await getRegionals();
      setRegionals(regionalsData);

      const data = await buildSectionalList();
      setTableData(data);
    }

    loadData();
  }, []);

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
    if (isMobile) {
      setDisplayMode('grid');
    }
  }, [isMobile]);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
          heading="Lista de Seccionales"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Sección', href: paths.dashboard.level.sectional.root },
            { name: 'Lista' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.level.sectional.new}
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
                    {isClient
                      ? tab.value === 'all'
                        ? tableData.length
                        : tableData.filter((row) => regionals.find((r) => String(r.id) === String(row.regionalId))?.regionalName === tab.value).length
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
                        <SectionalTableRow
                          key={row.id}
                          row={row}
                          selected={table.selected.includes(row.id)}
                          onSelectRow={() => table.onSelectRow(row.id)}
                          onDeleteRow={() => handleDeleteRow(row.id)}
                          editHref={paths.dashboard.level.sectional.edit(row.id)}
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
              <SectionalCardList sectionals={dataFiltered} />
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

const getRegionalNameBySectional = (sectional) => sectional?.regionalName || sectional?.regionName || sectional?.nombreRegion || '-';

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
      (sectional) =>
        getRegionalNameBySectional(sectional) === regionalName
    );
  }


  if (role.length) {
    inputData = inputData.filter((sectional) => role.includes(sectional.role));
  }

  return inputData;
}
