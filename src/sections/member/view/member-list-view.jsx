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
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { normalizeText } from 'src/utils/normalize-text';
import { isFullOrgManager } from 'src/utils/org-level-access';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { isDestacamentoAdminRole } from 'src/utils/admin-role-label';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';
import {
  isMinorMember,
  isMemberSessionUser,
  canMemberManageMembers,
  shouldDisableMinorMembers,
  filterMembersByMemberScope,
} from 'src/utils/member-access';

import { MEMBER_DIVISION_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { _allLeadershipRoles } from 'src/_mock/_leadership';
import { obtenerCargosMiembroApi } from 'src/services/cargos-api-service';
import { getMemberDirectoryMetadata } from 'src/services/member-context-service';
import { getMembers, deleteMember, getCachedMembers } from 'src/services/member-service';
import {
  obtenerCargosDirectiva,
  obtenerAsignacionesDirectivaMiembros,
} from 'src/services/directivas-organizacionales-service';

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
import { can, PERMISOS } from 'src/auth/permissions';

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

const getDirectivaDivisionByMemberDivision = (memberDivision = '') => {
  const normalized = String(memberDivision || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('naveg')) return 'navegantes';
  if (normalized.includes('pion')) return 'pioneros';
  if (normalized.includes('segu')) return 'seguidores';
  if (normalized.includes('explor')) return 'exploradores';

  return '';
};

const getCargoOptionValue = (cargo = {}) => cargo.idPosicionDirectiva || cargo.id || cargo.idCargo;

const getCargoLabel = (cargo = {}) => {
  const cargoName = cargo.nombreCargo || cargo.nombre || cargo.label || '';

  if (cargo.nivel === 'destacamento' && cargo.nombreDivision && !cargoName.includes('(')) {
    return `${cargoName} (${cargo.nombreDivision})`;
  }

  return cargoName;
};

const mapMemberToTableRow = (member) => ({
  ...member,
  id: member.id,
  idMiembros: member.id,
  memberId: member.memberId || member.codigoMiembro || member.id,
  destId: member.destId || member.idDestacamento || '',
  avatarUrl: member.avatarUrl || null,
  name: getMemberFullName(member),
  memberDivision: resolveMemberDivision(member),
  churchId: null,
  churchName: 'Iglesia desconocida',
  sectionalId: '',
  sectionalName: 'Sección desconocida',
  regionalId: '',
  regionalName: '',
  memberPosition: member.memberPosition || [],
  destLeadershipPosition: member.destLeadershipPosition || '',
  directivaLeadershipPosition: member.directivaLeadershipPosition || '',
});

// ----------------------------------------------------------------------

export function MemberListView() {
  const table = useTable();
  const { user, loading } = useAuthContext();
  const [dests, setDests] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const displayMode = selectedDisplayMode || (isMobile ? 'grid' : 'panel');
  const setDisplayMode = useCallback((nextMode) => {
    setSelectedDisplayMode(nextMode);
  }, []);
  const [churches, setChurches] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [sectionals, setSectionals] = useState([]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const confirmDialog = useBoolean();

  const [tableData, setTableData] = useState([]);
  const [memberPhotoUrls, setMemberPhotoUrls] = useState({});
  const [membersLoading, setMembersLoading] = useState(true);

  const hydrateMemberPositions = useCallback(async (members) => {
    const [cargosMiembros, cargosDirectiva, asignacionesDirectiva] = await Promise.all([
      obtenerCargosMiembroApi(),
      obtenerCargosDirectiva({ incluirNoAsignables: false }),
      obtenerAsignacionesDirectivaMiembros(),
    ]);

    const cargosByMember = new Map();
    cargosMiembros.forEach((cargoMiembro) => {
      const memberId = String(cargoMiembro.idMiembro || cargoMiembro.idMiembros || '');

      if (!memberId) return;

      const current = cargosByMember.get(memberId) || [];
      current.push(Number(cargoMiembro.idCargo));
      cargosByMember.set(memberId, current);
    });

    const assignmentsByMember = new Map();
    asignacionesDirectiva.forEach((asignacion) => {
      const memberId = String(asignacion.idMiembro || asignacion.idMiembros || '');

      if (!memberId) return;

      const current = assignmentsByMember.get(memberId) || [];
      current.push(asignacion);
      assignmentsByMember.set(memberId, current);
    });

    return members.map((member) => {
      const memberId = String(member.id || member.idMiembros || '');
      const cargoIds = cargosByMember.get(memberId) || [];
      const assignments = assignmentsByMember.get(memberId) || [];
      const memberDivisionKey = getDirectivaDivisionByMemberDivision(member.memberDivision);

      const positionsByAssignment = assignments
        .map((asignacion) =>
          cargosDirectiva.find((cargo) =>
            [cargo.idPosicionDirectiva, cargo.id, cargo.idCargo, cargo.idCargoApi].some(
              (value) =>
                String(value || '') === String(asignacion.idPosicionDirectiva || '') ||
                String(value || '') === String(asignacion.idCargo || '')
            )
          )
        )
        .filter(Boolean);
      const positionsByApi = cargosDirectiva.filter((cargo) =>
        cargoIds.includes(Number(cargo.idCargo || cargo.idCargoApi))
      );
      const mergedPositions = [...positionsByAssignment, ...positionsByApi].filter(
        (cargo, index, list) =>
          index ===
          list.findIndex(
            (item) =>
              String(getCargoOptionValue(item) || '') === String(getCargoOptionValue(cargo) || '')
          )
      );
      const destPosition =
        mergedPositions.find(
          (cargo) => cargo.nivel === 'destacamento' && cargo.division === memberDivisionKey
        ) || mergedPositions.find((cargo) => cargo.nivel === 'destacamento');
      const directivaPosition = mergedPositions.find((cargo) => cargo.nivel !== 'destacamento');

      return {
        ...member,
        memberPosition: mergedPositions.map((cargo) => getCargoOptionValue(cargo)).filter(Boolean),
        destLeadershipPosition: destPosition ? getCargoLabel(destPosition) : '',
        directivaLeadershipPosition: directivaPosition ? getCargoLabel(directivaPosition) : '',
      };
    });
  }, []);

  useEffect(() => {
    // Fase 1: la metadata se carga en paralelo con los miembros (antes esperaba
    // a que terminara la carga de miembros). No usamos un ref de "ya cargado":
    // con StrictMode el doble montaje cancelaba la primera carga y el ref
    // impedia la segunda, dejando la metadata vacia (destacamento/seccion
    // "desconocido"). getMemberDirectoryMetadata ya cachea la promesa, asi que
    // volver a llamarla es barato.
    let cancelled = false;

    const loadMetadata = async () => {
      const metadataResult = await Promise.allSettled([
        getMemberDirectoryMetadata({
          includeDestPhotos: false,
          includeRegionalPhotos: false,
          includeSectionalPhotos: false,
        }),
      ]);

      const metadata =
        metadataResult[0]?.status === 'fulfilled' && metadataResult[0].value
          ? metadataResult[0].value
          : null;

      if (cancelled) return;

      setDests(Array.isArray(metadata?.dests) ? metadata.dests : []);
      setChurches(Array.isArray(metadata?.churches) ? metadata.churches : []);
      setRegionals(Array.isArray(metadata?.regionals) ? metadata.regionals : []);
      setSectionals(Array.isArray(metadata?.sectionals) ? metadata.sectionals : []);
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleMembers = useMemo(
    () => filterMembersByMemberScope(tableData, user, { dests, churches }),
    [churches, dests, tableData, user]
  );
  // Los administradores de seccion y region pueden VER la lista completa de
  // miembros pero no editarlos (su rol no incluye permisos de edicion). Por eso
  // no basta con "es admin": exigimos permiso real de gestion de miembros.
  const adminCanManageMembers =
    isFullOrgManager(user) ||
    can(user, PERMISOS.MIEMBROS_EDITAR) ||
    can(user, PERMISOS.MIEMBROS_CREAR) ||
    can(user, PERMISOS.MIEMBROS_ELIMINAR);
  const memberCanManage = isMemberSessionUser(user)
    ? canMemberManageMembers(user)
    : adminCanManageMembers;
  // Posiciones de Sección sin acceso a menores: ven la fila/tarjeta del menor
  // pero deshabilitada (no pueden abrirla).
  const disableMinors = shouldDisableMinorMembers(user);
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

    async function loadMembers() {
      setMemberPhotoUrls({});

      const cachedMembers = getCachedMembers();

      if (cachedMembers.length) {
        setTableData(cachedMembers.map(mapMemberToTableRow));
        setMembersLoading(false);
      } else {
        setMembersLoading(true);
      }

      try {
        const members = await getMembers();
        if (cancelled) return;

        const mappedMembers = members.map(mapMemberToTableRow);
        setTableData(mappedMembers);
        setMembersLoading(false);

        hydrateMemberPositions(mappedMembers)
          .then((membersWithPositions) => {
            if (cancelled) return;

            // Mezclar solo los campos de posición sobre los miembros actuales, para no
            // pisar destacamento/iglesia/sección que resuelve el useEffect de metadata
            // (ambas resoluciones son asíncronas y compiten por setTableData).
            const positionsById = new Map(
              membersWithPositions.map((member) => [
                String(member.id),
                {
                  memberPosition: member.memberPosition,
                  destLeadershipPosition: member.destLeadershipPosition,
                  directivaLeadershipPosition: member.directivaLeadershipPosition,
                },
              ])
            );

            setTableData((currentMembers) =>
              currentMembers.map((member) => {
                const positions = positionsById.get(String(member.id));
                return positions ? { ...member, ...positions } : member;
              })
            );
          })
          .catch(() => {});

        obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' })
          .then((memberPhotos) => {
            if (cancelled) return;

            setMemberPhotoUrls(
              Object.fromEntries(
                Object.entries(memberPhotos)
                  .filter(([, photo]) => photo?.urlFoto)
                  .map(([memberId, photo]) => [String(memberId), photo.urlFoto])
              )
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

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [hydrateMemberPositions]);

  useEffect(() => {
    if (!tableData.length || !dests.length || !churches.length || !sectionals.length) return;

    const destById = new Map();
    dests.forEach((dest) => {
      [dest?.id, dest?.idDestacamento, dest?.destId].forEach((id) => {
        if (id !== null && id !== undefined && id !== '') {
          destById.set(String(id), dest);
        }
      });
    });

    const churchById = new Map();
    churches.forEach((church) => {
      [church?.id, church?.idIglesia].forEach((id) => {
        if (id !== null && id !== undefined && id !== '') {
          churchById.set(String(id), church);
        }
      });
    });

    const sectionalById = new Map();
    sectionals.forEach((sectional) => {
      [sectional?.id, sectional?.idSeccion].forEach((id) => {
        if (id !== null && id !== undefined && id !== '') {
          sectionalById.set(String(id), sectional);
        }
      });
    });

    setTableData((currentMembers) => {
      let changed = false;

      const nextMembers = currentMembers.map((member) => {
        const dest =
          destById.get(String(member.idDestacamento)) || destById.get(String(member.destId));
        const church = churchById.get(String(dest?.churchId || dest?.idIglesia));
        const sectional = sectionalById.get(String(church?.idSeccion || church?.sectionId));
        const nextMember = {
          ...member,
          churchId: church?.id || church?.idIglesia || dest?.churchId || null,
          churchName:
            church?.name || church?.churchName || dest?.churchName || 'Iglesia desconocida',
          sectionalId: sectional?.id || sectional?.idSeccion || '',
          sectionalName: sectional?.sectionalName || sectional?.nombre || 'Sección desconocida',
          regionalId: sectional?.regionalId || '',
          destName: dest?.name || dest?.nombre || dest?.destName || '',
          destNumber: dest?.destNumber || dest?.numero || dest?.number || '',
          destAvatarUrl: dest?.avatarUrl || '',
        };

        if (
          member.churchName === nextMember.churchName &&
          member.sectionalName === nextMember.sectionalName &&
          member.regionalId === nextMember.regionalId &&
          member.destName === nextMember.destName &&
          member.destAvatarUrl === nextMember.destAvatarUrl
        ) {
          return member;
        }

        changed = true;
        return nextMember;
      });

      return changed ? nextMembers : currentMembers;
    });
    // Depende de `tableData` (no de su largo) para resolver destacamento/seccion
    // sin importar el orden en que lleguen miembros y metadata. El guard
    // `changed` devuelve la misma referencia cuando no hay cambios, evitando
    // re-renders en bucle.
  }, [dests, churches, sectionals, tableData]);

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

  const distinctPositions = [
    ...new Set(
      visibleMembers.flatMap((member) =>
        [
          ...(member.memberPosition || []),
          member.destLeadershipPosition,
          member.directivaLeadershipPosition,
        ].filter(Boolean)
      )
    ),
  ].map((role) => {
    const roleInfo = _allLeadershipRoles.find((r) => r.value === role);

    return {
      value: role,
      label: roleInfo?.label || role,
    };
  });
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

  const { handleDeleteRow, handleDeleteRows } = useCompactEntityDelete({
    table,
    tableData,
    setTableData,
    dataInPageLength: dataInPage.length,
    dataFilteredLength: dataFiltered.length,
    deleteItem: (id) =>
      deleteMember(id, {
        usuario: user,
        antes: tableData.find((row) => String(row.id) === String(id)),
      }),
    singleSuccessMessage: 'Miembro eliminado correctamente.',
    singleErrorMessage: 'No se pudo eliminar el miembro.',
    multipleSuccessMessage: 'Miembros eliminados correctamente.',
    multipleErrorMessage: 'No se pudieron eliminar los miembros.',
  });

  const handleFilterMemberDivisionTab = useCallback(
    (event, newValue) => {
      table.onResetPage();
      updateFilters({
        memberDivision: newValue === 'all' ? [] : [newValue],
      });
    },
    [updateFilters, table]
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
            showScopeFilters={!isDestacamentoAdminRole(user)}
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

                  <CompactEntityListView
                    loading={membersLoading}
                    rows={dataFiltered.slice(
                      table.page * table.rowsPerPage,
                      table.page * table.rowsPerPage + table.rowsPerPage
                    )}
                    renderRow={(row) => (
                      <MemberTableRow
                        key={row.id}
                        row={{
                          ...row,
                          avatarUrl: memberPhotoUrls[String(row.id)] || row.avatarUrl,
                        }}
                        selected={table.selected.includes(row.id)}
                        canManage={memberCanManage}
                        restricted={disableMinors && isMinorMember(row)}
                        onSelectRow={() => memberCanManage && table.onSelectRow(row.id)}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        editHref={paths.dashboard.level.member.edit(
                          row.memberId || row.codigoMiembro || row.id
                        )}
                      />
                    )}
                    notFound={notFound}
                    skeletonRows={table.rowsPerPage}
                    skeletonCellCount={TABLE_HEAD.length + 1}
                    emptyRowsHeight={table.dense ? 56 : 76}
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
          <MemberCardList
            members={dataFiltered}
            canManage={memberCanManage}
            restrictMinors={disableMinors}
            dests={dests}
            loading={membersLoading}
            memberPhotoUrls={memberPhotoUrls}
          />
        )}
      </DashboardContent>

      <CompactEntityDeleteDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
        onConfirm={handleDeleteRows}
        selectedCount={table.selected.length}
        entityLabel="miembros"
      />
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
    inputData = inputData.filter((member) => {
      const positions = [
        ...(member.memberPosition || []),
        member.destLeadershipPosition,
        member.directivaLeadershipPosition,
      ].filter(Boolean);

      return positions.some((role) => memberPosition.includes(role));
    });
  }

  return inputData;
}
