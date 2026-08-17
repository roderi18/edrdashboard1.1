import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS =
  'organigrama_directiva_destacamentos';

export const CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO = {
  pastor: 'pastor',
  coordinadorDestacamento: 'coordinador_destacamento',
  coordinadorAsistenteDestacamento: 'coordinador_asistente_destacamento',
  consejoDestacamento: 'consejo_destacamento',
  capellan: 'capellan',
  liderGrupo: 'lider_grupo',
  liderAsistenteGrupo: 'lider_asistente_grupo',
};

export const DIVISIONES_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO = {
  navegantes: 'navegantes',
  pioneros: 'pioneros',
  seguidores: 'seguidores',
  exploradores: 'exploradores',
};

const CARGOS_VALIDOS = Object.values(CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO);
const DIVISIONES_VALIDAS = Object.values(DIVISIONES_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO);

const asegurarFirebaseOrganigrama = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para el organigrama de directiva.');
  }
};

const normalizarNumero = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
};

const normalizarTexto = (value) => String(value ?? '').trim();

const normalizarCargo = (cargo) => {
  const cargoNormalizado = normalizarTexto(cargo);

  if (!CARGOS_VALIDOS.includes(cargoNormalizado)) {
    throw new Error(`Cargo de organigrama invalido: ${cargoNormalizado || 'vacio'}.`);
  }

  return cargoNormalizado;
};

const normalizarDivision = (division) => {
  const divisionNormalizada = normalizarTexto(division);

  if (!divisionNormalizada) {
    return null;
  }

  if (!DIVISIONES_VALIDAS.includes(divisionNormalizada)) {
    throw new Error(`Division de organigrama invalida: ${divisionNormalizada}.`);
  }

  return divisionNormalizada;
};

export const crearIdAsignacionOrganigrama = ({ idDestacamento, cargo, division = null, orden = 1 }) =>
  [
    normalizarNumero(idDestacamento),
    normalizarCargo(cargo),
    normalizarDivision(division) || 'general',
    normalizarNumero(orden) || 1,
  ].join('_');

export const normalizarAsignacionOrganigrama = (asignacion = {}) => {
  const idDestacamento = normalizarNumero(asignacion.idDestacamento);
  const idMiembros = normalizarNumero(asignacion.idMiembros);
  const cargo = normalizarCargo(asignacion.cargo);
  const division = normalizarDivision(asignacion.division);
  const orden = normalizarNumero(asignacion.orden) || 1;

  if (!idDestacamento) {
    throw new Error('idDestacamento es requerido para la asignacion del organigrama.');
  }

  if (!idMiembros) {
    throw new Error('idMiembros es requerido para la asignacion del organigrama.');
  }

  return {
    idDestacamento,
    idMiembros,
    cargo,
    division,
    orden,
    activo: asignacion.activo !== false,
    // Copia del ocupante: si el miembro no viene en el listado que carga el
    // organigrama, el nodo se pintaba vacio aunque la asignacion existiera.
    nombreMiembro: String(asignacion.nombreMiembro || '').trim(),
    codigoMiembro: String(asignacion.codigoMiembro || '').trim(),
    fotoMiembro: String(asignacion.fotoMiembro || '').trim(),
  };
};

const ordenarAsignaciones = (asignaciones) =>
  [...asignaciones].sort((a, b) => {
    const cargoCompare = String(a.cargo).localeCompare(String(b.cargo));

    if (cargoCompare !== 0) {
      return cargoCompare;
    }

    const divisionCompare = String(a.division || '').localeCompare(String(b.division || ''));

    if (divisionCompare !== 0) {
      return divisionCompare;
    }

    return Number(a.orden || 0) - Number(b.orden || 0);
  });

export async function obtenerAsignacionesOrganigramaDirectivaDestacamentos() {
  asegurarFirebaseOrganigrama();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS));

  return ordenarAsignaciones(
    snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
  );
}

export async function obtenerAsignacionesOrganigramaPorDestacamento(idDestacamento) {
  asegurarFirebaseOrganigrama();

  const normalizedDestId = normalizarNumero(idDestacamento);

  if (!normalizedDestId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS),
      where('idDestacamento', '==', normalizedDestId)
    )
  );

  return ordenarAsignaciones(
    snapshot.docs
      .map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }))
      .filter((asignacion) => asignacion.activo === true)
  );
}

export async function guardarAsignacionOrganigramaDirectivaDestacamento(asignacion) {
  asegurarFirebaseOrganigrama();

  const asignacionNormalizada = normalizarAsignacionOrganigrama(asignacion);
  const idAsignacion =
    asignacion.id ||
    crearIdAsignacionOrganigrama({
      idDestacamento: asignacionNormalizada.idDestacamento,
      cargo: asignacionNormalizada.cargo,
      division: asignacionNormalizada.division,
      orden: asignacionNormalizada.orden,
    });
  const asignacionRef = doc(
    FIRESTORE,
    COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS,
    String(idAsignacion)
  );
  const asignacionSnapshot = await getDoc(asignacionRef);
  const fechaCreacion = asignacionSnapshot.exists()
    ? asignacionSnapshot.data().fechaCreacion
    : serverTimestamp();

  await setDoc(
    asignacionRef,
    {
      ...asignacionNormalizada,
      fechaActualizacion: serverTimestamp(),
      fechaCreacion: asignacion.fechaCreacion || fechaCreacion,
    },
    { merge: true }
  );

  return {
    id: asignacionRef.id,
    ...asignacionNormalizada,
  };
}

export async function guardarAsignacionesOrganigramaDirectivaDestacamento(asignaciones = []) {
  asegurarFirebaseOrganigrama();

  return Promise.all(asignaciones.map(guardarAsignacionOrganigramaDirectivaDestacamento));
}

export async function desactivarAsignacionOrganigramaDirectivaDestacamento(idAsignacion) {
  asegurarFirebaseOrganigrama();

  if (!idAsignacion) {
    throw new Error('idAsignacion es requerido para desactivar la asignacion.');
  }

  await updateDoc(
    doc(FIRESTORE, COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS, String(idAsignacion)),
    {
      activo: false,
      fechaActualizacion: serverTimestamp(),
    }
  );
}

export async function eliminarAsignacionOrganigramaDirectivaDestacamento(idAsignacion) {
  asegurarFirebaseOrganigrama();

  if (!idAsignacion) {
    throw new Error('idAsignacion es requerido para eliminar la asignacion.');
  }

  await deleteDoc(
    doc(FIRESTORE, COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS, String(idAsignacion))
  );
}
