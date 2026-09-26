import {
  doc,
  where,
  query,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { esOficialEspecial, sonCargosCompatibles } from 'src/utils/cargos-compatibles.mjs';
import { leerConCache, valorGuardado, invalidarLecturas, avisarAOtrasSesiones } from 'src/utils/cache-de-lecturas.mjs';
import {
  TIPOS_CASILLA,
  sanearCasilla,
  crearIdCasilla,
  casillasValidas,
  posicionDeCasilla,
  COLECCION_CASILLAS_PERSONALIZADAS,
} from 'src/utils/casillas-personalizadas.mjs';
import {
  esMotivoDeSalida,
  etiquetaDeMotivo,
  debeRegistrarSalida,
  motivoDeSalidaAutomatico,
  NIVELES_HISTORIAL_NACIONAL,
  construirRegistroHistorial,
  COLECCION_HISTORIAL_DIRECTIVA,
} from 'src/utils/directiva-historial.mjs';
import {
  isAdminGlobal,
  canManageRegionLeadership,
  canManageSectionLeadership,
  canManageNationalLeadership,
  puedeEditarDirectivaHistorica,
  canManageDestLeadershipDirectly,
  destLeadershipChangeNeedsNotice,
  esProponenteRegionalDeSecciones,
  esProponenteNacionalDeDirectivas,
  puedeAprobarCambiosDeOrganizacion,
  soloSugiereLaDirectivaDeUnaSeccion,
} from 'src/utils/org-level-access';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { obtenerCargosApi } from 'src/services/cargos-api-service';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import {
  AMBITOS_CAMBIO,
  ESTADOS_CAMBIO,
  proponerCambio,
} from 'src/services/solicitudes-cambio-service';
import {
  DIRECTIVA_LEVELS,
  DIRECTIVA_POSITIONS,
  DIRECTIVA_DIVISIONS,
  CARGOS_DIRECTIVA_BASE,
  posicionDirectivaPorId,
  DIRECTIVA_DIVISION_NAMES,
  NIVELES_CARGO_EXCLUYENTES,
  registrarCasillasPersonalizadas,
  versionDeCasillasPersonalizadas,
} from 'src/catalogs/directiva-positions';

// ----------------------------------------------------------------------

/**
 * La REGION a la que pertenece una seccion.
 *
 * Hace falta para el Coordinador Regional y su Sub-Director, que proponen sobre
 * las secciones de su region: su alcance no trae ids de seccion, asi que el guarda
 * compara por region.
 *
 * Se resuelve AQUI y no se acepta de quien llama: el argumento lo pone la pantalla
 * y con el bastaria para colarse en la directiva de una seccion de otra region.
 * Se pide solo cuando el camino seccional ya fallo, y la lista de secciones va por
 * la cache de upstream, asi que a un cargo seccional no le cuesta nada.
 *
 * No poder comprobarlo NO autoriza: se devuelve vacio y el guarda deniega.
 */
const regionDeLaSeccion = async (idSeccion) => {
  const id = String(idSeccion ?? '').trim();

  if (!id) return '';

  try {
    const { getSectionalById } = await import('src/services/sectional-service');
    const seccion = await getSectionalById(id);

    return String(seccion?.regionalId ?? seccion?.idRegion ?? '');
  } catch (error) {
    console.warn('[directivas] no se pudo resolver la region de la seccion', error);

    return '';
  }
};

// Para poner el NOMBRE del cargo en el registro de auditoria, no su id.
const POSICION_POR_ID_CARGO = new Map(
  DIRECTIVA_POSITIONS.map((position) => [position.idCargo, position])
);

// Que directivas aprueba la Oficina Nacional. La de DESTACAMENTO no: la lleva su
// Coordinador, como siempre.
const AMBITO_POR_NIVEL_DIRECTIVA = {
  [DIRECTIVA_LEVELS.seccional]: AMBITOS_CAMBIO.directivaSeccion,
  [DIRECTIVA_LEVELS.regional]: AMBITOS_CAMBIO.directivaRegion,
  [DIRECTIVA_LEVELS.nacional]: AMBITOS_CAMBIO.directivaNacional,
  [DIRECTIVA_LEVELS.destacamento]: AMBITOS_CAMBIO.directivaDestacamento,
};

export const COLECCION_POSICIONES_DIRECTIVA = 'posicionesDirectiva';
export const COLECCION_CARGOS_DIRECTIVA_OBSOLETA = 'cargosDirectiva';
export const COLECCION_DIRECTIVAS_ORGANIZACIONALES = 'directivasOrganizacionales';
export const COLECCION_ASIGNACIONES_DIRECTIVA = 'asignacionesDirectiva';
export const COLECCION_DISENOS_DIRECTIVA = 'disenosDirectiva';

// Los tres consejos de supervision son los mismos niveles excluyentes que ya
// declara el catalogo: nacional, regional y seccional. La regla vive alli, aqui
// solo se aplica.
const NOMBRE_CONSEJO = {
  [DIRECTIVA_LEVELS.nacional]: 'el Consejo Ejecutivo',
  [DIRECTIVA_LEVELS.regional]: 'una directiva regional',
  [DIRECTIVA_LEVELS.seccional]: 'una directiva seccional',
};

export const esNivelDeConsejo = (nivel) => NIVELES_CARGO_EXCLUYENTES.includes(nivel);

export { esOficialEspecial, sonCargosCompatibles };

/**
 * Cargo de consejo que ya ocupa el miembro y que impide darle otro, o null.
 *
 * `idAsignacionActual` es la asignacion que se esta guardando: reescribir la
 * misma casilla no es un conflicto consigo misma.
 */
export async function buscarConflictoDeConsejo({
  idMiembro,
  idAsignacionActual = '',
  // El cargo que se va a dar (`{ nivel, idPosicionDirectiva }`): uno que puede ir
  // junto al que ya tiene no es conflicto (Oficial Especial + región o sección,
  // ver `src/utils/cargos-compatibles.mjs`).
  nuevo = null,
} = {}) {
  if (!idMiembro) return null;

  const asignaciones = await obtenerAsignacionesDirectivaPorMiembro({ idMiembro });

  return (
    asignaciones.find(
      (asignacion) =>
        esNivelDeConsejo(asignacion?.nivel) &&
        String(asignacion.idAsignacion || asignacion.id) !== String(idAsignacionActual) &&
        !(nuevo && sonCargosCompatibles(asignacion, nuevo))
    ) || null
  );
}

// El Pastor no comparte casilla consigo mismo.
//
// Es quien acompaña espiritualmente al destacamento y quien lo representa ante
// la iglesia: sumarle ademas Coordinador, Consejo o Lider de Grupo AHI MISMO lo
// pone a responder ante si mismo —los cambios del Lider de Grupo los aprueba el
// Coordinador, y el Pastor ve los datos sensibles en claro—. En OTRO
// destacamento no hay choque: son dos casas distintas.
const ID_POSICION_PASTOR = 'destacamento-pastor';

// Las asignaciones antiguas guardan la casilla en `idCargo` y las nuevas en
// `idPosicionDirectiva`. Se miran las dos, como hace `resolverRolesPorAsignaciones`.
const esPosicionDePastor = (asignacionOId) => {
  const id =
    typeof asignacionOId === 'string'
      ? asignacionOId
      : asignacionOId?.idPosicionDirectiva || asignacionOId?.idCargo || '';

  return normalizarTexto(id).toLowerCase() === ID_POSICION_PASTOR;
};

/**
 * Cargo del MISMO destacamento que choca con el de Pastor, o null.
 *
 * Choca en los dos sentidos: darle otra casilla a quien ya es Pastor, y nombrar
 * Pastor a quien ya ocupa otra casilla de ese destacamento.
 */
export async function buscarConflictoDePastor({
  idMiembro,
  nivel,
  idEntidad,
  idPosicionDirectiva = '',
  idAsignacionActual = '',
} = {}) {
  if (!idMiembro || nivel !== DIRECTIVA_LEVELS.destacamento) return null;

  const destacamento = normalizarTexto(idEntidad);

  if (!destacamento) return null;

  const asignaciones = await obtenerAsignacionesDirectivaPorMiembro({ idMiembro });
  const entraDePastor = esPosicionDePastor(idPosicionDirectiva);

  const enEseDestacamento = asignaciones.filter(
    (asignacion) =>
      asignacion?.nivel === DIRECTIVA_LEVELS.destacamento &&
      normalizarTexto(asignacion?.idEntidad) === destacamento &&
      String(asignacion.idAsignacion || asignacion.id) !== String(idAsignacionActual)
  );

  // Entra de Pastor: choca con CUALQUIER otra casilla suya de ese destacamento.
  if (entraDePastor) {
    return enEseDestacamento[0] || null;
  }

  // Entra en otra casilla: solo choca si ya es el Pastor de ahi.
  return enEseDestacamento.find((asignacion) => esPosicionDePastor(asignacion)) || null;
}

export const describirConflictoDePastor = (conflicto) => {
  const cargo = POSICION_POR_ID_CARGO.get(
    normalizarTexto(conflicto?.idPosicionDirectiva || conflicto?.idCargo)
  );

  return cargo?.nombreCargo || 'otro cargo';
};

export const describirConflictoDeConsejo = (conflicto) => {
  const cargo = POSICION_POR_ID_CARGO.get(normalizarTexto(conflicto?.idPosicionDirectiva));
  const donde = NOMBRE_CONSEJO[conflicto?.nivel] || 'otro consejo';

  return cargo?.nombreCargo ? `${cargo.nombreCargo} en ${donde}` : `un cargo en ${donde}`;
};

export const NIVELES_DIRECTIVA = DIRECTIVA_LEVELS;
export const DIVISIONES_DIRECTIVA = DIRECTIVA_DIVISIONS;

const NOMBRES_DIVISION = DIRECTIVA_DIVISION_NAMES;

const normalizarId = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizarTexto = (value = '') => String(value || '').trim();

// Quien mueve la casilla, con el nombre que se le pueda poner delante.
const describirActorDirectiva = (usuario = {}) =>
  normalizarTexto(
    usuario?.displayName ||
      [usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ') ||
      usuario?.nombre ||
      usuario?.correo ||
      usuario?.email
  ) || 'Alguien';

const normalizarClaveTexto = (value = '') =>
  normalizarTexto(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getRowsFromApi = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const toPositiveNumberOrNull = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
};

const asegurarFirebaseDirectivas = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para directivas organizacionales.');
  }
};

const ordenarCargos = (cargos = []) =>
  [...cargos].sort((a, b) => {
    const nivelCompare = String(a.nivel).localeCompare(String(b.nivel));
    if (nivelCompare !== 0) return nivelCompare;

    const divisionCompare = String(a.division || '').localeCompare(String(b.division || ''));
    if (divisionCompare !== 0) return divisionCompare;

    return Number(a.orden || 0) - Number(b.orden || 0);
  });

const normalizeCargoApi = (cargo = {}) => ({
  idCargo: toPositiveNumberOrNull(cargo.idCargo ?? cargo.id),
  nombre: normalizarTexto(cargo.nombre ?? cargo.nombreCargo ?? cargo.label),
});

const normalizePosition = (position = {}) => {
  const idPosicionDirectiva =
    position.idPosicionDirectiva || position.idCargoDirectiva || position.idCargo || position.id;
  const idCargo = toPositiveNumberOrNull(position.idCargoApi ?? position.idCargo);

  return {
    idPosicionDirectiva: String(idPosicionDirectiva || ''),
    idCargo,
    nivel: position.nivel || position.nivelOrganizacional || '',
    idPosicionPadre:
      position.idPosicionPadre || position.idCargoPadre || position.idNodoPadre || '',
    idNodoDiagrama: position.idNodoDiagrama || String(idPosicionDirectiva || ''),
    idNodoPadre: position.idNodoPadre || '',
    division: position.division ?? null,
    orden: Number(position.orden || 0),
    tipoNodo: position.tipoNodo || 'cargo',
    asignable: position.asignable !== false,
    activo: position.activo !== false,
  };
};

const buildCargoMap = (cargosApi = []) =>
  new Map(
    getRowsFromApi(cargosApi)
      .map(normalizeCargoApi)
      .filter((cargo) => cargo.idCargo)
      .map((cargo) => [String(cargo.idCargo), cargo])
  );

const buildCargoNameMap = (cargosApi = []) =>
  new Map(
    getRowsFromApi(cargosApi)
      .map(normalizeCargoApi)
      .filter((cargo) => cargo.idCargo && cargo.nombre)
      .map((cargo) => [normalizarClaveTexto(cargo.nombre), cargo])
  );

const buildLocalPositionMap = () =>
  new Map(
    CARGOS_DIRECTIVA_BASE.map((position) => [
      String(position.idCargo),
      {
        ...position,
        idPosicionDirectiva: String(position.idCargo),
      },
    ])
  );

const cargosDirectivaCache = new Map();

const mergePositionWithApiCargo = ({ position, apiCargo, localPosition }) => {
  // El nombre de PRESENTACION es el del catalogo local. En la API el mismo cargo
  // se guarda cualificado con su nivel/division ("Pastor (Destacamento)", "Lider
  // de Grupo (Navegantes)") porque alli el nombre es la unica clave y hay
  // colisiones entre niveles; dentro del organigrama de un nivel ese sufijo
  // sobra, y la division ya se anade abajo en `label`.
  const nombreCargo = localPosition?.nombreCargo || apiCargo?.nombre || '';
  const nombreDivision = position.division ? NOMBRES_DIVISION[position.division] || '' : '';

  return {
    ...position,
    id: position.idPosicionDirectiva,
    idCargo: position.idCargo || apiCargo?.idCargo || null,
    idCargoApi: position.idCargo || apiCargo?.idCargo || null,
    tipoNodo: localPosition?.tipoNodo || position.tipoNodo,
    asignable: localPosition?.asignable ?? position.asignable,
    activo: localPosition?.activo ?? position.activo,
    nombre: nombreCargo,
    nombreCargo,
    nombreDivision,
    label: nombreDivision ? `${nombreCargo} (${nombreDivision})` : nombreCargo,
  };
};

export const crearIdDirectivaOrganizacional = ({ nivel, idEntidad }) =>
  `${normalizarId(nivel)}_${normalizarId(idEntidad || 'general')}`;

// El id identifica la POSICION, no al ocupante. Cuando incluia al miembro, cada
// cambio de ocupante estrenaba documento y el del anterior quedaba activo: la
// posicion acababa con dos asignaciones y al releer ganaba la que ordenara
// ultima por id, de modo que el cambio parecia no guardarse. Con esta clave, un
// cargo es un documento y cambiar de ocupante lo sobrescribe, que es como
// funciona el organigrama del destacamento desde el principio.
export const crearIdAsignacionDirectiva = ({
  nivel,
  idEntidad,
  idCargo,
  idPosicionDirectiva = '',
  division = null,
  orden = 1,
}) =>
  [
    normalizarId(nivel),
    normalizarId(idEntidad || 'general'),
    normalizarId(idPosicionDirectiva || idCargo),
    normalizarId(division || 'general'),
    normalizarId(orden || 1),
  ].join('_');

export async function guardarCatalogoCargosDirectiva(cargos = CARGOS_DIRECTIVA_BASE) {
  asegurarFirebaseDirectivas();

  const batch = writeBatch(FIRESTORE);
  const posiciones = cargos
    .map(normalizePosition)
    .filter((position) => position.idPosicionDirectiva);
  const obsoleteSnapshot = await getDocs(
    collection(FIRESTORE, COLECCION_CARGOS_DIRECTIVA_OBSOLETA)
  );

  posiciones.forEach((position) => {
    const positionRef = doc(
      FIRESTORE,
      COLECCION_POSICIONES_DIRECTIVA,
      position.idPosicionDirectiva
    );

    batch.set(
      positionRef,
      {
        ...position,
        fechaActualizacion: serverTimestamp(),
        fechaCreacion: serverTimestamp(),
      },
      { merge: true }
    );
  });

  obsoleteSnapshot.docs.forEach((documentSnapshot) => {
    batch.delete(documentSnapshot.ref);
  });

  await batch.commit();
  invalidarLecturas(CLAVE_DIRECTIVA);
  avisarAOtrasSesiones(CLAVE_DIRECTIVA);

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'catalogo_cargos_directiva_guardado',
    descripcion: `Se guardó el catálogo de cargos de directiva (${posiciones.length} posiciones).`,
    entidad: {
      tipo: 'catalogo_cargos',
      id: 'posicionesDirectiva',
      nombre: 'Catálogo de cargos de directiva',
      ruta: '/dashboard/level/member',
    },
    despues: { totalPosiciones: posiciones.length },
    origen: 'directivas',
  });

  return posiciones.length;
}

export async function obtenerPosicionesDirectiva({ fallbackLocal = true } = {}) {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_POSICIONES_DIRECTIVA));
  const posiciones = snapshot.docs
    .map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    .map(normalizePosition);

  if (!fallbackLocal) {
    return posiciones;
  }

  // El catálogo local puede añadir posiciones sin obligar a volver a sembrar
  // Firestore antes de que el organigrama pueda usarlas. Las entradas guardadas
  // allí conservan precedencia (incluido su estado activo/inactivo); solo se
  // agregan las que aún no existen en la colección.
  const idsExistentes = new Set(posiciones.map((position) => position.idPosicionDirectiva));
  const posicionesNuevas = CARGOS_DIRECTIVA_BASE.map(normalizePosition).filter(
    (position) => !idsExistentes.has(position.idPosicionDirectiva)
  );

  return [...posiciones, ...posicionesNuevas];
}

export async function obtenerCargosDirectiva({
  nivel = '',
  division,
  incluirInactivos = false,
  incluirNoAsignables = true,
} = {}) {
  asegurarFirebaseDirectivas();

  // Las casillas añadidas desde los organigramas entran en el catálogo ANTES de
  // leerlo: sin esto "Cargo Nacional" y "Posición en tu Destacamento" no las
  // ofrecían hasta que alguien abriera una directiva en esa misma sesión.
  await obtenerCasillasPersonalizadas().catch(() => []);

  const [posiciones, cargosApi] = await Promise.all([
    obtenerPosicionesDirectiva(),
    obtenerCargosApi().catch(() => []),
  ]);
  const apiCargoMap = buildCargoMap(cargosApi);
  const apiCargoNameMap = buildCargoNameMap(cargosApi);
  const localPositionMap = buildLocalPositionMap();

  return ordenarCargos(
    posiciones
      .map((position) => {
        const localPosition = localPositionMap.get(String(position.idPosicionDirectiva));
        // Orden de resolucion del cargo en la API:
        //   1) el idCargo guardado en la posicion (Firestore),
        //   2) el `idCargoApi` fijado en el catalogo local — es lo que cubre a las
        //      posiciones ya guardadas en Firestore SIN idCargo, que de otro modo
        //      caerian al fallback por nombre y no casarian con el nombre
        //      cualificado con el que se sembraron ("Pastor (Destacamento)"),
        //   3) por nombre, para cargos creados a mano fuera del catalogo.
        const apiCargo =
          (position.idCargo ? apiCargoMap.get(String(position.idCargo)) : null) ||
          (localPosition?.idCargoApi ? apiCargoMap.get(String(localPosition.idCargoApi)) : null) ||
          apiCargoNameMap.get(normalizarClaveTexto(localPosition?.nombreCargo));

        return mergePositionWithApiCargo({ position, apiCargo, localPosition });
      })
      .filter((cargo) => (nivel ? cargo.nivel === nivel : true))
      .filter((cargo) => (division === undefined ? true : cargo.division === division))
      .filter((cargo) => (incluirInactivos ? true : cargo.activo !== false))
      .filter((cargo) => (incluirNoAsignables ? true : cargo.asignable !== false))
  );
}

export async function obtenerCargosDirectivaCached({
  nivel = '',
  division,
  incluirInactivos = false,
  incluirNoAsignables = true,
  forceRefresh = false,
} = {}) {
  const cacheKey = JSON.stringify({
    // Una casilla nueva cambia el catálogo: con la versión en la clave, la
    // lista guardada de antes no la tapa.
    casillas: versionDeCasillasPersonalizadas(),
    nivel: nivel || '',
    division: division ?? '__all__',
    incluirInactivos: Boolean(incluirInactivos),
    incluirNoAsignables: Boolean(incluirNoAsignables),
  });

  if (!forceRefresh && cargosDirectivaCache.has(cacheKey)) {
    return cargosDirectivaCache.get(cacheKey);
  }

  const request = obtenerCargosDirectiva({
    nivel,
    division,
    incluirInactivos,
    incluirNoAsignables,
  }).catch((error) => {
    cargosDirectivaCache.delete(cacheKey);
    throw error;
  });

  cargosDirectivaCache.set(cacheKey, request);
  return request;
}

export async function guardarDirectivaOrganizacional({
  nivel,
  idEntidad,
  nombreEntidad = '',
  titulo = '',
  activo = true,
} = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const directiva = {
    idDirectiva,
    nivel,
    idEntidad: String(idEntidad || ''),
    nombreEntidad: normalizarTexto(nombreEntidad),
    titulo: normalizarTexto(titulo || nombreEntidad),
    activo,
    fechaActualizacion: serverTimestamp(),
  };

  await writeBatch(FIRESTORE)
    .set(doc(FIRESTORE, COLECCION_DIRECTIVAS_ORGANIZACIONALES, idDirectiva), directiva, {
      merge: true,
    })
    .commit();
  invalidarLecturas(CLAVE_DIRECTIVA);
  avisarAOtrasSesiones(CLAVE_DIRECTIVA);

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'directiva_organizacional_guardada',
    descripcion: `Se guardó la directiva de ${directiva.nombreEntidad || directiva.idEntidad}.`,
    entidad: {
      tipo: 'directiva',
      id: idDirectiva,
      nombre: directiva.nombreEntidad || directiva.idEntidad,
      ruta: '/dashboard/level/member',
    },
    despues: directiva,
    origen: 'directivas',
  });

  return directiva;
}

// Las tres lecturas de abajo filtran en el SERVIDOR. Antes se traian la
// coleccion entera y descartaban en el cliente: cada apertura del organigrama
// descargaba las asignaciones de todas las secciones y regiones del pais, y
// obligaba a conceder lectura global en las reglas. Los indices compuestos que
// necesitan estan en firestore.indexes.json.
const mapearDocumentos = (snapshot) =>
  snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));

async function leerAsignacionesDirectiva({
  nivel,
  idEntidad,
  incluirInactivas = false,
} = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const restricciones = [where('idDirectiva', '==', idDirectiva)];

  if (!incluirInactivas) {
    restricciones.push(where('activo', '==', true));
  }

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA), ...restricciones)
  );

  return mapearDocumentos(snapshot);
}

async function leerAsignacionesDirectivaPorMiembro({
  idMiembro,
  incluirInactivas = false,
} = {}) {
  asegurarFirebaseDirectivas();

  if (!idMiembro) {
    return [];
  }

  const restricciones = [where('idMiembro', '==', String(idMiembro))];

  if (!incluirInactivas) {
    restricciones.push(where('activo', '==', true));
  }

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA), ...restricciones)
  );

  return mapearDocumentos(snapshot);
}

async function leerAsignacionesDirectivaMiembros({ incluirInactivas = false } = {}) {
  asegurarFirebaseDirectivas();

  // Esta si recorre la coleccion: alimenta la columna "Posicion" de la lista de
  // miembros, que necesita todas las directivas a la vez. Al menos el estado se
  // filtra en el servidor.
  const asignacionesRef = collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA);
  const snapshot = await getDocs(
    incluirInactivas ? asignacionesRef : query(asignacionesRef, where('activo', '==', true))
  );

  return mapearDocumentos(snapshot).filter((asignacion) => asignacion.idMiembro);
}

// LAS LECTURAS PASAN POR LA CACHE DE LECTURAS (`cache-de-lecturas.mjs`): el
// organigrama, la lista y cada pestaña volvían a pedir lo mismo a Firestore y el
// árbol salía con "Vacante" un momento en cada visita. Las escrituras de abajo
// invalidan (`invalidarLecturas('directiva:')`).
const CLAVE_DIRECTIVA = 'directiva:';

export const obtenerAsignacionesDirectiva = ({ nivel, idEntidad, incluirInactivas = false } = {}) =>
  leerConCache(
    `${CLAVE_DIRECTIVA}asignaciones:${nivel}:${idEntidad || ''}:${incluirInactivas}`,
    () => leerAsignacionesDirectiva({ nivel, idEntidad, incluirInactivas })
  );

export const obtenerAsignacionesDirectivaPorMiembro = ({ idMiembro, incluirInactivas = false } = {}) =>
  leerConCache(`${CLAVE_DIRECTIVA}por-miembro:${idMiembro || ''}:${incluirInactivas}`, () =>
    leerAsignacionesDirectivaPorMiembro({ idMiembro, incluirInactivas })
  );

export const obtenerAsignacionesDirectivaMiembros = ({ incluirInactivas = false } = {}) =>
  leerConCache(`${CLAVE_DIRECTIVA}miembros:${incluirInactivas}`, () =>
    leerAsignacionesDirectivaMiembros({ incluirInactivas })
  );

// La pestaña "Historia": quienes salieron de un cargo (30+ dias, ver
// `directiva-historial.mjs`) de UNA entidad puntual (un destacamento, una
// seccion o una region).
async function leerHistorialDirectiva({ nivel, idEntidad }) {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_HISTORIAL_DIRECTIVA),
      where('nivel', '==', nivel),
      where('idEntidad', '==', String(idEntidad ?? ''))
    )
  );

  return mapearDocumentos(snapshot);
}

export const obtenerHistorialDirectiva = ({ nivel, idEntidad }) =>
  leerConCache(`${CLAVE_DIRECTIVA}historial:${nivel}:${idEntidad || ''}`, () =>
    leerHistorialDirectiva({ nivel, idEntidad })
  );

// La pestaña "Historia" GLOBAL del Consejo Nacional: nacional + todas las
// regiones + todas las secciones. Destacamento queda afuera a propósito — su
// historial se ve solo en la pestaña de cada destacamento.
async function leerHistorialDirectivaGlobal() {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_HISTORIAL_DIRECTIVA),
      where('nivel', 'in', [...NIVELES_HISTORIAL_NACIONAL])
    )
  );

  return mapearDocumentos(snapshot);
}

export const obtenerHistorialDirectivaGlobal = () =>
  leerConCache(`${CLAVE_DIRECTIVA}historial-global`, () => leerHistorialDirectivaGlobal());

/**
 * EL MOTIVO DE UNA SALIDA, PRECISADO A MANO. Al salir solo se sabe si lo
 * reemplazaron o si la casilla quedo vacia; renuncia, fallecimiento o fin de
 * cuatrienio lo dice el Administrador Global o la Oficina Nacional. Solo se
 * tocan el motivo y su nota: las fechas y la persona son historia y no cambian
 * (las reglas de Firestore lo exigen igual).
 */
export async function cambiarMotivoDeSalida({ salida, motivo, nota = '', usuario = {} } = {}) {
  asegurarFirebaseDirectivas();

  if (!puedeEditarDirectivaHistorica(usuario)) {
    throw new Error('Solo el Administrador Global y la Oficina Nacional cambian el motivo.');
  }

  if (!salida?.id || !esMotivoDeSalida(motivo)) {
    throw new Error('Motivo de salida no válido.');
  }

  const notaLimpia = normalizarTexto(nota).slice(0, 300);
  const persona = salida.nombreMiembro || `el miembro ${salida.idMiembro}`;
  const cargo = salida.cargoNombre || 'su cargo';

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.directivaNacional,
    entidad: {
      tipo: 'historial_directiva',
      id: salida.id,
      nombre: `${cargo} · ${persona}`,
      ruta: '/dashboard/level/national',
    },
    cambios: [
      {
        campo: 'motivo',
        etiqueta: 'Motivo de salida',
        antes: etiquetaDeMotivo(salida.motivo),
        despues: etiquetaDeMotivo(motivo),
      },
    ],
    usuario,
    descripcion: `Motivo de salida de ${persona} (${cargo}): ${etiquetaDeMotivo(motivo)}.`,
    aplicarDirecto: true,
    aplicar: async () => {
      await updateDoc(doc(FIRESTORE, COLECCION_HISTORIAL_DIRECTIVA, salida.id), {
        motivo,
        motivoNota: notaLimpia,
        motivoActualizadoPorUid: String(usuario?.uid || usuario?.id || ''),
        motivoActualizadoEn: serverTimestamp(),
      });
      invalidarLecturas(CLAVE_DIRECTIVA);
      avisarAOtrasSesiones(CLAVE_DIRECTIVA);
    },
  });
}

/** Lo ya leído de las asignaciones de una directiva, sin pedir nada (primer render). */
export const asignacionesDirectivaGuardadas = ({ nivel, idEntidad, incluirInactivas = false } = {}) =>
  valorGuardado(`${CLAVE_DIRECTIVA}asignaciones:${nivel}:${idEntidad || ''}:${incluirInactivas}`);

export async function guardarAsignacionDirectiva({
  nivel,
  idEntidad,
  nombreEntidad = '',
  idCargo,
  idMiembro,
  idMiembros,
  idPosicionDirectiva = '',
  division = null,
  orden = 1,
  origen = 'miembro',
  usuario = {},
  fechaInicio = new Date().toISOString().slice(0, 10),
  fechaFin = null,
  activo = true,
  nombreMiembro = '',
  codigoMiembro = '',
  fotoMiembro = '',
  // Solo para el selector de cargo de la ficha del miembro, que CAMBIA el cargo
  // (guarda el nuevo y retira el anterior en el mismo envio). Ahi el estado final
  // sigue siendo un unico consejo, asi que bloquearlo dejaria la ficha sin manera
  // de mover a nadie de seccion a region.
  reemplazarCargoDeConsejo = false,
} = {}) {
  asegurarFirebaseDirectivas();

  const esAprobador = puedeAprobarCambiosDeOrganizacion(usuario);
  let puedeComponer =
    esAprobador ||
    (nivel === DIRECTIVA_LEVELS.destacamento &&
      (canManageDestLeadershipDirectly(usuario, idEntidad) ||
        esProponenteNacionalDeDirectivas(usuario))) ||
    (nivel === DIRECTIVA_LEVELS.seccional && canManageSectionLeadership(usuario, idEntidad)) ||
    (nivel === DIRECTIVA_LEVELS.regional && canManageRegionLeadership(usuario, idEntidad)) ||
    (nivel === DIRECTIVA_LEVELS.nacional && canManageNationalLeadership(usuario));

  // EL SEGUNDO CAMINO DE UNA DIRECTIVA SECCIONAL: por la region de la seccion.
  //
  // Va aparte y despues porque cuesta una consulta: solo se paga cuando el camino
  // de siempre ya dijo no y quien actua es el Coordinador Regional o su
  // Sub-Director. Para el resto -un cargo seccional, un usuario comun- esto no se
  // ejecuta.
  if (
    !puedeComponer &&
    nivel === DIRECTIVA_LEVELS.seccional &&
    esProponenteRegionalDeSecciones(usuario)
  ) {
    puedeComponer = canManageSectionLeadership(usuario, idEntidad, {
      regionId: await regionDeLaSeccion(idEntidad),
    });
  }

  if (!puedeComponer) {
    throw new Error('No tienes permiso para proponer cambios en esta directiva.');
  }

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const idMiembroResolved = String(idMiembro || idMiembros || '');
  const idAsignacion = crearIdAsignacionDirectiva({
    nivel,
    idEntidad,
    idCargo,
    idPosicionDirectiva,
    division,
    orden,
  });
  // Un miembro sirve en UN solo consejo. Sin esta comprobacion se le podia dar
  // un cargo seccional a quien ya estaba en el Consejo Ejecutivo, y la persona
  // aparecia dos veces en la lista de directivas con dos ambitos distintos.
  // Dar de baja (`activo: false`) nunca se bloquea: es justo lo que resuelve el
  // conflicto.
  if (activo && !reemplazarCargoDeConsejo && idMiembroResolved && esNivelDeConsejo(nivel)) {
    const conflicto = await buscarConflictoDeConsejo({
      idMiembro: idMiembroResolved,
      idAsignacionActual: idAsignacion,
      nuevo: { nivel, idPosicionDirectiva },
    });

    if (conflicto) {
      throw new Error(
        `Ya ocupa ${describirConflictoDeConsejo(conflicto)}. Retírelo de ese cargo antes de asignarle otro: nadie puede estar en dos consejos a la vez.`
      );
    }
  }

  // El Pastor de un destacamento no ocupa ninguna otra casilla de ESE
  // destacamento. Igual que arriba, dar de baja nunca se bloquea.
  if (activo && idMiembroResolved && nivel === DIRECTIVA_LEVELS.destacamento) {
    const conflicto = await buscarConflictoDePastor({
      idMiembro: idMiembroResolved,
      nivel,
      idEntidad,
      idPosicionDirectiva,
      idAsignacionActual: idAsignacion,
    });

    if (conflicto) {
      const entraDePastor = esPosicionDePastor(idPosicionDirectiva);
      const otro = describirConflictoDePastor(conflicto);
      const donde = normalizarTexto(nombreEntidad) || 'ese destacamento';

      throw new Error(
        entraDePastor
          ? `Ya ocupa ${otro} en ${donde}. El Pastor no puede tener otro cargo en su mismo destacamento: retírelo de ese cargo primero.`
          : `Es el Pastor de ${donde}. El Pastor no puede tener otro cargo en su mismo destacamento: retírelo de Pastor primero.`
      );
    }
  }

  // Copia del ocupante cuando quien llama no la trae. Sin esto la asignacion se
  // guardaba con el nombre en blanco —le pasaba a todo llamador que solo tuviera
  // el id a mano— y cualquier vista que confie en la copia en vez de resolverla
  // contra el listado de miembros pintaba un hueco.
  // El import es dinamico a proposito: `member-service` ya importa este modulo,
  // y hacerlo estatico cerraria el ciclo.
  let nombreCopia = normalizarTexto(nombreMiembro);
  let codigoCopia = normalizarTexto(codigoMiembro);

  if (idMiembroResolved && (!nombreCopia || !codigoCopia)) {
    try {
      const { getMembers } = await import('src/services/member-service');
      const miembros = await getMembers();
      const miembro = (Array.isArray(miembros) ? miembros : []).find(
        (candidato) =>
          String(candidato?.id) === idMiembroResolved ||
          String(candidato?.idMiembros) === idMiembroResolved
      );

      if (miembro) {
        nombreCopia =
          nombreCopia ||
          [miembro.firstName ?? miembro.nombres, miembro.lastName ?? miembro.apellidos]
            .filter(Boolean)
            .join(' ')
            .trim();
        codigoCopia = codigoCopia || normalizarTexto(miembro.memberId || miembro.codigoMiembro);
      }
    } catch {
      // Sin listado disponible se guarda igual: la copia es una ayuda, no la
      // fuente de verdad, y bloquear el guardado por esto seria peor.
    }
  }

  const asignacion = {
    idAsignacion,
    idDirectiva,
    nivel,
    idEntidad: String(idEntidad || ''),
    idCargo: toPositiveNumberOrNull(idCargo),
    idMiembro: idMiembroResolved,
    idPosicionDirectiva: normalizarTexto(idPosicionDirectiva),
    division,
    orden,
    origen,
    fechaInicio,
    fechaFin,
    activo,
    // Copia del ocupante: si el miembro no viene en el listado que carga el
    // organigrama, el nodo se pintaba vacio aunque la asignacion existiera.
    nombreMiembro: nombreCopia,
    codigoMiembro: codigoCopia,
    fotoMiembro: normalizarTexto(fotoMiembro),
    fechaActualizacion: serverTimestamp(),
    fechaCreacion: serverTimestamp(),
  };
  const asignacionesDeLaEntidad = await obtenerAsignacionesDirectiva({ nivel, idEntidad }).catch(
    () => []
  );
  // Documentos de la MISMA posicion con otra clave: los que quedaron del esquema
  // anterior, cuando el id incluia al miembro. Se dan de baja en el mismo lote
  // para que la posicion no acabe con dos ocupantes activos.
  const asignacionesPrevias = asignacionesDeLaEntidad.filter(
    (previa) =>
      normalizarTexto(previa.idPosicionDirectiva) === normalizarTexto(idPosicionDirectiva) &&
      String(previa.idAsignacion || previa.id) !== idAsignacion
  );
  // Quien ocupaba ESTA MISMA casilla antes de esta escritura: si sale (la
  // reemplazan o queda vacante) y llevaba 30+ dias, se guarda su paso en el
  // historial antes de que el `set` de mas abajo lo sobreescriba sin dejar
  // rastro (ver `directiva-historial.mjs`).
  const ocupanteActual = asignacionesDeLaEntidad.find(
    (previa) => String(previa.idAsignacion || previa.id) === idAsignacion
  );
  const registroHistorial = debeRegistrarSalida({
    anterior: ocupanteActual,
    siguienteIdMiembro: idMiembroResolved,
    siguienteActivo: activo,
    fechaSalida: fechaInicio,
  })
    ? construirRegistroHistorial({
        anterior: ocupanteActual,
        idAsignacion,
        fechaSalida: fechaInicio,
        motivo: motivoDeSalidaAutomatico({
          siguienteIdMiembro: idMiembroResolved,
          siguienteActivo: activo,
        }),
      })
    : null;
  const batch = writeBatch(FIRESTORE);

  if (registroHistorial) {
    batch.set(doc(FIRESTORE, COLECCION_HISTORIAL_DIRECTIVA, registroHistorial.id), {
      ...registroHistorial,
      fechaCreacion: serverTimestamp(),
    });
  }

  asignacionesPrevias.forEach((previa) => {
    batch.set(
      doc(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA, String(previa.idAsignacion || previa.id)),
      {
        activo: false,
        fechaFin: fechaInicio,
        fechaActualizacion: serverTimestamp(),
      },
      { merge: true }
    );
  });

  batch.set(
    doc(FIRESTORE, COLECCION_DIRECTIVAS_ORGANIZACIONALES, idDirectiva),
    {
      idDirectiva,
      nivel,
      idEntidad: String(idEntidad || ''),
      nombreEntidad: normalizarTexto(nombreEntidad),
      titulo: normalizarTexto(nombreEntidad),
      activo: true,
      fechaActualizacion: serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(doc(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA, idAsignacion), asignacion, {
    merge: true,
  });

  // El registro va dirigido a una persona que lo lee, no a la base de datos: el
  // nombre y el cargo por delante, y el id solo cuando no hay nombre. Antes
  // decia "al miembro 306", que no le dice nada a nadie.
  // `nombreCopia`, no `nombreMiembro`: quien llama con solo el id (la directiva
  // regional, por ejemplo) dejaba la solicitud en "el miembro 323" aunque arriba
  // ya se hubiera resuelto el nombre.
  const personaAuditoria = nombreCopia || `el miembro ${idMiembroResolved}`;
  const cargoAuditoria =
    (
      POSICION_POR_ID_CARGO.get(normalizarTexto(idPosicionDirectiva)) ||
      posicionDirectivaPorId(normalizarTexto(idPosicionDirectiva))
    )?.nombreCargo || '';
  const dondeAuditoria = normalizarTexto(nombreEntidad) || `${nivel} ${idEntidad}`;
  const descripcionCambio = cargoAuditoria
    ? `Se asignó a ${personaAuditoria} el cargo de ${cargoAuditoria} en ${dondeAuditoria}.`
    : `Se asignó un cargo de directiva a ${personaAuditoria} en ${dondeAuditoria}.`;

  // El Consejo Ejecutivo puede intervenir en cualquier destacamento, pero por
  // esa autoridad nacional siempre PROPONE. La directiva local queda directa
  // unicamente para quien ejerce uno de sus siete cargos dentro de SU entidad.
  const propuestaNacionalSobreDestacamento =
    nivel === DIRECTIVA_LEVELS.destacamento &&
    esProponenteNacionalDeDirectivas(usuario) &&
    !canManageDestLeadershipDirectly(usuario, idEntidad);

  // EL SUB-DIRECTOR REGIONAL SUGIERE. Compone la directiva de las secciones de su
  // region igual que su Coordinador, pero no habla por la region: lo suyo queda
  // registrado como sugerido. Su Coordinador Regional propone.
  const sugerenciaDelSubDirectorRegional =
    nivel === DIRECTIVA_LEVELS.seccional && soloSugiereLaDirectivaDeUnaSeccion(usuario);

  // Las directivas de seccion, region y consejo nacional las aprueba la Oficina
  // Nacional o el Administrador Global: hasta entonces la asignacion NO se
  // escribe. La de destacamento sigue directa para sus cargos locales; si la
  // propone el Consejo Ejecutivo, tambien espera aprobacion.
  const resultado = await proponerCambio({
    ambito: AMBITO_POR_NIVEL_DIRECTIVA[nivel] ?? AMBITOS_CAMBIO.directivaDestacamento,
    entidad: {
      tipo: 'asignacion_directiva',
      id: idAsignacion,
      nombre: `${cargoAuditoria || 'Cargo'} · ${dondeAuditoria}`,
      ruta: `/dashboard/level/member/${idMiembroResolved}/edit`,
    },
    cambios: [
      {
        campo: normalizarTexto(idPosicionDirectiva) || 'cargo',
        etiqueta: cargoAuditoria || 'Cargo de directiva',
        antes: null,
        despues: personaAuditoria,
      },
    ],
    usuario,
    descripcion: descripcionCambio,
    aplicarDirecto: esAprobador,
    esSugerencia: propuestaNacionalSobreDestacamento || sugerenciaDelSubDirectorRegional,
    // El lote de escritura no se puede guardar; los argumentos si. Al aprobar se
    // vuelve a llamar a esta misma funcion con ellos, ya como Oficina Nacional.
    payload: {
      nivel,
      idEntidad,
      nombreEntidad,
      idCargo,
      idMiembro: idMiembroResolved,
      idPosicionDirectiva,
      division,
      orden,
      origen,
      nombreMiembro,
      codigoMiembro,
      fotoMiembro,
    },
    aplicar: async () => {
      await batch.commit();
      invalidarLecturas(CLAVE_DIRECTIVA);
  avisarAOtrasSesiones(CLAVE_DIRECTIVA);
    },
  });

  if (resultado.estado === ESTADOS_CAMBIO.pendiente) {
    return {
      ...asignacion,
      pendienteDeAprobacion: true,
      idSolicitud: resultado.idSolicitud,
      asignacionesLiberadas: [],
    };
  }

  // El Coordinador y su Asistente se enteran de lo que otro cargo movio en SU
  // directiva. El cambio ya esta escrito: esto no lo detiene ni lo somete a
  // nadie, solo evita que la directiva se recomponga a sus espaldas. Va por
  // detras y sin `await` de bloqueo: un aviso que falla no deshace una
  // asignacion valida. El import es dinamico para no cerrar un ciclo con el
  // servicio de notificaciones.
  if (nivel === DIRECTIVA_LEVELS.destacamento && destLeadershipChangeNeedsNotice(usuario)) {
    import('./solicitudes-cambio-notificaciones-service')
      .then(({ notificarCambioDirectivaDestacamento }) =>
        notificarCambioDirectivaDestacamento({
          idDestacamento: idEntidad,
          nombreDestacamento: nombreEntidad,
          nombreCargo: cargoAuditoria,
          nombreMiembro: nombreCopia || personaAuditoria,
          activo,
          actorId: usuario?.uid || usuario?.id || '',
          actorNombre: describirActorDirectiva(usuario),
        })
      )
      .catch((error) => {
        console.warn('[directivas] no se pudo avisar del cambio en la directiva', error);
      });
  }

  return { ...asignacion, asignacionesLiberadas: asignacionesPrevias };
}

// Da de BAJA las asignaciones activas que el miembro tenga en un nivel, salvo la
// que se acaba de guardar. Un miembro ocupa UNA posicion por nivel: sin esto,
// cambiarlo de cargo dejaba viva la anterior y el miembro aparecia en dos
// casillas a la vez.
export async function desactivarAsignacionesDirectivaPorNivel({
  idMiembro,
  nivel,
  conservarIdAsignacion = '',
  // El cargo que se acaba de dar: los que pueden ir junto a él NO se retiran.
  // Sin esto, hacer Oficial Especial a un Subdirector Regional le quitaba la
  // región (y al revés).
  compatibleCon = null,
  fechaFin = new Date().toISOString().slice(0, 10),
} = {}) {
  asegurarFirebaseDirectivas();

  if (!idMiembro || !nivel) {
    return 0;
  }

  const asignaciones = await obtenerAsignacionesDirectivaPorMiembro({ idMiembro });
  const aDesactivar = asignaciones.filter(
    (asignacion) =>
      asignacion.nivel === nivel &&
      String(asignacion.idAsignacion || asignacion.id) !== String(conservarIdAsignacion) &&
      !(compatibleCon && sonCargosCompatibles(asignacion, compatibleCon))
  );

  if (!aDesactivar.length) {
    return 0;
  }

  const batch = writeBatch(FIRESTORE);

  aDesactivar.forEach((asignacion) => {
    batch.set(
      doc(
        FIRESTORE,
        COLECCION_ASIGNACIONES_DIRECTIVA,
        String(asignacion.idAsignacion || asignacion.id)
      ),
      { activo: false, fechaFin, fechaActualizacion: serverTimestamp() },
      { merge: true }
    );
  });

  await batch.commit();
  invalidarLecturas(CLAVE_DIRECTIVA);
  avisarAOtrasSesiones(CLAVE_DIRECTIVA);

  return aDesactivar.length;
}

/**
 * Retira TODAS las asignaciones activas de un miembro, sea del nivel que sea.
 *
 * Se usa al darlo de baja. Antes, borrar a una persona dejaba sus cargos
 * apuntando a un id que ya no existe: la casilla seguia ocupada por un fantasma
 * y, al intentar dársela a otro, el aviso de "ya la ocupa fulano" salia sin
 * nombre, diciendo que se le retiraba a la misma persona a la que se le daba.
 *
 * No se borran los documentos: quedan inactivos, para conservar el historico.
 */
export async function desactivarAsignacionesDirectivaDelMiembro({
  idMiembro,
  fechaFin = new Date().toISOString().slice(0, 10),
} = {}) {
  asegurarFirebaseDirectivas();

  if (!idMiembro) {
    return 0;
  }

  const asignaciones = await obtenerAsignacionesDirectivaPorMiembro({ idMiembro });

  if (!asignaciones.length) {
    return 0;
  }

  const batch = writeBatch(FIRESTORE);

  asignaciones.forEach((asignacion) => {
    batch.set(
      doc(
        FIRESTORE,
        COLECCION_ASIGNACIONES_DIRECTIVA,
        String(asignacion.idAsignacion || asignacion.id)
      ),
      { activo: false, fechaFin, fechaActualizacion: serverTimestamp() },
      { merge: true }
    );
  });

  await batch.commit();
  invalidarLecturas(CLAVE_DIRECTIVA);
  avisarAOtrasSesiones(CLAVE_DIRECTIVA);

  return asignaciones.length;
}

// ----------------------------------------------------------------------
// Diseno del organigrama (posiciones de los nodos y alto del lienzo).
//
// La coleccion estaba declarada desde el principio y nunca se escribio: el
// editor visual guardaba los desplazamientos en memoria y se perdian al
// recargar. Se guarda por nivel + entidad, igual que la directiva.
// ----------------------------------------------------------------------

async function leerDisenoDirectiva({ nivel, idEntidad } = {}) {
  asegurarFirebaseDirectivas();

  if (!nivel) return null;

  const idDiseno = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const snapshot = await getDoc(doc(FIRESTORE, COLECCION_DISENOS_DIRECTIVA, idDiseno));

  if (!snapshot.exists()) return null;

  const data = snapshot.data();

  return {
    idDiseno,
    nodeOffsets: data?.nodeOffsets && typeof data.nodeOffsets === 'object' ? data.nodeOffsets : {},
    containerHeightOffset: Number(data?.containerHeightOffset) || 0,
    containerWidthOffset: Number(data?.containerWidthOffset) || 0,
    connectionGroups: Array.isArray(data?.connectionGroups) ? data.connectionGroups : [],
    hiddenConnections: Array.isArray(data?.hiddenConnections) ? data.hiddenConnections : [],
    extraConnections: Array.isArray(data?.extraConnections) ? data.extraConnections : [],
    customNodeCounts:
      data?.customNodeCounts && typeof data.customNodeCounts === 'object'
        ? data.customNodeCounts
        : {},
    customNodeLists:
      data?.customNodeLists && typeof data.customNodeLists === 'object'
        ? data.customNodeLists
        : {},
  };
}

export const obtenerDisenoDirectiva = ({ nivel, idEntidad } = {}) =>
  leerConCache(`${CLAVE_DIRECTIVA}diseno:${nivel}:${idEntidad || ''}`, () =>
    leerDisenoDirectiva({ nivel, idEntidad })
  );

/** Diseño ya leído, o `undefined` si aún no se ha pedido (`null` = no hay diseño). */
export const disenoDirectivaGuardado = ({ nivel, idEntidad } = {}) =>
  valorGuardado(`${CLAVE_DIRECTIVA}diseno:${nivel}:${idEntidad || ''}`);

export async function guardarDisenoDirectiva({
  nivel,
  idEntidad,
  nombreEntidad = '',
  nodeOffsets = {},
  containerHeightOffset = 0,
  containerWidthOffset = 0,
  connectionGroups = [],
  hiddenConnections = [],
  extraConnections = [],
  customNodeCounts = {},
  customNodeLists = {},
  usuario = {},
} = {}) {
  asegurarFirebaseDirectivas();

  if (!nivel) {
    throw new Error('El nivel es obligatorio para guardar el diseño del organigrama.');
  }

  const idDiseno = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  // Solo pares de numeros: el mapa de desplazamientos se arma en el navegador y
  // no puede acabar guardando lo que llegue.
  const offsetsNormalizados = Object.entries(nodeOffsets).reduce((acc, [id, offset]) => {
    const x = Number(offset?.x);
    const y = Number(offset?.y);

    if (id && Number.isFinite(x) && Number.isFinite(y)) {
      acc[id] = { x: Math.round(x), y: Math.round(y) };
    }

    return acc;
  }, {});
  const diseno = {
    idDiseno,
    nivel,
    idEntidad: String(idEntidad || ''),
    nombreEntidad: normalizarTexto(nombreEntidad),
    nodeOffsets: offsetsNormalizados,
    containerHeightOffset: Math.round(Number(containerHeightOffset) || 0),
    // Nunca negativo: el cuadro se ensancha por fuera de su columna, no se
    // estrecha por dentro.
    containerWidthOffset: Math.max(0, Math.round(Number(containerWidthOffset) || 0)),
    // Solo listas de textos, y de dos en adelante: los grupos se arman en el
    // navegador y no pueden acabar guardando lo que llegue.
    connectionGroups: (Array.isArray(connectionGroups) ? connectionGroups : [])
      .map((grupo) =>
        (Array.isArray(grupo) ? grupo : []).map((clave) => String(clave || '')).filter(Boolean)
      )
      .filter((grupo) => grupo.length > 1),
    // Lineas que el cuadro no dibuja, y lineas puestas a mano entre dos
    // casillas. Como el resto del diseno, se saneen antes de guardarse.
    hiddenConnections: (Array.isArray(hiddenConnections) ? hiddenConnections : [])
      .map((id) => String(id || ''))
      .filter(Boolean),
    extraConnections: (Array.isArray(extraConnections) ? extraConnections : [])
      .map((vinculo) => ({
        from: String(vinculo?.from || ''),
        to: String(vinculo?.to || ''),
        // Por que lado sale y por cual entra, si se hizo arrastrando.
        fromLado: String(vinculo?.fromLado || vinculo?.fromEsquina || ''),
        toLado: String(vinculo?.toLado || vinculo?.toEsquina || ''),
      }))
      .filter((vinculo) => vinculo.from && vinculo.to && vinculo.from !== vinculo.to),
    customNodeCounts: Object.entries(
      customNodeCounts && typeof customNodeCounts === 'object' ? customNodeCounts : {}
    ).reduce((acc, [clave, valor]) => {
      const cantidad = Number(valor);

      if (/^[a-zA-Z0-9_-]{1,64}$/.test(clave) && Number.isFinite(cantidad)) {
        acc[clave] = Math.max(0, Math.min(20, Math.floor(cantidad)));
      }

      return acc;
    }, {}),
    customNodeLists: Object.entries(
      customNodeLists && typeof customNodeLists === 'object' ? customNodeLists : {}
    ).reduce((acc, [clave, valores]) => {
      if (/^[a-zA-Z0-9_-]{1,64}$/.test(clave) && Array.isArray(valores)) {
        acc[clave] = [
          ...new Set(
            valores
              .map((valor) => String(valor || ''))
              .filter((valor) => /^[a-zA-Z0-9_-]{1,64}$/.test(valor))
          ),
        ].slice(0, 20);
      }

      return acc;
    }, {}),
    fechaActualizacion: serverTimestamp(),
  };

  await writeBatch(FIRESTORE)
    .set(doc(FIRESTORE, COLECCION_DISENOS_DIRECTIVA, idDiseno), diseno, { merge: true })
    .commit();
  invalidarLecturas(CLAVE_DIRECTIVA);
  avisarAOtrasSesiones(CLAVE_DIRECTIVA);

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'diseno_directiva_guardado',
    descripcion: `Se guardó el diseño del organigrama de ${diseno.nombreEntidad || idDiseno}.`,
    entidad: {
      tipo: 'diseno_directiva',
      id: idDiseno,
      nombre: diseno.nombreEntidad || idDiseno,
      ruta: '/dashboard/level/member',
    },
    despues: diseno,
    realizadoPor: usuario,
    origen: 'directivas',
  });

  return diseno;
}

// ----------------------------------------------------------------------
// Casillas y contenedores añadidos desde el organigrama
// (`src/utils/casillas-personalizadas.mjs`). Son globales por nivel: la ficha
// se guarda una vez y la dibujan todas las entidades de ese nivel.
// ----------------------------------------------------------------------

const CLAVE_CASILLAS = `${CLAVE_DIRECTIVA}casillas`;

async function leerCasillasPersonalizadas() {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_CASILLAS_PERSONALIZADAS));
  const lista = casillasValidas(
    snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
  );

  registrarCasillasPersonalizadas(lista);

  return lista;
}

/** Todas las válidas (también las quitadas, para traducir nombres). */
//
// Se registran también cuando llegan de la caché: lo guardado puede venir del
// disco de una visita anterior, y entonces la lectura no llega a ejecutarse.
export const obtenerCasillasPersonalizadas = () =>
  leerConCache(CLAVE_CASILLAS, leerCasillasPersonalizadas).then((lista) => {
    registrarCasillasPersonalizadas(lista);
    return lista;
  });

/** Las ya leídas (y registradas), o `undefined` si aún no se han pedido. */
export const casillasPersonalizadasGuardadas = () => {
  const lista = valorGuardado(CLAVE_CASILLAS);

  if (lista !== undefined) registrarCasillasPersonalizadas(lista);

  return lista;
};

const avisarCambioDeCasillas = () => {
  cargosDirectivaCache.clear();
  invalidarLecturas(CLAVE_DIRECTIVA);
  avisarAOtrasSesiones(CLAVE_DIRECTIVA);
};

export async function crearCasillaPersonalizada({
  nivel,
  nombre,
  tipo = TIPOS_CASILLA.casilla,
  idNodoPadre,
  division = null,
  usuario = {},
} = {}) {
  asegurarFirebaseDirectivas();

  // Lo mismo que exigen las reglas: la casilla es de todas las entidades del
  // nivel, así que solo la crea quien diseña los organigramas.
  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global añade casillas a las directivas.');
  }

  // Las de hoy, frescas: con ellas en el catálogo se comprueba el nombre
  // repetido, y el registro de abajo no pierde las demás si la caché estaba vacía.
  const existentes = await obtenerCasillasPersonalizadas();
  const ahora = Date.now();
  const casilla = sanearCasilla({
    id: crearIdCasilla(ahora),
    nivel,
    nombre,
    tipo,
    idNodoPadre,
    division,
    orden: ahora,
    activo: true,
  });

  if (!casilla) {
    throw new Error('Revisa el nombre (de 2 a 60 letras) y dónde va la casilla.');
  }

  const nombreRepetido = DIRECTIVA_POSITIONS.some(
    (posicion) =>
      posicion.nivel === casilla.nivel &&
      posicion.activo !== false &&
      (posicion.division ?? null) === (casilla.division ?? null) &&
      normalizarClaveTexto(posicion.nombreCargo) === normalizarClaveTexto(casilla.nombre)
  );

  if (nombreRepetido) {
    throw new Error(`Ya hay un cargo "${casilla.nombre}" en este nivel.`);
  }

  const ficha = {
    ...casilla,
    creadoPor: describirActorDirectiva(usuario),
    uidCreador: String(usuario?.uid || usuario?.id || ''),
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  };

  await writeBatch(FIRESTORE)
    .set(doc(FIRESTORE, COLECCION_CASILLAS_PERSONALIZADAS, casilla.id), ficha)
    .commit();

  // Se pinta sin esperar a volver a leer la colección.
  registrarCasillasPersonalizadas([...existentes, casilla]);
  avisarCambioDeCasillas();

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'casilla_directiva_creada',
    descripcion: `Se añadió ${casilla.tipo === TIPOS_CASILLA.contenedor ? 'el contenedor' : 'la casilla'} "${casilla.nombre}" a las directivas de nivel ${casilla.nivel}.`,
    entidad: {
      tipo: 'casilla_directiva',
      id: casilla.id,
      nombre: casilla.nombre,
      ruta: '/dashboard/level/national',
    },
    despues: casilla,
    realizadoPor: usuario,
    origen: 'directivas',
  });

  return casilla;
}

/** Cuántas asignaciones activas tiene la casilla, en cualquier entidad del nivel. */
export async function contarOcupantesDeCasilla(casilla) {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA),
      where('idPosicionDirectiva', '==', posicionDeCasilla(casilla).idCargo),
      where('activo', '==', true)
    )
  );

  return snapshot.size;
}

/**
 * Cambia el nombre de una casilla en todas partes a la vez: organigramas,
 * ficha, lista e historial lo toman del catálogo, y las asignaciones guardan
 * el id, no el nombre.
 */
export async function renombrarCasillaPersonalizada({ id, nombre, usuario = {} } = {}) {
  asegurarFirebaseDirectivas();

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global renombra casillas de las directivas.');
  }

  const idCasilla = normalizarTexto(id);
  // Fresca y no la de la caché: vacía, `antes` no llegaba y la comprobación de
  // ocupantes se saltaba.
  const lista = await obtenerCasillasPersonalizadas();
  const antes = lista.find((casilla) => casilla.id === idCasilla);

  if (!antes) {
    throw new Error('Esa casilla ya no existe.');
  }
  const despues = sanearCasilla({ ...antes, nombre });

  if (!despues) {
    throw new Error('El nombre debe tener de 2 a 60 letras.');
  }

  if (despues.nombre === antes.nombre) return despues;

  const nombreRepetido = DIRECTIVA_POSITIONS.some(
    (posicion) =>
      posicion.nivel === despues.nivel &&
      posicion.activo !== false &&
      posicion.idCasilla !== idCasilla &&
      (posicion.division ?? null) === (despues.division ?? null) &&
      normalizarClaveTexto(posicion.nombreCargo) === normalizarClaveTexto(despues.nombre)
  );

  if (nombreRepetido) {
    throw new Error(`Ya hay un cargo "${despues.nombre}" en este nivel.`);
  }

  await updateDoc(doc(FIRESTORE, COLECCION_CASILLAS_PERSONALIZADAS, idCasilla), {
    nombre: despues.nombre,
    fechaActualizacion: serverTimestamp(),
  });

  registrarCasillasPersonalizadas(
    lista.map((casilla) => (casilla.id === idCasilla ? despues : casilla))
  );
  avisarCambioDeCasillas();

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'casilla_directiva_renombrada',
    descripcion: `"${antes.nombre}" pasa a llamarse "${despues.nombre}" en las directivas de nivel ${despues.nivel}.`,
    entidad: { tipo: 'casilla_directiva', id: idCasilla, nombre: despues.nombre },
    antes,
    despues,
    realizadoPor: usuario,
    origen: 'directivas',
  });

  return despues;
}

/**
 * Quita una casilla de todos los organigramas de su nivel. No se borra: queda
 * inactiva para que el historial y la lista sigan sabiendo cómo se llamaba.
 */
export async function quitarCasillaPersonalizada({ id, usuario = {} } = {}) {
  asegurarFirebaseDirectivas();

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global quita casillas de las directivas.');
  }

  const idCasilla = normalizarTexto(id);
  // Fresca y no la de la caché: vacía, `antes` no llegaba y la comprobación de
  // ocupantes se saltaba.
  const lista = await obtenerCasillasPersonalizadas();
  const antes = lista.find((casilla) => casilla.id === idCasilla);

  if (!antes) {
    throw new Error('Esa casilla ya no existe.');
  }

  // Ocupada no se quita. Su asignación seguiría activa sin verse en ninguna
  // parte: la ficha la enseñaba como "Ninguno" y, como sigue contando como
  // cargo, a esa persona no se le podía dar otro de consejo ("ya ocupa…").
  const ocupantes = await contarOcupantesDeCasilla(antes);

  if (ocupantes > 0) {
    throw new Error(
      `"${antes.nombre}" la ocupa${ocupantes === 1 ? ' una persona' : `n ${ocupantes} personas`}. Retíralas de la casilla antes de quitarla.`
    );
  }

  await updateDoc(doc(FIRESTORE, COLECCION_CASILLAS_PERSONALIZADAS, idCasilla), {
    activo: false,
    fechaActualizacion: serverTimestamp(),
  });

  registrarCasillasPersonalizadas(
    lista.map((casilla) => (casilla.id === idCasilla ? { ...casilla, activo: false } : casilla))
  );
  avisarCambioDeCasillas();

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'casilla_directiva_quitada',
    descripcion: `Se quitó "${antes.nombre}" de las directivas de nivel ${antes.nivel}.`,
    entidad: { tipo: 'casilla_directiva', id: idCasilla, nombre: antes.nombre },
    antes,
    realizadoPor: usuario,
    origen: 'directivas',
  });
}
