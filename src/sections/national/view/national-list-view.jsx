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
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { normalizeText } from 'src/utils/normalize-text';
import { claveNodo } from 'src/utils/leadership-assignments';
import { canDeleteOrgLevel } from 'src/utils/org-level-access';
import { canManageOrgLevels } from 'src/utils/admin-role-label';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';

import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import {
  NATIONAL_LEADERSHIP_DATA,
  REGIONAL_LEADERSHIP_DATA,
  SECTIONAL_LEADERSHIP_DATA,
} from 'src/catalogs/directiva-diagrams';
import {
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectivaMiembros,
} from 'src/services/directivas-organizacionales-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  getComparator,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { CompactEntityListView } from 'src/sections/common/compact-entity-list-view';
import { CompactEntityDeleteDialog } from 'src/sections/common/compact-entity-delete-dialog';

import { useAuthContext } from 'src/auth/hooks';

import { NationalTableRow } from '../national-table-row';
import { NationalCardList } from '../national-card-list';
import { NationalTableToolbar } from '../national-table-toolbar';
import { NationalTableFiltersResult } from '../national-table-filters-result';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'nationalXname', label: 'Nombre' },
  { id: 'nationalXMemberPosition', label: 'Posición', width: 200 },
  { id: 'nationalOrganizationalLevel', label: 'Nivel organizacional', width: 200 },
  { id: 'nationalEstructure', label: 'Estructura', width: 200 },
  // { id: 'nationalXAssignedRegional', label: 'Región asignada', width: 160 },
  // { id: 'status', label: 'Estado', width: 100 },
  { id: '', width: 88 },
];

// Niveles que componen esta lista. El destacamento queda fuera: tiene su propia
// pantalla y no forma parte de las directivas de supervision.
const NIVELES_DE_LA_LISTA = ['nacional', 'regional', 'seccional'];

// Estructura a la que pertenece cada nivel, para la columna del mismo nombre.
const ESTRUCTURA_POR_NIVEL = {
  nacional: 'consejo_ejecutivo',
  regional: 'directivas_regionales',
  seccional: 'directivas_seccionales',
};

const ORDEN_ESTRUCTURA = {
  consejo_ejecutivo: 0,
  directivas_regionales: 1,
  directivas_seccionales: 2,
};

const DIAGRAMA_POR_NIVEL = {
  nacional: NATIONAL_LEADERSHIP_DATA,
  regional: REGIONAL_LEADERSHIP_DATA,
  seccional: SECTIONAL_LEADERSHIP_DATA,
};

// Algunos cargos historicos nombran al ocupante de una caja raiz con un id
// distinto al de esa caja. Para ordenarlos se usa el nodo visual equivalente.
const NODO_VISUAL_EQUIVALENTE = {
  nacional: {
    [claveNodo('director-ministerios-infantiles')]: 'ministerios-infantiles',
  },
  regional: {
    [claveNodo('director-regional')]: 'directiva-regional',
  },
  seccional: {
    [claveNodo('director-seccional')]: 'directiva-regional',
  },
};

// Recorrido por niveles: primero de arriba hacia abajo y, entre hermanos que
// comparten una fila, de izquierda a derecha, tal como se ven en el organigrama.
const construirOrdenVisual = (raiz) => {
  const orden = new Map();
  const pendientes = raiz ? [raiz] : [];
  let indice = 0;

  while (indice < pendientes.length) {
    const nodo = pendientes[indice];
    orden.set(claveNodo(nodo.id), indice);
    pendientes.push(...(nodo.children || []));
    indice += 1;
  }

  return orden;
};

const ORDEN_VISUAL_POR_NIVEL = Object.fromEntries(
  Object.entries(DIAGRAMA_POR_NIVEL).map(([nivel, diagrama]) => [nivel, construirOrdenVisual(diagrama)])
);

const obtenerOrdenVisualCargo = (position, nivel) => {
  const claveOriginal = claveNodo(position?.idNodoDiagrama || position?.idCargo);
  const nodoEquivalente = NODO_VISUAL_EQUIVALENTE[nivel]?.[claveOriginal] || claveOriginal;
  const ordenVisual = ORDEN_VISUAL_POR_NIVEL[nivel]?.get(claveNodo(nodoEquivalente));

  return ordenVisual ?? 1000 + (Number(position?.orden) || 999);
};

const compararJerarquia = (a, b) =>
  a.hierarchyStructureOrder - b.hierarchyStructureOrder ||
  a.hierarchyRoleOrder - b.hierarchyRoleOrder ||
  String(a.nationalOrganizationalLevel || '').localeCompare(
    String(b.nationalOrganizationalLevel || ''),
    'es'
  ) ||
  String(a.nationalXname || '').localeCompare(String(b.nationalXname || ''), 'es');

const ordenNivelOrganizacional = (value) => {
  const normalizado = normalizeText(value);

  if (normalizado === normalizeText('Consejo Ejecutivo')) return 0;
  if (normalizado.startsWith(normalizeText('Región'))) return 1;
  if (normalizado.startsWith(normalizeText('Sección'))) return 2;

  return 3;
};

// Ambito que se muestra BAJO la posicion: la seccion o la region a la que
// pertenece el cargo. Los nombres de region ya suelen venir con la palabra
// "Región" incluida ("Región Este"), asi que anteponerla otra vez daria "Región
// Región Este"; se comprueba antes de componerla.
const conPrefijo = (prefijo, nombre) => {
  const limpio = String(nombre || '').trim();

  if (!limpio) return '';

  return normalizeText(limpio).startsWith(normalizeText(prefijo))
    ? limpio
    : `${prefijo} ${limpio}`;
};

// Organigrama al que lleva el cargo: el de SU entidad, no el del nivel en
// abstracto. Un Coordinador de Producción de La Romana abre la Directiva de La
// Romana, no un listado de secciones.
const RUTA_DIRECTIVA_POR_NIVEL = {
  nacional: (id) => `/dashboard/level/national/${id || 'nacional'}/edit/leadership`,
  regional: (id) => `/dashboard/level/regional/${id}/edit/leadership`,
  seccional: (id) => `/dashboard/level/sectional/${id}/edit/leadership`,
};

const construirHrefDirectiva = ({ nivel, idEntidad }) => {
  const construirRuta = RUTA_DIRECTIVA_POR_NIVEL[nivel];

  if (!construirRuta) return '';

  const id = String(idEntidad || '').trim();

  // Sin entidad concreta no hay organigrama al que ir: se deja sin enlace en vez
  // de mandar a una pagina que no existe. Pasa con las asignaciones que quedaron
  // con la entidad en "general".
  if (nivel !== 'nacional' && (!id || id === 'general')) return '';

  return construirRuta(id);
};

const construirAmbito = ({ nivel, idEntidad, seccionesPorId, regionesPorId }) => {
  if (nivel === 'nacional') return 'Consejo Ejecutivo';

  const id = String(idEntidad || '');

  if (nivel === 'seccional') {
    return conPrefijo('Sección', seccionesPorId.get(id)) || 'Sección sin asignar';
  }

  if (nivel === 'regional') {
    return conPrefijo('Región', regionesPorId.get(id)) || 'Región sin asignar';
  }

  return '';
};

// ----------------------------------------------------------------------

export function NationalListView() {
  const [hydrated, setHydrated] = useState(false);

  const { user } = useAuthContext();
  const canManage = canManageOrgLevels(user);
  // Eliminar registros del consejo nacional: solo el Administrador Global.
  const canDelete = canDeleteOrgLevel(user);

  const table = useTable();

  const confirmDialog = useBoolean();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // FIRESTORE ES LA FUENTE. Antes esta lista se armaba con `_mock/_leadership` y
  // un usuario de prueba escrito en el codigo, asi que no reflejaba a nadie real.
  // Ahora sale de `asignacionesDirectiva`, la misma coleccion que alimenta los
  // organigramas y la ficha del miembro: asignar un cargo en cualquiera de esas
  // pantallas aparece aqui solo.
  const [allMembers, setAllMembers] = useState([]);
  const [nationalAssignments, setNationalAssignments] = useState([]);
  const [seccionesPorId, setSeccionesPorId] = useState(() => new Map());
  const [regionesPorId, setRegionesPorId] = useState(() => new Map());
  // Las fotos viven en su propia coleccion, no en el miembro: sin esta carga la
  // lista pintaba siempre el avatar por defecto.
  const [fotosPorMiembro, setFotosPorMiembro] = useState(() => ({}));

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [miembros, asignaciones, secciones, regiones] = await Promise.all([
        getMembers().catch(() => []),
        obtenerAsignacionesDirectivaMiembros().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
        getRegionals().catch(() => []),
      ]);

      if (cancelado) return;

      setAllMembers(Array.isArray(miembros) ? miembros : []);
      setNationalAssignments(
        (Array.isArray(asignaciones) ? asignaciones : []).filter((asignacion) =>
          NIVELES_DE_LA_LISTA.includes(asignacion?.nivel)
        )
      );
      setSeccionesPorId(
        new Map(
          (Array.isArray(secciones) ? secciones : []).map((seccion) => [
            String(seccion.id ?? seccion.idSeccion),
            seccion.sectionalName ?? seccion.nombre ?? seccion.name ?? '',
          ])
        )
      );
      setRegionesPorId(
        new Map(
          (Array.isArray(regiones) ? regiones : []).map((region) => [
            String(region.regionId ?? region.id ?? region.idRegion),
            region.name ?? region.nombre ?? '',
          ])
        )
      );

      obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' })
        .then((fotos) => {
          if (cancelado) return;

          setFotosPorMiembro(
            Object.fromEntries(
              Object.entries(fotos)
                .filter(([, foto]) => foto?.urlFoto)
                .map(([idMiembro, foto]) => [String(idMiembro), foto.urlFoto])
            )
          );
        })
        .catch(() => {});
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, []);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const [selectedDisplayMode, setSelectedDisplayMode] = useState(null);
  const displayMode = selectedDisplayMode || (isMobile ? 'grid' : 'panel');
  const setDisplayMode = useCallback((nextMode) => {
    setSelectedDisplayMode(nextMode);
  }, []);

  const filters = useSetState({
    name: '',
    nationalXMemberPosition: [],
    status: 'all',
    nationalOrganizationalLevel: [],
    nationalEstructure: [],
  });

  const NATIONAL_STRUCTURES = {
    ministerios_infantiles: 'Ministerios Infantiles',
    consejo_ejecutivo: 'Consejo Ejecutivo',
    oficiales_especiales_nacionales: 'Oficiales Especiales Nacionales',
    directivas_regionales: 'Directivas Regionales',
    directivas_seccionales: 'Directivas Seccionales',
    directivas_zonales: 'Directivas Zonales',
    // directiva_local: 'Directiva Local',
  };

  const tableData = nationalAssignments.map((assignment) => {
    const member = allMembers.find(
      (m) => String(m.id ?? m.idMiembros) === String(assignment.idMiembro)
    );
    const position = DIRECTIVA_POSITIONS.find(
      (item) => item.idCargo === assignment.idPosicionDirectiva
    );
    // El catalogo del cargo manda sobre metadata antigua de la asignacion. Asi,
    // todo cargo que vive en la Directiva Nacional se clasifica siempre dentro
    // del Consejo Ejecutivo, aunque el miembro tambien pertenezca a una seccion
    // o region por su procedencia.
    const perteneceAlConsejoEjecutivo =
      position?.nivel === 'nacional' ||
      String(assignment.idEntidad || '').trim().toLowerCase() === 'nacional';
    const nivel = perteneceAlConsejoEjecutivo
      ? 'nacional'
      : position?.nivel || assignment.nivel;
    const idEntidad = nivel === 'nacional' ? 'nacional' : assignment.idEntidad;
    const estructura = ESTRUCTURA_POR_NIVEL[nivel] || '-';
    const ambito = construirAmbito({
      nivel,
      idEntidad,
      seccionesPorId,
      regionesPorId,
    });
    const estructuraLabel = NATIONAL_STRUCTURES[estructura] || '-';

    return {
      id: assignment.idAsignacion || assignment.id,
      entityId: idEntidad,
      memberId: member?.id ?? assignment.idMiembro,
      level: nivel,
      // El nombre del listado manda; si el miembro no viene (baja, filtro), se usa
      // la copia guardada dentro de la propia asignacion.
      nationalXname:
        `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() ||
        member?.fullName ||
        assignment.nombreMiembro ||
        'Desconocido',
      email: member?.email,
      phoneNumber: member?.phoneNumber,
      avatarUrl:
        fotosPorMiembro[String(member?.id ?? assignment.idMiembro)] || member?.avatarUrl || '',

      nationalXMemberPosition: assignment.idPosicionDirectiva,
      nationalXMemberPositionLabel: position?.nombreCargo || '-',
      // Se pinta BAJO la posicion: "Sección La Romana", "Región Este".
      nationalXMemberPositionScope: ambito,
      nationalXMemberPositionHref: construirHrefDirectiva({
        nivel,
        idEntidad,
      }),
      nationalEstructure: estructura,
      nationalEstructureLabel: estructuraLabel,
      nationalOrganizationalLevel: ambito,
      hierarchyStructureOrder: ORDEN_ESTRUCTURA[estructura] ?? 999,
      hierarchyRoleOrder: obtenerOrdenVisualCargo(position, nivel),

      nationalXAssignedRegional: ambito || '-',
    };
  });

  const { state: currentFilters } = filters;
  const distinctPositions = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'nationalXMemberPosition',
    labelResolver: (value) =>
      tableData.find((row) => row.nationalXMemberPosition === value)?.nationalXMemberPositionLabel,
  }).sort((a, b) => {
    const rowA = tableData.find((row) => row.nationalXMemberPosition === a.value);
    const rowB = tableData.find((row) => row.nationalXMemberPosition === b.value);

    return (
      (rowA?.hierarchyStructureOrder ?? 999) - (rowB?.hierarchyStructureOrder ?? 999) ||
      (rowA?.hierarchyRoleOrder ?? 9999) - (rowB?.hierarchyRoleOrder ?? 9999) ||
      a.label.localeCompare(b.label, 'es')
    );
  });

  const distinctOrganizationalLevels = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'nationalOrganizationalLevel',
  }).sort(
    (a, b) =>
      ordenNivelOrganizacional(a.value) - ordenNivelOrganizacional(b.value) ||
      a.label.localeCompare(b.label, 'es')
  );
  const distinctEstructures = getAvailableOptionsFromData({
    inputData: tableData,
    property: 'nationalEstructure',
    labelResolver: (value) =>
      tableData.find((row) => row.nationalEstructure === value)?.nationalEstructureLabel,
  }).sort((a, b) => (ORDEN_ESTRUCTURA[a.value] ?? 999) - (ORDEN_ESTRUCTURA[b.value] ?? 999));

  const dataFiltered = (() => {
    const filtered = applyFilter({
      inputData: tableData,
      comparator: getComparator(table.order, table.orderBy),
      filters: currentFilters,
    });

    return table.hasUserSorted ? filtered : [...filtered].sort(compararJerarquia);
  })();

  const canReset =
    !!currentFilters.name ||
    currentFilters.nationalXMemberPosition.length > 0 ||
    currentFilters.nationalOrganizationalLevel.length > 0 ||
    currentFilters.nationalEstructure.length > 0;

  const notFound = (!dataFiltered.length && canReset) || !dataFiltered.length;

  // Quitar a alguien de la lista es DAR DE BAJA su asignacion en Firestore, con
  // el mismo mecanismo que usan los organigramas (activo=false). Antes se
  // reescribia `localStorage` y se recargaba la pagina, asi que el cargo seguia
  // intacto en la base y volvia a aparecer.
  const darDeBajaAsignaciones = useCallback(
    async (ids) => {
      const objetivo = nationalAssignments.filter((asignacion) =>
        ids.includes(asignacion.idAsignacion || asignacion.id)
      );

      if (!objetivo.length) return;

      await Promise.all(
        objetivo.map((asignacion) =>
          guardarAsignacionDirectiva({
            nivel: asignacion.nivel,
            idEntidad: asignacion.idEntidad,
            idCargo: asignacion.idCargo,
            idMiembro: asignacion.idMiembro,
            idPosicionDirectiva: asignacion.idPosicionDirectiva,
            division: asignacion.division ?? null,
            orden: asignacion.orden || 1,
            origen: 'lista-nacional',
            activo: false,
            // SIN ESTO la puerta de cambios no sabe quien actua: daba la baja por
            // "Usuario sin identificar" y, al no reconocer al Administrador
            // Global, la dejaba esperando una aprobacion que el mismo tendria que
            // darse. El cargo seguia activo y la baja se quedaba en la bandeja.
            usuario: user,
          })
        )
      );

      setNationalAssignments((previas) =>
        previas.filter((asignacion) => !ids.includes(asignacion.idAsignacion || asignacion.id))
      );
    },
    [nationalAssignments, user]
  );

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        await darDeBajaAsignaciones([id]);
        toast.success('Eliminado correctamente');
      } catch (error) {
        console.error('[lista nacional] no se pudo dar de baja la asignación', error);
        toast.error(error?.message || 'No se pudo eliminar.');
      }
    },
    [darDeBajaAsignaciones]
  );

  const handleDeleteRows = useCallback(async () => {
    try {
      await darDeBajaAsignaciones(table.selected);
      table.onSelectAllRows(false, []);
      toast.success('Eliminados correctamente');
    } catch (error) {
      console.error('[lista nacional] no se pudieron dar de baja las asignaciones', error);
      toast.error(error?.message || 'No se pudieron eliminar.');
    }
  }, [darDeBajaAsignaciones, table]);

  if (!hydrated) {
    return null;
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

          <NationalTableToolbar
            filters={filters}
            onResetPage={table.onResetPage}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            options={{
              nationalXMemberPosition: distinctPositions,
              nationalOrganizationalLevel: distinctOrganizationalLevels,
              nationalEstructure: distinctEstructures,
            }}
          />

          {canReset && (
            <NationalTableFiltersResult
              filters={filters}
              options={{
                nationalOrganizationalLevel: distinctOrganizationalLevels,
                nationalEstructure: distinctEstructures,
                nationalXMemberPosition: distinctPositions,
              }}
              totalResults={dataFiltered.length}
              onResetPage={table.onResetPage}
              sx={{ p: 2.5, pt: 0 }}
            />
          )}

          {displayMode === 'panel' && (
            <Box sx={{ position: 'relative' }}>
              {canDelete && (
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
                    loading={false}
                    rows={dataFiltered.slice(
                      table.page * table.rowsPerPage,
                      table.page * table.rowsPerPage + table.rowsPerPage
                    )}
                    renderRow={(row) => (
                      <NationalTableRow
                        key={row.id}
                        row={row}
                        selected={table.selected.includes(row.id)}
                        onSelectRow={() => table.onSelectRow(row.id)}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        editHref={paths.dashboard.level.national.edit(row.id)}
                        canManage={canManage}
                        canDelete={canDelete}
                        allMembers={allMembers}
                      />
                    )}
                    notFound={notFound}
                    skeletonRows={table.rowsPerPage}
                    skeletonCellCount={TABLE_HEAD.length + 1}
                    emptyRowsHeight={table.dense ? 56 : 56 + 20}
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
          <NationalCardList nationals={dataFiltered} canManage={canManage} />
        )}
      </DashboardContent>

      <CompactEntityDeleteDialog
        open={confirmDialog.value}
        onClose={confirmDialog.onFalse}
        onConfirm={handleDeleteRows}
        selectedCount={table.selected.length}
        entityLabel="registros"
      />
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, comparator, filters }) {
  const { name, nationalXMemberPosition, nationalOrganizationalLevel, nationalEstructure } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter((national) =>
      normalizeText(national.nationalXname).includes(normalizeText(name))
    );
  }

  if (nationalOrganizationalLevel.length) {
    inputData = inputData.filter((national) =>
      nationalOrganizationalLevel.includes(national.nationalOrganizationalLevel)
    );
  }

  if (nationalEstructure.length) {
    inputData = inputData.filter((national) =>
      nationalEstructure.includes(national.nationalEstructure)
    );
  }

  if (nationalXMemberPosition.length) {
    inputData = inputData.filter((national) =>
      nationalXMemberPosition.includes(national.nationalXMemberPosition)
    );
  }

  return inputData;
}
