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
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';
import {
  isMemberSessionUser,
  canMemberManageMembers,
  filterMembersByMemberScope,
} from 'src/utils/member-access';

import { MEMBER_DIVISION_OPTIONS } from 'src/_mock';
import { getDestsApi } from 'src/services/dest-service';
import { DashboardContent } from 'src/layouts/dashboard';
import { getChurches } from 'src/services/church-service';
import { _allLeadershipRoles } from 'src/_mock/_leadership';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { getMembers, deleteMember } from 'src/services/member-service';

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
  TableSkeleton,
  TableEmptyRows,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { MemberTableRow } from '../member-table-row';
import { MemberCardList } from '../member-card-list';
import { MemberTableToolbar } from '../member-table-toolbar';
import { MemberTableFiltersResult } from '../member-table-filters-result';
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Nombre' },
  { id: 'destName', label: 'Destacamento', width: 250 },
  { id: 'memberPosition', label: 'Posición', width: 180 },
  { id: 'sectionalName', label: 'Sección', width: 160 },
  { id: 'memberDivision', label: 'División', width: 90 },
  { id: '', width: 88 },
];

const getMemberAge = (birthdate) => {
  if (!birthdate) return null;

  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age--;
  }

  return age;
};

const resolveMemberDivision = (member) => {
  const currentDivision = String(
    member?.memberDivision ?? member?.division ?? member?.divisionName ?? ''
  ).trim();

  if (currentDivision) {
    const normalized = currentDivision.toLowerCase();
    if (normalized.includes('lider')) return 'Liderazgo';
    if (normalized.includes('explor')) return 'Exploradores';
    if (normalized.includes('segu')) return 'Seguidores';
    if (normalized.includes('pion')) return 'Pioneros';
    if (normalized.includes('naveg')) return 'Navegantes';
    return currentDivision;
  }

  const age = getMemberAge(
    member?.birthDate || member?.birth || member?.dateOfBirth || member?.fechaNacimiento
  );

  if (age === null) return '';
  if (age >= 18) return 'Liderazgo';
  if (age >= 14) return 'Exploradores';
  if (age >= 11) return 'Seguidores';
  if (age >= 8) return 'Pioneros';
  if (age >= 5) return 'Navegantes';

  return '';
};

// ----------------------------------------------------------------------

export function MemberListView() {
  const table = useTable();
  const { user, loading } = useAuthContext();
  const [dests, setDests] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getDestsApi();
        setDests(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading dests for member list:', error);
        setDests([]);
      }
    };

    load();
  }, []);

  const [displayMode, setDisplayMode] = useState('panel');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [churches, setChurches] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [sectionals, setSectionals] = useState([]);

  useEffect(() => {
    if (isMobile) {
      setDisplayMode('grid');
    }
  }, [isMobile]);

  useEffect(() => {
    const loadChurches = async () => {
      try {
        const data = await getChurches();
        setChurches(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading churches for member list:', error);
        setChurches([]);
      }
    };

    loadChurches();
  }, []);

  useEffect(() => {
    const loadRegionals = async () => {
      try {
        const data = await getRegionals();
        setRegionals(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading regionals for member list:', error);
        setRegionals([]);
      }
    };

    loadRegionals();
  }, []);

  useEffect(() => {
    const loadSectionals = async () => {
      try {
        const data = await getSectionals();
        setSectionals(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading sectionals for member list:', error);
        setSectionals([]);
      }
    };

    loadSectionals();
  }, []);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const confirmDialog = useBoolean();

  const [tableData, setTableData] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const visibleMembers = useMemo(
    () => filterMembersByMemberScope(tableData, user),
    [tableData, user]
  );
  const memberCanManage = isMemberSessionUser(user) ? canMemberManageMembers(user) : true;
  const memberDestLabel = useMemo(() => {
    if (!isMemberSessionUser(user)) {
      return '';
    }

    const allowedDest = user?.alcance?.destacamentos?.[0];

    if (!allowedDest) {
      return '';
    }

    const foundDest = dests.find((dest) => String(dest.id) === String(allowedDest));
    const destName = foundDest?.name || foundDest?.nombre || foundDest?.destName || '';
    const destNumber = foundDest?.destNumber || foundDest?.numero || foundDest?.number || '';

    return [destName, destNumber].filter(Boolean).join(' ') || `destacamento ${allowedDest}`;
  }, [dests, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // ðŸš¨ NO correr hasta que haya data
      if (!dests.length || !churches.length || !sectionals.length) return;

      setMembersLoading(true);

      try {
        const members = await getMembers();
        if (cancelled) return;

        const destById = new Map(dests.map((dest) => [String(dest.id), dest]));
        const churchById = new Map();
        const sectionalById = new Map();

        churches.forEach((church) => {
          [church?.id, church?.idIglesia].forEach((id) => {
            if (id !== null && id !== undefined && id !== '') {
              churchById.set(String(id), church);
            }
          });
        });

        sectionals.forEach((sectional) => {
          [sectional?.id, sectional?.idSeccion].forEach((id) => {
            if (id !== null && id !== undefined && id !== '') {
              sectionalById.set(String(id), sectional);
            }
          });
        });

        const mapped = members.map((member) => {
          const dest = destById.get(String(member.idDestacamento)) || destById.get(String(member.destId));
          const church = churchById.get(String(dest?.churchId));
          const sectional = sectionalById.get(String(church?.idSeccion));

          return {
            ...member,
            id: member.id,
            idMiembros: member.id,
            memberId: member.id,
            avatarUrl: member.avatarUrl || null,
            name: getMemberFullName(member),
            memberDivision: resolveMemberDivision(member),
            churchId: church?.id || church?.idIglesia || dest?.churchId || null,
            churchName: church?.name || church?.churchName || dest?.churchName || 'Iglesia desconocida',
            sectionalId: sectional?.id,
            sectionalName: sectional?.sectionalName || sectional?.nombre || 'Sección desconocida',
            regionalId: sectional?.regionalId || '',
            regionalName: '',
            memberPosition: [],
          };
        });

        setTableData(mapped);
        setMembersLoading(false);

        obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' })
          .then((memberPhotos) => {
            if (cancelled) return;

            setTableData((currentMembers) =>
              currentMembers.map((member) => {
                const memberPhoto = memberPhotos[String(member.id)];

                return memberPhoto?.urlFoto
                  ? { ...member, avatarUrl: memberPhoto.urlFoto }
                  : member;
              })
            );
          })
          .catch((error) => {
            console.error('Error loading member photos:', error);
          });
      } catch (error) {
        if (cancelled) return;

        console.error('Error loading member table data:', error);
        setTableData([]);
        setMembersLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [dests, churches, sectionals]);

  useEffect(() => {
    const regionalById = new Map(regionals.map((regional) => [String(regional.id), regional]));

    setTableData((currentMembers) => {
      if (!currentMembers.length || !regionalById.size) return currentMembers;

      let changed = false;
      const nextMembers = currentMembers.map((member) => {
        const regional = regionalById.get(String(member.regionalId));
        const regionalName = regional?.regionalName || regional?.name || '';

        if (member.regionalName === regionalName) return member;

        changed = true;
        return { ...member, regionalName };
      });

      return changed ? nextMembers : currentMembers;
    });
  }, [regionals, tableData.length]);

  const filters = useSetState({
    name: '',
    memberPosition: [],
    memberDivision: [],
    sectionalId: [],
    destName: [],
  });
  const { state: currentFilters, setState: updateFilters } = filters;

  const distinctdestName = getAvailableOptionsFromData({
    inputData: visibleMembers,
    property: 'destId',
    labelResolver: (id) => dests.find((d) => d.id === id)?.name || id,
  });

  const distinctPositions = [...new Set(visibleMembers.flatMap((m) => m.memberPosition || []))].map(
    (role) => {
      const roleInfo = _allLeadershipRoles.find((r) => r.value === role);

      return {
        value: role,
        label: roleInfo?.label || role,
      };
    }
  );
  const distinctSectionals = getAvailableOptionsFromData({
    inputData: visibleMembers,
    property: 'sectionalId',
    labelResolver: (id) => {
      const found = sectionals.find((s) => String(s.id) === String(id));
      return found?.sectionalName || found?.nombre || id;
    },
  });
  const distinctRegionals = getAvailableOptionsFromData({
    inputData: visibleMembers,
    property: 'regionalId',
    labelResolver: (id) => {
      const found = regionals.find((r) => String(r.id) === String(id));
      return found?.regionalName || found?.name || id;
    },
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
    ? visibleMembers.find((m) => m.id === memberIdFromUrl || m.memberId === memberIdFromUrl)
    : null;

  const dataFiltered = applyFilter({
    inputData: visibleMembers,
    comparator: getComparator(table.order, table.orderBy),
    filters: currentFilters,
  });

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);

  const canReset =
    !!currentFilters.name ||
    currentFilters.destName.length > 0 ||
    currentFilters.memberPosition.length > 0 ||
    currentFilters.memberDivision.length > 0 ||
    currentFilters.sectionalId.length > 0;

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        await deleteMember(id);

      const deleteRow = tableData.filter((row) => row.id !== id);

        toast.success('Miembro eliminado correctamente.');

      setTableData(deleteRow);

      table.onUpdatePageDeleteRow(dataInPage.length);
      } catch (error) {
        console.error('Error eliminando miembro:', error);
        toast.error(error?.message || 'No se pudo eliminar el miembro.');
      }
    },
    [dataInPage.length, table, tableData]
  );

  const handleDeleteRows = useCallback(async () => {
    try {
      await Promise.all(table.selected.map((id) => deleteMember(id)));

    const deleteRows = tableData.filter((row) => !table.selected.includes(row.id));

      toast.success('Miembros eliminados correctamente.');

    setTableData(deleteRows);

    table.onUpdatePageDeleteRows(dataInPage.length, dataFiltered.length);
    } catch (error) {
      console.error('Error eliminando miembros:', error);
      toast.error(error?.message || 'No se pudieron eliminar los miembros.');
    }
  }, [dataFiltered.length, dataInPage.length, table, tableData]);

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
          ¿Seguro que deseas eliminar <strong> {table.selected.length} </strong> miembros?
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

  if (loading || !hydrated) return null;

  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading={
            memberDestLabel ? `Lista de miembros del ${memberDestLabel}` : 'Lista de miembros'
          }
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Miembros', href: paths.dashboard.level.member.root },

            ...(memberFromUrl
              ? [{ name: `${memberFromUrl.firstName} ${memberFromUrl.lastName}` }]
              : [{ name: 'Lista' }]),
          ]}
          action={
            memberCanManage ? (
              <Button
                component={RouterLink}
                href={paths.dashboard.level.member.new}
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
            value={currentFilters.memberDivision[0] || 'all'}
            onChange={handleFilterMemberDivisionTab}
            sx={[
              (tabsTheme) => ({
                px: { md: 2.5 },
                boxShadow: `inset 0 -2px 0 0 ${varAlpha(tabsTheme.vars.palette.grey['500Channel'], 0.08)}`,
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
                      ((tab.value === 'all' || tab.value === currentFilters.memberDivision) &&
                        'filled') ||
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
                    {['Liderazgo', 'Exploradores', 'Seguidores', 'Pioneros', 'Navegantes'].includes(
                      tab.value
                    )
                      ? visibleMembers.filter((sectional) => sectional.memberDivision === tab.value)
                        .length
                      : visibleMembers.length}
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
            sectionals={sectionals}
            members={visibleMembers}
            canManageMembers={memberCanManage}
            options={{
              destName: distinctdestName,
              memberPosition: distinctPositions,
              memberDivision: MEMBER_DIVISION_OPTIONS,
              sectionalId: distinctSectionals,
              regionalId: distinctRegionals,
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

          {displayMode === 'panel' && (
            <Box sx={{ position: 'relative' }}>
              {memberCanManage && (
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

                  <TableBody>
                    {membersLoading ? (
                      <TableSkeleton rowCount={table.rowsPerPage} cellCount={TABLE_HEAD.length + 1} />
                    ) : (
                      <>
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
                              canManage={memberCanManage}
                              onSelectRow={() => memberCanManage && table.onSelectRow(row.id)}
                              onDeleteRow={() => handleDeleteRow(row.id)}
                              editHref={paths.dashboard.level.member.edit(row.id)}
                            />
                          ))}

                        <TableEmptyRows
                          height={table.dense ? 56 : 76}
                          emptyRows={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)}
                        />

                        <TableNoData notFound={notFound} />
                      </>
                    )}
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

        {displayMode !== 'panel' && (
          <MemberCardList
            members={dataFiltered}
            canManage={memberCanManage}
            dests={dests}
            loading={membersLoading}
          />
        )}
      </DashboardContent>

      {renderConfirmDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters }) {
  const { name, memberDivision, memberPosition, sectionalId, destName } = filters;

  if (destName.length) {
    inputData = inputData.filter((member) => destName.includes(member.destId?.toString()));
  }

  if (memberDivision.length) {
    inputData = inputData.filter((member) => memberDivision.includes(member.memberDivision));
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
      normalizeText(`${member.firstName || ''} ${member.lastName || ''}`).includes(
        normalizeText(name)
      )
    );
  }

  if (sectionalId.length) {
    inputData = inputData.filter((member) => sectionalId.includes(member.sectionalId?.toString()));
  }

  if (memberPosition?.length) {
    inputData = inputData.filter((member) =>
      member.memberPosition?.some((role) => memberPosition.includes(role))
    );
  }

  return inputData;
}

