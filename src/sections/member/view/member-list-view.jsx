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

import { sortOwnFirst } from 'src/utils/sort-own-first';
import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { isDestacamentoAdminRole } from 'src/utils/admin-role-label';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';
import {
  isAdminGlobal,
  isFullOrgManager,
  ejerceCargoSobreDestacamento,
} from 'src/utils/org-level-access';
import {
  isMemberSessionUser,
  canMemberManageMembers,
  esFichaDelPropioMiembro,
  filterMembersByMemberScope,
  isCoordinadorDestacamentoRole,
} from 'src/utils/member-access';

import { MEMBER_DIVISION_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { getMemberDirectoryMetadata } from 'src/services/member-context-service';
import {
  getMembers,
  deleteMember,
  getCachedMembers,
  getLeadershipAssignments,
} from 'src/services/member-service';
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
import { PERMISOS, puedeModificar } from 'src/auth/permissions';

import { MemberTableRow } from '../member-table-row';
import { MemberCardList } from '../member-card-list';
import { MemberTableToolbar } from '../member-table-toolbar';
import { MemberTableFiltersResult } from '../member-table-filters-result';
// ----------------------------------------------------------------------

// Rango de cada cargo de destacamento segun el catalogo local. El `orden` que
// llega de Firestore puede venir en 0 —y entonces todos los cargos empatan—, asi
// que el catalogo hace de respaldo.
const ORDEN_CARGO_DEST = new Map(
  DIRECTIVA_POSITIONS.filter((position) => position.nivel === 'destacamento').flatMap((position) =>
    [position.idPosicionDirectiva, position.idCargo, position.idCargoApi]
      .filter(Boolean)
      .map((id) => [String(id), Number(position.orden) || Infinity])
  )
);

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
  nationalLeadershipPosition: member.nationalLeadershipPosition || '',
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

  // FIRESTORE ES LA UNICA FUENTE, igual que en la ficha del miembro. Antes esta
  // lista mezclaba `CargosMiembros` (API .NET) con las asignaciones, asi que una
  // fila huerfana alla pintaba en la columna "Posicion" un cargo que la Directiva
  // ya le habia dado a otro.
  const hydrateMemberPositions = useCallback(async (members) => {
    const [cargosDirectiva, asignacionesDirectiva] = await Promise.all([
      obtenerCargosDirectiva({ incluirNoAsignables: false }),
      obtenerAsignacionesDirectivaMiembros(),
    ]);

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
      const assignments = assignmentsByMember.get(memberId) || [];
      const memberDivisionKey = getDirectivaDivisionByMemberDivision(member.memberDivision);

      const mergedPositions = assignments
        .map((asignacion) =>
          cargosDirectiva.find((cargo) =>
            [cargo.idPosicionDirectiva, cargo.id, cargo.idCargo, cargo.idCargoApi].some(
              (value) =>
                String(value || '') === String(asignacion.idPosicionDirectiva || '') ||
                String(value || '') === String(asignacion.idCargo || '')
            )
          )
        )
        .filter(Boolean)
        .filter(
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
      // La posicion nacional se saca aparte de `directivaPosition`, que se queda con
      // la primera de cualquier nivel: sin esto, quien tuviera un cargo seccional Y
      // uno nacional exportaba el seccional en la columna de nacional.
      const nacionalPosition = mergedPositions.find((cargo) => cargo.nivel === 'nacional');

      return {
        ...member,
        memberPosition: mergedPositions.map((cargo) => getCargoOptionValue(cargo)).filter(Boolean),
        destLeadershipPosition: destPosition ? getCargoLabel(destPosition) : '',
        // Rango dentro del destacamento (Pastor, Coordinador, Asistente...). Se
        // guarda aqui, donde ya tenemos el cargo resuelto, para poder ordenar
        // la lista por jerarquia sin volver a buscarlo.
        destPositionOrden:
          ORDEN_CARGO_DEST.get(String(destPosition?.idPosicionDirectiva || '')) ??
          ORDEN_CARGO_DEST.get(String(destPosition?.idCargo || '')) ??
          (Number(destPosition?.orden) || Infinity),
        directivaLeadershipPosition: directivaPosition ? getCargoLabel(directivaPosition) : '',
        nationalLeadershipPosition: nacionalPosition ? getCargoLabel(nacionalPosition) : '',
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
    () => filterMembersByMemberScope(tableData, user, { dests, churches, sectionals }),
    [churches, dests, sectionals, tableData, user]
  );
  // Se lee UNA vez para toda la tabla y se pasa a cada fila. Antes cada fila
  // leia la coleccion completa en cada render (N copias por render).
  const leadershipAssignments = useMemo(() => getLeadershipAssignments(), []);
  // Los administradores de seccion y region pueden VER la lista completa de
  // miembros pero no editarlos (su rol no incluye permisos de edicion). Por eso
  // no basta con "es admin": exigimos permiso real de gestion de miembros.
  // Se usa puedeModificar (no `can`) para que un rol de SOLO LECTURA —p. ej. el
  // Pastor— nunca gestione miembros, aunque el token traiga permisos heredados.
  const adminCanManageMembers =
    isFullOrgManager(user) ||
    puedeModificar(user, PERMISOS.MIEMBROS_EDITAR) ||
    puedeModificar(user, PERMISOS.MIEMBROS_CREAR) ||
    puedeModificar(user, PERMISOS.MIEMBROS_ELIMINAR);
  const memberCanManage = isMemberSessionUser(user)
    ? canMemberManageMembers(user)
    : adminCanManageMembers;
  // Eliminar miembros: solo el Administrador Global.
  const memberCanDelete = isAdminGlobal(user);
  // Actualizacion rapida (lapiz): solo en la lista de miembros y solo para el
  // Coordinador de Destacamento (titular/asistente) o el Administrador Global.
  const memberAllowQuickEdit = isCoordinadorDestacamentoRole(user) || isAdminGlobal(user);
  const memberDestLabel = useMemo(() => {
    // Con un cargo de seccion, region o nacional la lista ya no es la de su
    // destacamento —trae la de su seccion o su region—, asi que el titulo se
    // queda en el general.
    if (!isMemberSessionUser(user) || ejerceCargoSobreDestacamento(user)) {
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

  const refreshMembersView = useCallback(async () => {
    setMembersLoading(true);

    try {
      const refreshedMembers = await getMembers();
      const mappedMembers = refreshedMembers.map(mapMemberToTableRow);
      const membersWithPositions = await hydrateMemberPositions(mappedMembers).catch(
        () => mappedMembers
      );
      const positionsById = new Map(
        membersWithPositions.map((member) => [
          String(member.id),
          {
            memberPosition: member.memberPosition,
            destLeadershipPosition: member.destLeadershipPosition,
            directivaLeadershipPosition: member.directivaLeadershipPosition,
            nationalLeadershipPosition: member.nationalLeadershipPosition,
            destPositionOrden: member.destPositionOrden,
          },
        ])
      );

      setTableData(
        mappedMembers.map((member) => {
          const positions = positionsById.get(String(member.id));
          return positions ? { ...member, ...positions } : member;
        })
      );
    } finally {
      setMembersLoading(false);
    }
  }, [hydrateMemberPositions]);

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
                  nationalLeadershipPosition: member.nationalLeadershipPosition,
                  destPositionOrden: member.destPositionOrden,
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
          .catch(() => { });

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
    // Con el numero: "Tribu de Judá" a secas no distingue un destacamento de otro
    // que se llame igual, que es justo lo que el numero resuelve.
    labelResolver: (id) => {
      const dest = dests.find((d) => String(d.id) === String(id));

      if (!dest) return id;

      const nombre = dest.name || dest.nombre || dest.destName || '';
      const numero = dest.destNumber || dest.numero || dest.number || '';

      return [nombre, numero].filter(Boolean).join(' ') || id;
    },
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
    // Etiqueta desde el CATALOGO real. Antes se buscaba en los roles de ejemplo,
    // que no contienen los ids del catalogo, asi que el filtro mostraba el valor
    // crudo ("seccional-coordinador-produccion") en vez del nombre del cargo.
    const roleInfo = DIRECTIVA_POSITIONS.find((p) => p.idCargo === role);

    return {
      value: role,
      label: roleInfo ? getCargoLabel(roleInfo) : role,
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

  // El Usuario Comun se encuentra a si mismo arriba del todo. Es solo el orden
  // INICIAL: en cuanto ordena por una columna manda su criterio, igual que en las
  // listas de niveles organizacionales.
  const dataFiltered = (() => {
    const filtrados = applyFilter({
      inputData: visibleMembers,
      comparator: getComparator(table.order, table.orderBy),
      filters: currentFilters,
    });

    if (table.hasUserSorted) {
      return filtrados;
    }

    // Al mirar UN destacamento lo natural es verlo por rango —Pastor, Coordinador
    // de Destacamento, Coordinador Asistente...— y no en orden alfabetico, que no
    // dice nada de quien responde ante quien.
    const porJerarquia = currentFilters.destName.length
      ? [...filtrados].sort(
        (a, b) => (a.destPositionOrden ?? Infinity) - (b.destPositionOrden ?? Infinity)
      )
      : filtrados;

    return sortOwnFirst(porJerarquia, (row) => esFichaDelPropioMiembro(user, row));
  })();

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
            memberDestLabel ? `Lista de miembros de ${memberDestLabel}` : 'Lista de miembros'
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
            onMembersUploaded={refreshMembersView}
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
              {memberCanDelete && (
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
                        canDelete={memberCanDelete}
                        allowQuickEdit={memberAllowQuickEdit}
                        leadershipAssignments={leadershipAssignments}
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
