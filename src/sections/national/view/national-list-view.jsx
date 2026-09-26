'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

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
import { tituloDe } from 'src/utils/titulos-oficiales-nacionales.mjs';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { combinarHistorialYVigentes } from 'src/utils/directiva-historial.mjs';
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
import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { useTitulosOficiales } from 'src/services/titulos-oficiales-service';
import { ID_CUATRIENIO_LISTADO } from 'src/catalogs/directiva-2022-2026.mjs';
import { quitarIntegrante, obtenerPermanentes } from 'src/services/directiva-cuatrienios-service';
import { obtenerTelefonosDirectivaActual } from 'src/services/national-directiva-contactos-service';
import {
  NATIONAL_LEADERSHIP_DATA,
  REGIONAL_LEADERSHIP_DATA,
  SECTIONAL_LEADERSHIP_DATA,
} from 'src/catalogs/directiva-diagrams';
import {
  guardarAsignacionDirectiva,
  obtenerHistorialDirectivaGlobal,
  obtenerAsignacionesDirectivaMiembros,
} from 'src/services/directivas-organizacionales-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import {
  useTable,
  emptyRows,
  getComparator,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { OrganigramaCargando } from 'src/sections/common/organigrama-cargando';
import { CompactEntityListView } from 'src/sections/common/compact-entity-list-view';
import { LeadershipHistoryTable } from 'src/sections/common/leadership-history-table';
import { CompactEntityDeleteDialog } from 'src/sections/common/compact-entity-delete-dialog';
import { SelectorDeCuatrienio } from 'src/sections/national/cuatrienios/selector-de-cuatrienio';
import { NationalLeadershipView } from 'src/sections/national/leadership/national-leadership-view';
import { RegionalLeadershipView } from 'src/sections/regional/leadership/regional-leadership-view';
import { OrganizationalListBreadcrumbs } from 'src/sections/common/organizational-list-breadcrumbs';
import { SectionalLeadershipView } from 'src/sections/sectional/leadership/sectional-leadership-view';
import {
  useIntegrantesDelCuatrienio,
  useHerramientasDelCuatrienio,
} from 'src/sections/national/cuatrienios/herramientas-del-cuatrienio';

import { useAuthContext } from 'src/auth/hooks';

import { NationalTableRow } from '../national-table-row';
import { NationalCardList } from '../national-card-list';
import { NationalTableToolbar } from '../national-table-toolbar';
import { NationalJerarquiaToolbar } from '../national-jerarquia-toolbar';
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

// Ámbito de la directiva nacional en la lista y en el filtro de la Jerarquía.
const NIVEL_CONSEJO_EJECUTIVO = 'Consejo Ejecutivo';

const construirAmbito = ({ nivel, idEntidad, seccionesPorId, regionesPorId }) => {
  if (nivel === 'nacional') return NIVEL_CONSEJO_EJECUTIVO;

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
// Las herramientas de la memoria (cargar listado, fotos, guardar) son acciones
// secundarias: en negrita pesaban tanto como el título de la directiva.
const SIN_NEGRITA = { fontWeight: 'fontWeightRegular' };

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
  const cuatrienioDeLaUrl = CUATRIENIOS.some((item) => item.id === pedido)
    ? pedido
    : searchParams.get('vista') === 'cuatrienios'
      ? ultimoCerrado
      : vigente;

  // EL CAMBIO SE VE AL PULSAR, NO AL LLEGAR LA URL. `router.replace` tarda en
  // devolver el `?cuatrienio=` nuevo y, mientras, la pantalla seguía con la
  // directiva anterior y el menú cerrado: parecía congelada. Lo elegido manda al
  // momento (título, tabla y árbol); la URL solo lo alcanza después. Un
  // cuatrienio ya leído sale al instante; uno nuevo, con su esqueleto.
  const [elegido, setElegido] = useState('');
  const cuatrienio = elegido || cuatrienioDeLaUrl;
  const esMemoria = cuatrienio !== vigente;

  useEffect(() => {
    // La URL ya llegó (o se volvió atrás con el navegador): manda ella.
    setElegido('');
  }, [cuatrienioDeLaUrl]);

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
  // Pestaña "Historia": quienes SALIERON de un cargo nacional, regional o
  // seccional (30+ días, ver `directiva-historial.mjs`). Los destacamentos no
  // entran aquí: su historial se ve solo en su propia pestaña.
  const [historialGlobal, setHistorialGlobal] = useState([]);
  const [seccionesPorId, setSeccionesPorId] = useState(() => new Map());
  const [regionesPorId, setRegionesPorId] = useState(() => new Map());
  // Las fotos viven en su propia coleccion, no en el miembro: sin esta carga la
  // lista pintaba siempre el avatar por defecto.
  const [fotosPorMiembro, setFotosPorMiembro] = useState(() => ({}));
  const [exComandantes, setExComandantes] = useState([]);
  const [telefonosDirectiva, setTelefonosDirectiva] = useState(() => ({}));
  // La directiva de hoy tampoco tenía esqueleto: hasta que llegaban las
  // lecturas la tabla decía "Sin datos" y luego se llenaba.
  const [cargandoHoy, setCargandoHoy] = useState(true);
  // Otra sesión asignó, quitó o cambió a alguien: la lista se relee sola.
  const cambiosDeHoy = useLecturasVivas(['directiva:', 'miembros:', 'cuatrienio:']);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [miembros, asignaciones, secciones, regiones, permanentes, telefonos, historial] =
        await Promise.all([
          getMembers().catch(() => []),
          obtenerAsignacionesDirectivaMiembros().catch(() => []),
          getSectionals({ includePhotos: false }).catch(() => []),
          getRegionals().catch(() => []),
          obtenerPermanentes().catch(() => []),
          obtenerTelefonosDirectivaActual().catch(() => []),
          obtenerHistorialDirectivaGlobal().catch(() => []),
        ]);

      if (cancelado) return;

      setHistorialGlobal(Array.isArray(historial) ? historial : []);

      const integrantesDeDirectivaNacional = new Set(
        asignaciones
          .filter((asignacion) => {
            const cargo = DIRECTIVA_POSITIONS.find(
              (item) => item.idCargo === asignacion.idPosicionDirectiva
            );

            return (
              cargo?.nivel === 'nacional' ||
              String(asignacion.idEntidad || '').trim().toLowerCase() === 'nacional'
            );
          })
          .map((asignacion) => String(asignacion.idMiembro))
      );

      // Un ex comandante que vuelve a ocupar una casilla nacional aparece como
      // integrante actual; no debe duplicarse al final como ex comandante.
      setExComandantes(
        permanentes.filter(
          (permanente) =>
            permanente?.exComandante &&
            !integrantesDeDirectivaNacional.has(String(permanente.idMiembros))
        )
      );
      setTelefonosDirectiva(
        Object.fromEntries(
          telefonos
            .filter((fila) => fila?.idMiembros && fila?.telefono)
            .map((fila) => [String(fila.idMiembros), fila.telefono])
        )
      );

      setAllMembers(Array.isArray(miembros) ? miembros : []);
      setCargandoHoy(false);
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
  }, [cambiosDeHoy]);

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
  // Que se pinta en la tarjeta: la lista de personas o el organigrama.
  const [vista, setVista] = useState('lista');

  const NATIONAL_STRUCTURES = {
    ministerios_infantiles: 'Ministerios Infantiles',
    consejo_ejecutivo: 'Consejo Ejecutivo',
    oficiales_especiales_nacionales: 'Oficiales Especiales Nacionales',
    directivas_regionales: 'Directivas Regionales',
    directivas_seccionales: 'Directivas Seccionales',
    directivas_zonales: 'Directivas Zonales',
    // directiva_local: 'Directiva Local',
  };

  // El título de un Oficial de la Nacional (Protocolo, Diseño y artes…) sale en
  // la columna Posición en lugar de "Oficial Especial", igual que en la Jerarquía
  // y en la ficha. Va aparte de la etiqueta del cargo: el filtro de Posición sigue
  // agrupando por cargo, no por título. Solo en la directiva de HOY: la memoria de
  // un cuatrienio pasado conserva su "Oficial de la Nacional" de entonces.
  const { asignaciones: titulosOficiales } = useTitulosOficiales();

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
      // Nombre CRUDO de la entidad (sin el prefijo "Región"/"Sección"): la pestaña
      // Jerarquía lo usa para casar la memoria de un cuatrienio cuando el id aún
      // no existe en el padrón. La nacional no tiene entidad.
      entityNombre:
        nivel === 'regional'
          ? regionesPorId.get(String(idEntidad)) || ''
          : nivel === 'seccional'
            ? seccionesPorId.get(String(idEntidad)) || ''
            : '',
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
      phoneNumber:
        member?.phoneNumber || telefonosDirectiva[String(member?.id ?? assignment.idMiembro)] || '',
      avatarUrl:
        fotosPorMiembro[String(member?.id ?? assignment.idMiembro)] || member?.avatarUrl || '',

      nationalXMemberPosition: assignment.idPosicionDirectiva,
      nationalXMemberPositionLabel: position?.nombreCargo || '-',
      nationalXMemberPositionTitulo: /^nacional-oficial-especial-\d+$/.test(
        String(assignment.idPosicionDirectiva || '')
      )
        ? tituloDe(titulosOficiales, member?.id ?? assignment.idMiembro)
        : '',
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
      phoneNumber:
        member?.phoneNumber || telefonosDirectiva[String(permanente.idMiembros)] || '',
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
      // Siempre al final de la lista de la directiva actual.
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
      // Nombre CRUDO de la entidad guardada: con él, la Jerarquía de la memoria
      // encuentra a una sección o región que aún no existe en el padrón por id.
      entityNombre: entidad.nombre || '',
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

  // Pestaña "Historia": siempre la de HOY (nacional + regiones + secciones),
  // sin importar que cuatrienio este elegido arriba en el titulo — esa
  // eleccion es solo para la pestaña "Todos".
  const resolverEntidadNombreHistoria = useCallback(
    (idEntidad, nivel) => {
      if (nivel === 'regional') return regionesPorId.get(String(idEntidad)) || '';
      if (nivel === 'seccional') return seccionesPorId.get(String(idEntidad)) || '';

      return 'Consejo Ejecutivo';
    },
    [regionesPorId, seccionesPorId]
  );

  const filasHistoria = useMemo(
    () =>
      combinarHistorialYVigentes({
        historial: historialGlobal,
        vigentes: nationalAssignments,
        resolverEntidadNombre: resolverEntidadNombreHistoria,
      }),
    [historialGlobal, nationalAssignments, resolverEntidadNombreHistoria]
  );

  const { state: currentFilters } = filters;

  // LA JERARQUIA, EN EL MISMO SITIO QUE LA LISTA.
  //
  // No es un organigrama nuevo: es el MISMO que ya se abre desde el cargo, solo
  // que pintado dentro de la tarjeta en vez de la tabla. El filtro de nivel
  // organizacional dice de que entidad; sin filtro, el del Consejo Nacional.
  //
  // La entidad sale de la propia fila —ya lleva su `level` y su `entityId`—, que
  // es lo que la lista uso para construir el enlace al organigrama: preguntarlo
  // aqui otra vez seria una segunda regla que se desincroniza de la primera.
  const nivelesElegidos = currentFilters.nationalOrganizationalLevel;

  // TODAS LAS REGIONES Y SECCIONES, AUNQUE SU DIRECTIVA ESTE VACIA.
  //
  // El desplegable salia solo de las filas de la lista, asi que una seccion o
  // region sin nadie asignado no se podia elegir y su organigrama —justo el que
  // hay que rellenar— no se veia nunca. Se completa con el catalogo, con el mismo
  // texto de ambito que llevan las filas (`construirAmbito`), para que el filtro y
  // la busqueda por nombre sigan hablando el mismo idioma. Solo en la directiva de
  // hoy: la de un cuatrienio guardado solo tiene las entidades que se guardaron.
  const entidadesDelCatalogo = useMemo(() => {
    if (esMemoria) return [];

    const deUnNivel = (nivel, porId) =>
      Array.from(porId.keys()).map((id) => ({
        nivel,
        id,
        nombre: porId.get(id) || '',
        ambito: construirAmbito({ nivel, idEntidad: id, seccionesPorId, regionesPorId }),
      }));

    return [
      ...deUnNivel('regional', regionesPorId),
      ...deUnNivel('seccional', seccionesPorId),
    ].filter((entidad) => entidad.nombre);
  }, [esMemoria, regionesPorId, seccionesPorId]);

  const entidadDeLaJerarquia =
    nivelesElegidos.length === 1
      ? (() => {
          const fila = tableData.find(
            (row) => row.nationalOrganizationalLevel === nivelesElegidos[0]
          );

          if (fila) {
            return { nivel: fila.level, id: fila.entityId, nombre: fila.entityNombre || '' };
          }

          // Sin nadie asignado no hay fila: la entidad sale del catalogo.
          const delCatalogo = entidadesDelCatalogo.find(
            (entidad) => entidad.ambito === nivelesElegidos[0]
          );

          return delCatalogo
            ? { nivel: delCatalogo.nivel, id: delCatalogo.id, nombre: delCatalogo.nombre }
            : null;
        })()
      : null;
  // Nivel del organigrama a pintar en la pestaña Jerarquía: la entidad elegida en
  // el filtro o, sin filtro, el Consejo Nacional.
  const nivelDeLaJerarquia = entidadDeLaJerarquia?.nivel || 'nacional';
  const idEntidadDeLaJerarquia = entidadDeLaJerarquia?.id || '';
  const nombreEntidadDeLaJerarquia = entidadDeLaJerarquia?.nombre || '';
  // La directiva ANTERIOR (un cuatrienio guardado) se pinta de solo lectura con
  // sus ocupantes de entonces; la de HOY, con sus permisos. El mismo `historico`
  // que ya usa el diálogo que abre un cargo.
  //
  // Memoizado por sus datos primitivos: si se rehiciera en cada render, su
  // `obtenerOcupante` cambiaría de identidad y el resaltado de una persona se
  // dispararía en bucle en vez de una vez.
  const historicoDeLaJerarquia = useMemo(
    () =>
      esMemoria
        ? herramientas.construirHistorico(
            nivelDeLaJerarquia,
            entidadDeLaJerarquia
              ? { id: idEntidadDeLaJerarquia, nombre: nombreEntidadDeLaJerarquia }
              : {}
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [esMemoria, herramientas.construirHistorico, nivelDeLaJerarquia, idEntidadDeLaJerarquia, nombreEntidadDeLaJerarquia]
  );

  // Persona a resaltar en el organigrama tras una búsqueda. El `token` cambia con
  // cada elección para que repetir el mismo nombre vuelva a hacerla brillar.
  const [resaltado, setResaltado] = useState(null);

  // Cada persona de la directiva, buscable por nombre, con la ubicación que la
  // lleva a su organigrama. Solo importa en la pestaña Jerarquía.
  const opcionesBusquedaJerarquia = tableData
    .filter((row) => row.memberId && row.nationalXname && row.nationalXname !== 'Desconocido')
    .map((row) => ({
      clave: row.id,
      memberId: String(row.memberId),
      label: row.nationalXname,
      ambito: row.nationalOrganizationalLevel,
      cargo: row.nationalXMemberPositionTitulo || row.nationalXMemberPositionLabel,
      avatarUrl: row.avatarUrl,
    }));

  // Al elegir a una persona: se lleva el filtro a su ámbito (para que salga SU
  // organigrama) y se marca para resaltarla.
  const seleccionarMiembroJerarquia = useCallback(
    (opcion) => {
      filters.setState({
        nationalOrganizationalLevel: opcion.ambito ? [opcion.ambito] : [],
      });
      setResaltado({ id: opcion.memberId, token: Date.now() });
    },
    [filters]
  );

  // El desplegable de una sola opción: guarda el array que el resto del código ya
  // usa, pero con 0 o 1 elemento. Cambiar de nivel a mano apaga el resaltado.
  const cambiarNivelJerarquia = useCallback(
    (value) => {
      filters.setState({ nationalOrganizationalLevel: value ? [value] : [] });
      setResaltado(null);
    },
    [filters]
  );
  // El desplegable de la Jerarquía es de una sola opción: el primer (y único)
  // nivel elegido, o vacío para el Consejo Nacional.
  const nivelValorJerarquia = nivelesElegidos[0] || NIVEL_CONSEJO_EJECUTIVO;
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
  // El desplegable de la Jerarquía: los niveles de la lista más las regiones y
  // secciones del catálogo que aún no tienen a nadie (ver `entidadesDelCatalogo`).
  // El de la lista no cambia: filtrar filas por una sección vacía no daría nada.
  const nivelesDeLaJerarquia = [
    // El Consejo Ejecutivo siempre, aunque la lista no traiga a nadie suyo: es la
    // opción que vuelve al organigrama de la nación.
    ...(distinctOrganizationalLevels.some((opcion) => opcion.value === NIVEL_CONSEJO_EJECUTIVO)
      ? []
      : [{ value: NIVEL_CONSEJO_EJECUTIVO, label: NIVEL_CONSEJO_EJECUTIVO }]),
    ...distinctOrganizationalLevels,
    ...entidadesDelCatalogo
      .filter(
        (entidad) =>
          !distinctOrganizationalLevels.some((opcion) => opcion.value === entidad.ambito)
      )
      .map((entidad) => ({ value: entidad.ambito, label: entidad.ambito })),
  ].sort(
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
    const compararPorColumna = getComparator(table.order, table.orderBy);
    const compararFilas = (a, b) => {
      if (!esMemoria) {
        const aEsExComandante = a.nationalXMemberPosition === POSICION_EX_COMANDANTE;
        const bEsExComandante = b.nationalXMemberPosition === POSICION_EX_COMANDANTE;

        if (aEsExComandante !== bEsExComandante) return aEsExComandante ? 1 : -1;
      }

      return table.hasUserSorted ? compararPorColumna(a, b) : compararJerarquia(a, b);
    };

    const filtered = applyFilter({
      inputData: tableData,
      comparator: compararFilas,
      filters: currentFilters,
    });

    return filtered;
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

  const cargandoLista = esMemoria ? memoria.cargando : cargandoHoy;

  const cambiarCuatrienio = (id) => {
    if (id === cuatrienio) return;
    setElegido(id);
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
        <OrganizationalListBreadcrumbs
          nivel="national"
          heading={
            <SelectorDeCuatrienio
              titulo="Directiva Nacional"
              cuatrienio={cuatrienio}
              onCambiar={cambiarCuatrienio}
            />
          }
          action={
            puedeEditarMemoria && (
              <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                {esMemoria && cuatrienio === ID_CUATRIENIO_LISTADO && (
                  <>
                    <Button
                      variant="outlined"
                      sx={SIN_NEGRITA}
                      startIcon={<Iconify icon="solar:import-bold" />}
                      onClick={herramientas.importar}
                    >
                      Cargar listado {ID_CUATRIENIO_LISTADO}
                    </Button>
                    <Button
                      variant="outlined"
                      sx={SIN_NEGRITA}
                      disabled={Boolean(herramientas.actualizandoFotos)}
                      startIcon={
                        herramientas.actualizandoFotos ? (
                          <CircularProgress size={16} />
                        ) : (
                          <Iconify icon="solar:gallery-add-bold" />
                        )
                      }
                      endIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
                      onClick={herramientas.abrirMenuFotos}
                    >
                      {herramientas.actualizandoFotos || 'Fotos actuales'}
                    </Button>
                  </>
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
                  <Tooltip
                    title={`Copia los cargos de hoy a la memoria de ${cuatrienio}. Si una casilla ya no tiene a nadie, la memoria NO se vacía sola: hay que quitarla a mano.`}
                  >
                    <span>
                      <Button
                        variant="outlined"
                        sx={SIN_NEGRITA}
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
                    </span>
                  </Tooltip>
                )}
              </Box>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <>
          <Card>
            <Tabs
              value={vista}
              onChange={(event, valor) => setVista(valor)}
              sx={[
                (themeItem) => ({
                  px: { md: 2.5 },
                  boxShadow: `inset 0 -2px 0 0 ${varAlpha(themeItem.vars.palette.grey['500Channel'], 0.08)}`,
                }),
              ]}
            >
              <Tab
                value="lista"
                label="Todos"
                iconPosition="end"
                icon={<Label variant="filled">{tableData.length}</Label>}
              />
              {/* Tanto la directiva de hoy como la de un cuatrienio guardado: la
                  memoria se pinta de solo lectura con sus ocupantes de entonces. */}
              <Tab value="jerarquia" label="Jerarquía" />
              {/* Quien ya no ocupa un cargo (30+ días) de nacional, region o
                  seccion. Los destacamentos tienen la suya propia. */}
              <Tab value="historia" label="Historia" />
            </Tabs>

            {/* La lista manda cuatro filtros; la Jerarquía, solo su propia barra
                (buscar por nombre + nivel de una sola opción). */}
            {vista === 'lista' && (
              <>
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
              </>
            )}

            {vista === 'jerarquia' && (
              <>
                <NationalJerarquiaToolbar
                  opcionesBusqueda={opcionesBusquedaJerarquia}
                  onSeleccionarMiembro={seleccionarMiembroJerarquia}
                  nivelOpciones={nivelesDeLaJerarquia}
                  nivelValor={nivelValorJerarquia}
                  onCambiarNivel={cambiarNivelJerarquia}
                />

                {/* Sin `alturaMaxima`: con la ventana fija de 70vh el arbol se
                    cortaba por abajo al 100 %. El organigrama toma el alto de su
                    diseño, igual que en su propia pantalla, y se ve completo. */}
                <Box sx={{ p: { xs: 1, md: 2.5 }, pt: 0 }}>
                  {cargandoLista ? (
                    <OrganigramaCargando />
                  ) : nivelDeLaJerarquia === 'seccional' ? (
                    esMemoria ? (
                      <SectionalLeadershipView
                        historico={historicoDeLaJerarquia}
                        embebido
                        resaltarMiembroId={resaltado?.id}
                        resaltarToken={resaltado?.token}
                      />
                    ) : (
                      <SectionalLeadershipView
                        idSeccion={entidadDeLaJerarquia.id}
                        embebido
                        resaltarMiembroId={resaltado?.id}
                        resaltarToken={resaltado?.token}
                      />
                    )
                  ) : nivelDeLaJerarquia === 'regional' ? (
                    esMemoria ? (
                      <RegionalLeadershipView
                        historico={historicoDeLaJerarquia}
                        embebido
                        resaltarMiembroId={resaltado?.id}
                        resaltarToken={resaltado?.token}
                      />
                    ) : (
                      <RegionalLeadershipView
                        idRegion={entidadDeLaJerarquia.id}
                        embebido
                        resaltarMiembroId={resaltado?.id}
                        resaltarToken={resaltado?.token}
                      />
                    )
                  ) : esMemoria ? (
                    <NationalLeadershipView
                      historico={historicoDeLaJerarquia}
                      embebido
                      resaltarMiembroId={resaltado?.id}
                      resaltarToken={resaltado?.token}
                    />
                  ) : (
                    // Aquí solo se consulta la estructura: los Oficiales Especiales
                    // no se asignan, agregan ni eliminan desde la lista.
                    <NationalLeadershipView
                      gestionarOficialesEspeciales={false}
                      embebido
                      resaltarMiembroId={resaltado?.id}
                      resaltarToken={resaltado?.token}
                    />
                  )}
                </Box>
              </>
            )}

            {vista === 'historia' && (
              <LeadershipHistoryTable
                filas={filasHistoria}
                loading={cargandoHoy}
                mostrarEntidad
              />
            )}

            {vista === 'lista' && displayMode === 'panel' && (
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
                      loading={cargandoLista}
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

            {vista === 'lista' && displayMode === 'panel' && (
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

          {vista === 'lista' && displayMode !== 'panel' && (
            <NationalCardList
              nationals={dataFiltered}
              canManage={canManage}
              loading={cargandoLista}
            />
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
