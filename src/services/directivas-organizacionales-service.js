import { doc, getDocs, writeBatch, collection, serverTimestamp } from 'firebase/firestore';

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
  const nombreCargo = apiCargo?.nombre || localPosition?.nombreCargo || '';
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

export const crearIdAsignacionDirectiva = ({
  nivel,
  idEntidad,
  idCargo,
  idMiembro,
  idPosicionDirectiva = '',
  division = null,
  orden = 1,
}) =>
  [
    normalizarId(nivel),
    normalizarId(idEntidad || 'general'),
    normalizarId(idMiembro || 'miembro'),
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
        const apiCargo = position.idCargo
          ? apiCargoMap.get(String(position.idCargo))
          : apiCargoNameMap.get(normalizarClaveTexto(localPosition?.nombreCargo));

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

export async function obtenerAsignacionesDirectiva({
  nivel,
  idEntidad,
  incluirInactivas = false,
} = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA));

  return snapshot.docs
    .map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    .filter((asignacion) => asignacion.idDirectiva === idDirectiva)
    .filter((asignacion) => (incluirInactivas ? true : asignacion.activo !== false));
}

export async function obtenerAsignacionesDirectivaPorMiembro({
  idMiembro,
  incluirInactivas = false,
} = {}) {
  asegurarFirebaseDirectivas();

  if (!idMiembro) {
    return [];
  }

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA));

  return snapshot.docs
    .map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    .filter((asignacion) => String(asignacion.idMiembro) === String(idMiembro))
    .filter((asignacion) => (incluirInactivas ? true : asignacion.activo !== false));
}

export async function obtenerAsignacionesDirectivaMiembros({ incluirInactivas = false } = {}) {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA));

  return snapshot.docs
    .map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    .filter((asignacion) => asignacion.idMiembro)
    .filter((asignacion) => (incluirInactivas ? true : asignacion.activo !== false));
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
} = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const idMiembroResolved = String(idMiembro || idMiembros || '');
  const idAsignacion = crearIdAsignacionDirectiva({
    nivel,
    idEntidad,
    idCargo,
    idMiembro: idMiembroResolved,
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
    fechaActualizacion: serverTimestamp(),
    fechaCreacion: serverTimestamp(),
  };
  const batch = writeBatch(FIRESTORE);

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

  return asignacion;
}
