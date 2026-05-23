import { doc, getDocs, writeBatch, collection, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  DIRECTIVA_LEVELS,
  DIRECTIVA_DIVISIONS,
  CARGOS_DIRECTIVA_BASE,
  DIRECTIVA_DIVISION_NAMES,
} from 'src/catalogs/directiva-positions';

// ----------------------------------------------------------------------

export const COLECCION_CARGOS_DIRECTIVA = 'cargosDirectiva';
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

export const crearIdDirectivaOrganizacional = ({ nivel, idEntidad }) =>
  `${normalizarId(nivel)}_${normalizarId(idEntidad || 'general')}`;

export const crearIdAsignacionDirectiva = ({
  nivel,
  idEntidad,
  idCargo,
  division = null,
  orden = 1,
}) =>
  [
    normalizarId(nivel),
    normalizarId(idEntidad || 'general'),
    normalizarId(idCargo),
    normalizarId(division || 'general'),
    normalizarId(orden || 1),
  ].join('_');

export async function guardarCatalogoCargosDirectiva(cargos = CARGOS_DIRECTIVA_BASE) {
  asegurarFirebaseDirectivas();

  const batch = writeBatch(FIRESTORE);

  cargos.forEach((cargo) => {
    const cargoRef = doc(FIRESTORE, COLECCION_CARGOS_DIRECTIVA, cargo.idCargo);

    batch.set(
      cargoRef,
      {
        ...cargo,
        fechaActualizacion: serverTimestamp(),
        fechaCreacion: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();

  return cargos.length;
}

export async function obtenerCargosDirectiva({
  nivel = '',
  division,
  incluirInactivos = false,
  incluirNoAsignables = true,
} = {}) {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_CARGOS_DIRECTIVA));

  return ordenarCargos(
    snapshot.docs
      .map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }))
      .filter((cargo) => (nivel ? cargo.nivel === nivel : true))
      .filter((cargo) => (division === undefined ? true : cargo.division === division))
      .filter((cargo) => (incluirInactivos ? true : cargo.activo !== false))
      .filter((cargo) => (incluirNoAsignables ? true : cargo.asignable !== false))
  );
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
    nivelOrganizacional: nivel,
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

export async function guardarAsignacionDirectiva({
  nivel,
  idEntidad,
  nombreEntidad = '',
  idCargo,
  nombreCargo = '',
  idMiembro,
  idMiembros,
  codigoMiembro = '',
  nombreMiembro = '',
  division = null,
  orden = 1,
  origen = 'miembro',
  activo = true,
} = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const idMiembroResolved = String(idMiembro || idMiembros || '');
  const idAsignacion = crearIdAsignacionDirectiva({
    nivel,
    idEntidad,
    idCargo,
    division,
    orden,
  });
  const asignacion = {
    idAsignacion,
    idDirectiva,
    nivel,
    nivelOrganizacional: nivel,
    idEntidad: String(idEntidad || ''),
    nombreEntidad: normalizarTexto(nombreEntidad),
    idCargo,
    nombreCargo: normalizarTexto(nombreCargo),
    idMiembro: idMiembroResolved,
    idMiembros: idMiembroResolved,
    codigoMiembro: normalizarTexto(codigoMiembro),
    nombreMiembro: normalizarTexto(nombreMiembro),
    division,
    nombreDivision: division ? NOMBRES_DIVISION[division] || '' : '',
    orden,
    origen,
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
      nivelOrganizacional: nivel,
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

  return asignacion;
}
