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
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { normalizeText } from 'src/utils/normalize-text';
import { claveNodo } from 'src/utils/leadership-assignments';
import { canManageOrgLevels } from 'src/utils/admin-role-label';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getAvailableOptionsFromData } from 'src/utils/get-available-options-from-data';
import { canDeleteOrgLevel, puedeEditarDirectivaHistorica } from 'src/utils/org-level-access';
import {
  CUATRIENIOS,
  nombreCompleto,
  cuatrienioDeFecha,
  esCuatrienioCerrado,
} from 'src/utils/directiva-cuatrienios.mjs';

import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { ID_CUATRIENIO_LISTADO } from 'src/catalogs/directiva-2022-2026.mjs';
import { quitarIntegrante, obtenerPermanentes } from 'src/services/directiva-cuatrienios-service';
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
import { SelectorDeCuatrienio } from 'src/sections/national/cuatrienios/selector-de-cuatrienio';
import {
  useIntegrantesDelCuatrienio,
  useHerramientasDelCuatrienio,
} from 'src/sections/national/cuatrienios/herramientas-del-cuatrienio';

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

// El ex comandante nacional no ocupa ninguna casilla de hoy, pero sigue siendo
// del Consejo Ejecutivo para siempre ("Comandante Nacional" es el nombre antiguo
// de Director Nacional). Sale en esta lista y en su filtro de posicion aunque no
// tenga cargo, sin poder darse de baja desde aqui: es historia, no asignacion.
const POSICION_EX_COMANDANTE = 'ex-comandante-nacional';

// En la memoria de un cuatrienio, lo que no ocupa casilla del organigrama va
// detras de los cargos: los provisionales, los oficiales y los ex comandantes.
const ORDEN_SIN_CASILLA = { directiva: 1000, oficiales: 2000, ex_comandantes: 3000 };

const RUTA_LISTA = paths.dashboard.level.national.root;
const rutaDelCuatrienio = (id, vigente) =>
  id === vigente ? RUTA_LISTA : `${RUTA_LISTA}?cuatrienio=${id}`;

// ----------------------------------------------------------------------

export function NationalListView() {
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // EL CUATRIENIO SE ELIGE EN EL TITULO. El vigente son las casillas de hoy; uno
  // pasado es la memoria guardada, pintada en la misma tabla. `?vista=cuatrienios`
  // es el enlace de antes (avisos ya enviados): abre el ultimo cuatrienio cerrado.
  const vigente = cuatrienioDeFecha()?.id || CUATRIENIOS[CUATRIENIOS.length - 1].id;
  const ultimoCerrado =
    [...CUATRIENIOS].reverse().find((item) => esCuatrienioCerrado(item.id))?.id || vigente;
  const pedido = searchParams.get('cuatrienio');
  const cuatrienio = CUATRIENIOS.some((item) => item.id === pedido)
    ? pedido
    : searchParams.get('vista') === 'cuatrienios'
      ? ultimoCerrado
      : vigente;
  const esMemoria = cuatrienio !== vigente;

  const { user } = useAuthContext();
  // La memoria la editan el Administrador Global y la Oficina Nacional; las
  // casillas de hoy, quien siempre.
  const puedeEditarMemoria = puedeEditarDirectivaHistorica(user);
  const canManage = esMemoria ? puedeEditarMemoria : canManageOrgLevels(user);
  // Eliminar registros del consejo nacional: solo el Administrador Global.
  const canDelete = esMemoria ? puedeEditarMemoria : canDeleteOrgLevel(user);

  const memoria = useIntegrantesDelCuatrienio(esMemoria ? cuatrienio : '');
  const herramientas = useHerramientasDelCuatrienio({
    cuatrienio,
    integrantes: memoria.integrantes,
    usuario: user,
    alCambiar: memoria.recargar,
  });

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
  const [exComandantes, setExComandantes] = useState([]);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [miembros, asignaciones, secciones, regiones, permanentes] = await Promise.all([
        getMembers().catch(() => []),
        obtenerAsignacionesDirectivaMiembros().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
        getRegionals().catch(() => []),
        obtenerPermanentes().catch(() => []),
      ]);

      if (cancelado) return;

      setExComandantes(permanentes.filter((permanente) => permanente?.exComandante));

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
        .catch(() => { });
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

  const filasDeHoy = nationalAssignments.map((assignment) => {
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

  exComandantes.forEach((permanente) => {
    const member = allMembers.find((m) => String(m.id) === String(permanente.idMiembros));

    filasDeHoy.push({
      id: `${POSICION_EX_COMANDANTE}-${permanente.idMiembros}`,
      soloLectura: true,
      entityId: 'nacional',
      memberId: member?.id ?? permanente.idMiembros,
      level: 'nacional',
      nationalXname:
        `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() ||
        `${permanente.nombres ?? ''} ${permanente.apellidos ?? ''}`.trim() ||
        'Desconocido',
      email: member?.email,
      phoneNumber: member?.phoneNumber,
      // La foto de la historia antes que la de perfil: es la de cuando fue
      // comandante, y la de perfil puede no existir.
      avatarUrl:
        permanente.fotoUrl ||
        fotosPorMiembro[String(permanente.idMiembros)] ||
        member?.avatarUrl ||
        '',
      nationalXMemberPosition: POSICION_EX_COMANDANTE,
      nationalXMemberPositionLabel: 'Ex Comandante Nacional',
      nationalXMemberPositionScope: 'Consejo Ejecutivo',
      nationalXMemberPositionHref: rutaDelCuatrienio(ultimoCerrado, vigente),
      nationalEstructure: 'consejo_ejecutivo',
      nationalEstructureLabel: NATIONAL_STRUCTURES.consejo_ejecutivo,
      nationalOrganizationalLevel: 'Consejo Ejecutivo',
      hierarchyStructureOrder: ORDEN_ESTRUCTURA.consejo_ejecutivo,
      // Detras de los cargos de hoy del Consejo Ejecutivo.
      hierarchyRoleOrder: 900,
      nationalXAssignedRegional: 'Consejo Ejecutivo',
    });
  });

  // La memoria del cuatrienio, con la misma forma que las filas de hoy.
  const filasDelCuatrienio = memoria.integrantes.map((integrante) => {
    const { nivel } = integrante;
    const member = integrante.idMiembros
      ? allMembers.find((m) => String(m.id ?? m.idMiembros) === String(integrante.idMiembros))
      : null;
    const position = DIRECTIVA_POSITIONS.find(
      (item) => item.idCargo === integrante.idPosicionDirectiva
    );
    const estructura = ESTRUCTURA_POR_NIVEL[nivel] || '-';
    const entidad =
      nivel === 'regional'
        ? { id: integrante.regionId, nombre: integrante.regionNombre }
        : nivel === 'seccional'
          ? { id: integrante.seccionId, nombre: integrante.seccionNombre }
          : {};
    // Por NOMBRE y no por id: una seccion del listado puede no existir aun en el
    // padron, y aun asi tiene que salir con su nombre.
    const ambito =
      nivel === 'nacional'
        ? 'Consejo Ejecutivo'
        : nivel === 'regional'
          ? conPrefijo('Región', entidad.nombre) || 'Región sin asignar'
          : conPrefijo('Sección', entidad.nombre) || 'Sección sin asignar';

    return {
      id: integrante.id,
      integrante,
      soloLectura: !puedeEditarMemoria,
      entityId: entidad.id || nivel,
      memberId: integrante.idMiembros || '',
      level: nivel,
      nationalXname: nombreCompleto(integrante) || 'Sin nombre',
      email: member?.email,
      phoneNumber: member?.phoneNumber,
      // La foto CONGELADA de entonces, nunca la de perfil de hoy.
      avatarUrl: integrante.fotoUrl || '',
      nationalXMemberPosition:
        integrante.idPosicionDirectiva || `${nivel}:${integrante.grupo}:${integrante.cargo}`,
      nationalXMemberPositionLabel: integrante.cargoNombre || '-',
      nationalXMemberPositionScope: ambito,
      // El cargo abre el organigrama de su entidad en ese cuatrienio.
      onAbrirPosicion: () => herramientas.abrirOrganigrama(nivel, entidad),
      nationalEstructure: estructura,
      nationalEstructureLabel: NATIONAL_STRUCTURES[estructura] || '-',
      nationalOrganizationalLevel: ambito,
      hierarchyStructureOrder: ORDEN_ESTRUCTURA[estructura] ?? 999,
      hierarchyRoleOrder: position
        ? obtenerOrdenVisualCargo(position, nivel)
        : (ORDEN_SIN_CASILLA[integrante.grupo] ?? 1000) + (Number(integrante.orden) || 99),
      nationalXAssignedRegional: ambito,
    };
  });

  const tableData = esMemoria ? filasDelCuatrienio : filasDeHoy;

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

  // Quitar de la memoria de un cuatrienio, de uno en uno: cada baja deja su
  // entrada en Historial y recalcula quien conserva permisos para siempre, y en
  // paralelo esos recalculos se pisaban.
  const quitarDeLaMemoria = useCallback(
    async (ids) => {
      const objetivo = memoria.integrantes.filter((integrante) => ids.includes(integrante.id));

      await objetivo.reduce(
        (anterior, integrante) =>
          anterior.then(() => quitarIntegrante({ integrante, usuario: user })),
        Promise.resolve()
      );

      memoria.recargar();
    },
    [memoria, user]
  );

  const darDeBaja = esMemoria ? quitarDeLaMemoria : darDeBajaAsignaciones;

  const cambiarCuatrienio = (id) => {
    filters.resetState();
    table.onResetPage();
    table.onSelectAllRows(false, []);
    router.replace(rutaDelCuatrienio(id, vigente));
  };

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        await darDeBaja([id]);
        toast.success('Eliminado correctamente');
      } catch (error) {
        console.error('[lista nacional] no se pudo dar de baja la asignación', error);
        toast.error(error?.message || 'No se pudo eliminar.');
      }
    },
    [darDeBaja]
  );

  const handleDeleteRows = useCallback(async () => {
    try {
      await darDeBaja(table.selected);
      table.onSelectAllRows(false, []);
      toast.success('Eliminados correctamente');
    } catch (error) {
      console.error('[lista nacional] no se pudieron dar de baja las asignaciones', error);
      toast.error(error?.message || 'No se pudieron eliminar.');
    }
  }, [darDeBaja, table]);

  if (!hydrated) {
    return null;
  }
  return (
    <>
      <DashboardContent>
        <CustomBreadcrumbs
          heading={
            <SelectorDeCuatrienio
              titulo="Directiva Nacional"
              cuatrienio={cuatrienio}
              onCambiar={cambiarCuatrienio}
            />
          }
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Nacional', href: paths.dashboard.level.national.root },
            { name: 'Lista' },
          ]}
          action={
            puedeEditarMemoria && (
              <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                {esMemoria && cuatrienio === ID_CUATRIENIO_LISTADO && (
                  <Button
                    variant="outlined"
                    startIcon={<Iconify icon="solar:import-bold" />}
                    onClick={herramientas.importar}
                  >
                    Cargar listado {ID_CUATRIENIO_LISTADO}
                  </Button>
                )}

                {esMemoria && (
                  <Button
                    variant="contained"
                    startIcon={<Iconify icon="mingcute:add-line" />}
                    onClick={() => herramientas.agregar()}
                  >
                    Agregar
                  </Button>
                )}

                {/* Al cerrar el cuatrienio, la directiva de hoy se guarda en su
                    memoria desde aqui. */}
                {!esMemoria && (
                  <Button
                    variant="outlined"
                    disabled={Boolean(herramientas.tomandoFoto)}
                    startIcon={
                      herramientas.tomandoFoto ? (
                        <CircularProgress size={16} />
                      ) : (
                        <Iconify icon="solar:camera-add-bold" />
                      )
                    }
                    onClick={herramientas.pedirFoto}
                  >
                    {herramientas.tomandoFoto || `Guardar en la memoria de ${cuatrienio}`}
                  </Button>
                )}
              </Box>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <>
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
                      loading={esMemoria && memoria.cargando}
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
                          onEditRow={
                            row.integrante ? () => herramientas.editar(row.integrante) : undefined
                          }
                          editHref={paths.dashboard.level.national.edit(row.id)}
                          canManage={canManage && !row.soloLectura}
                          canDelete={canDelete && !row.soloLectura}
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
        </>
      </DashboardContent>

      {herramientas.dialogos}

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
