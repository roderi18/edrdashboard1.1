import {
  doc,
  where,
  query,
  getDoc,
  getDocs,
  writeBatch,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import {
  destLeadershipChangeNeedsNotice,
  puedeAprobarCambiosDeOrganizacion,
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
  DIRECTIVA_DIVISION_NAMES,
  NIVELES_CARGO_EXCLUYENTES,
} from 'src/catalogs/directiva-positions';

// ----------------------------------------------------------------------

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

/**
 * Cargo de consejo que ya ocupa el miembro y que impide darle otro, o null.
 *
 * `idAsignacionActual` es la asignacion que se esta guardando: reescribir la
 * misma casilla no es un conflicto consigo misma.
 */
export async function buscarConflictoDeConsejo({
  idMiembro,
  idAsignacionActual = '',
} = {}) {
  if (!idMiembro) return null;

  const asignaciones = await obtenerAsignacionesDirectivaPorMiembro({ idMiembro });

  return (
    asignaciones.find(
      (asignacion) =>
        esNivelDeConsejo(asignacion?.nivel) &&
        String(asignacion.idAsignacion || asignacion.id) !== String(idAsignacionActual)
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

  return cargo?.nombreCargo
    ? `${cargo.nombreCargo} en ${donde}`
    : `un cargo en ${donde}`;
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
  const obsoleteSnapshot = await getDocs(collection(FIRESTORE, COLECCION_CARGOS_DIRECTIVA_OBSOLETA));

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

  if (posiciones.length || !fallbackLocal) {
    return posiciones;
  }

  return CARGOS_DIRECTIVA_BASE.map(normalizePosition);
}

export async function obtenerCargosDirectiva({
  nivel = '',
  division,
  incluirInactivos = false,
  incluirNoAsignables = true,
} = {}) {
  asegurarFirebaseDirectivas();

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
          (localPosition?.idCargoApi
            ? apiCargoMap.get(String(localPosition.idCargoApi))
            : null) ||
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

export async function obtenerAsignacionesDirectiva({
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

export async function obtenerAsignacionesDirectivaPorMiembro({
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

export async function obtenerAsignacionesDirectivaMiembros({ incluirInactivas = false } = {}) {
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
  // Documentos de la MISMA posicion con otra clave: los que quedaron del esquema
  // anterior, cuando el id incluia al miembro. Se dan de baja en el mismo lote
  // para que la posicion no acabe con dos ocupantes activos.
  const asignacionesPrevias = (
    await obtenerAsignacionesDirectiva({ nivel, idEntidad }).catch(() => [])
  ).filter(
    (previa) =>
      normalizarTexto(previa.idPosicionDirectiva) === normalizarTexto(idPosicionDirectiva) &&
      String(previa.idAsignacion || previa.id) !== idAsignacion
  );
  const batch = writeBatch(FIRESTORE);

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
  const personaAuditoria = normalizarTexto(nombreMiembro) || `el miembro ${idMiembroResolved}`;
  const cargoAuditoria =
    POSICION_POR_ID_CARGO.get(normalizarTexto(idPosicionDirectiva))?.nombreCargo || '';
  const dondeAuditoria = normalizarTexto(nombreEntidad) || `${nivel} ${idEntidad}`;
  const descripcionCambio = cargoAuditoria
    ? `Se asignó a ${personaAuditoria} el cargo de ${cargoAuditoria} en ${dondeAuditoria}.`
    : `Se asignó un cargo de directiva a ${personaAuditoria} en ${dondeAuditoria}.`;

  // Las directivas de seccion, region y consejo nacional las aprueba la Oficina
  // Nacional: hasta entonces la asignacion NO se escribe. La de destacamento
  // pasa igualmente por la puerta —para que quede en Historial— pero se aplica
  // en el momento.
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
    aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
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
    aplicar: () => batch.commit(),
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
      String(asignacion.idAsignacion || asignacion.id) !== String(conservarIdAsignacion)
  );

  if (!aDesactivar.length) {
    return 0;
  }

  const batch = writeBatch(FIRESTORE);

  aDesactivar.forEach((asignacion) => {
    batch.set(
      doc(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA, String(asignacion.idAsignacion || asignacion.id)),
      { activo: false, fechaFin, fechaActualizacion: serverTimestamp() },
      { merge: true }
    );
  });

  await batch.commit();

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

  return asignaciones.length;
}

// ----------------------------------------------------------------------
// Diseno del organigrama (posiciones de los nodos y alto del lienzo).
//
// La coleccion estaba declarada desde el principio y nunca se escribio: el
// editor visual guardaba los desplazamientos en memoria y se perdian al
// recargar. Se guarda por nivel + entidad, igual que la directiva.
// ----------------------------------------------------------------------

export async function obtenerDisenoDirectiva({ nivel, idEntidad } = {}) {
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
  };
}

export async function guardarDisenoDirectiva({
  nivel,
  idEntidad,
  nombreEntidad = '',
  nodeOffsets = {},
  containerHeightOffset = 0,
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
    fechaActualizacion: serverTimestamp(),
  };

  await writeBatch(FIRESTORE)
    .set(doc(FIRESTORE, COLECCION_DISENOS_DIRECTIVA, idDiseno), diseno, { merge: true })
    .commit();

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
