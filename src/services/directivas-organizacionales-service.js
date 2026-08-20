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

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { obtenerCargosApi } from 'src/services/cargos-api-service';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import {
  DIRECTIVA_LEVELS,
  DIRECTIVA_DIVISIONS,
  CARGOS_DIRECTIVA_BASE,
  DIRECTIVA_DIVISION_NAMES,
} from 'src/catalogs/directiva-positions';

// ----------------------------------------------------------------------

export const COLECCION_POSICIONES_DIRECTIVA = 'posicionesDirectiva';
export const COLECCION_CARGOS_DIRECTIVA_OBSOLETA = 'cargosDirectiva';
export const COLECCION_DIRECTIVAS_ORGANIZACIONALES = 'directivasOrganizacionales';
export const COLECCION_ASIGNACIONES_DIRECTIVA = 'asignacionesDirectiva';
export const COLECCION_DISENOS_DIRECTIVA = 'disenosDirectiva';

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
    nombreMiembro: normalizarTexto(nombreMiembro),
    codigoMiembro: normalizarTexto(codigoMiembro),
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

  await batch.commit();

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'asignacion_directiva_guardada',
    descripcion: `Se asignó un cargo de directiva al miembro ${idMiembroResolved}.`,
    entidad: {
      tipo: 'asignacion_directiva',
      id: idAsignacion,
      nombre: idMiembroResolved,
      ruta: `/dashboard/level/member/${idMiembroResolved}/edit`,
    },
    despues: asignacion,
    realizadoPor: usuario,
    origen: 'directivas',
  });

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
