import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import {
  CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO,
  COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS,
} from './organigrama-directiva-destacamentos-service';

// ----------------------------------------------------------------------
// Solicitudes de cambio de miembro enviadas por Lider de Grupo / Asistente para
// que el Coordinador de Destacamento (o su asistente) las apruebe, edite o
// rechace campo por campo.

export const COLECCION_SOLICITUDES_CAMBIO_MIEMBRO = 'solicitudes_cambio_miembro';

export const ESTADOS_SOLICITUD_CAMBIO = {
  pendiente: 'pendiente',
  aprobada: 'aprobada',
  parcial: 'parcial',
  rechazada: 'rechazada',
};

// Modulo/pestaña del miembro a la que pertenece la solicitud. Sirve para llevar
// al coordinador a la pestaña correcta (General vs Dispensa Médica) y para
// aplicar el guardado adecuado al aprobar. Las solicitudes antiguas sin este
// campo se tratan como 'general'.
export const MODULOS_SOLICITUD_CAMBIO = {
  general: 'general',
  salud: 'salud',
};

export const getModuloSolicitud = (solicitud = {}) =>
  solicitud?.modulo === MODULOS_SOLICITUD_CAMBIO.salud
    ? MODULOS_SOLICITUD_CAMBIO.salud
    : MODULOS_SOLICITUD_CAMBIO.general;

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para las solicitudes de cambio.');
  }
};

// Firestore no acepta `undefined`. Se limpia en profundidad (arreglos y objetos)
// lo que se envia en cambios / valoresPropuestos / valoresAnteriores.
const removeUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (item !== undefined) {
        acc[key] = removeUndefined(item);
      }

      return acc;
    }, {});
  }

  return value === undefined ? '' : value;
};

// Etiquetas de resultado que ve el solicitante.
export const RESULTADO_SOLICITUD_LABEL = {
  rechazado: 'Rechazado',
  parcial: 'Parcialmente aprobado',
  aprobado_con_cambios: 'Aprobado con cambios',
  aprobado: 'Aprobado',
};

// Clasifica el resultado de una solicitud resuelta a partir de sus campos.
export function clasificarResultadoSolicitud(solicitud = {}) {
  const campos = solicitud.resultadoCampos || [];
  const aprobados = campos.filter((campo) => campo.aprobado);
  const editados = aprobados.filter((campo) => campo.editado);

  if (!aprobados.length) return 'rechazado';
  if (aprobados.length < campos.length) return 'parcial';

  return editados.length ? 'aprobado_con_cambios' : 'aprobado';
}

const mapSolicitud = (documentSnapshot) => ({
  id: documentSnapshot.id,
  ...documentSnapshot.data(),
});

export async function crearSolicitudCambioMiembro(solicitud = {}) {
  asegurarFirebase();

  const cambios = Array.isArray(solicitud.cambios) ? solicitud.cambios : [];

  if (!cambios.length) {
    throw new Error('La solicitud no contiene cambios.');
  }

  const id = solicitud.id || `${solicitud.idMiembros || 'miembro'}_${Date.now()}`;
  const payload = {
    id,
    idMiembros: solicitud.idMiembros ?? null,
    codigoMiembro: solicitud.codigoMiembro ?? '',
    nombreMiembro: solicitud.nombreMiembro ?? '',
    idDestacamento: solicitud.idDestacamento ?? null,
    // 'general' (por defecto) o 'salud'. Ver MODULOS_SOLICITUD_CAMBIO.
    modulo:
      solicitud.modulo === MODULOS_SOLICITUD_CAMBIO.salud
        ? MODULOS_SOLICITUD_CAMBIO.salud
        : MODULOS_SOLICITUD_CAMBIO.general,
    solicitadoPorUid: solicitud.solicitadoPorUid ?? '',
    solicitadoPorNombre: solicitud.solicitadoPorNombre ?? '',
    solicitadoPorRol: solicitud.solicitadoPorRol ?? '',
    estado: ESTADOS_SOLICITUD_CAMBIO.pendiente,
    cambios: removeUndefined(cambios),
    // Snapshot de todos los campos propuestos (contexto de cascada para el
    // dialogo de revision). Ver member-create-edit-form / member-change-request-fields.
    valoresPropuestos: removeUndefined(solicitud.valoresPropuestos ?? {}),
    // Snapshot de los valores anteriores (para reaplicar el "antes" al rechazar
    // un campo, incluso si abarca varias claves, p. ej. estatura + unidad).
    valoresAnteriores: removeUndefined(solicitud.valoresAnteriores ?? {}),
    fechaCreacion: new Date().toISOString(),
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(doc(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_MIEMBRO, String(id)), payload, {
    merge: true,
  });

  return payload;
}

export async function obtenerSolicitudCambioPorId(idSolicitud) {
  asegurarFirebase();

  if (!idSolicitud) return null;

  const snapshot = await getDoc(
    doc(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_MIEMBRO, String(idSolicitud))
  ).catch(() => null);

  return snapshot?.exists() ? mapSolicitud(snapshot) : null;
}

export async function obtenerSolicitudPendientePorMiembro(idMiembros) {
  asegurarFirebase();

  if (idMiembros === null || idMiembros === undefined || idMiembros === '') return null;

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_MIEMBRO),
      where('idMiembros', '==', Number(idMiembros))
    )
  ).catch(() => null);

  if (!snapshot?.docs?.length) return null;

  return (
    snapshot.docs
      .map(mapSolicitud)
      .filter((solicitud) => solicitud.estado === ESTADOS_SOLICITUD_CAMBIO.pendiente)
      .sort((a, b) => String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || '')))[0] ||
    null
  );
}

const chunkArray = (array = [], size = 30) => {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
};

// Destacamentos que el usuario coordina (titular o asistente), a partir de la
// directiva del destacamento. Son los destacamentos cuyas solicitudes puede
// revisar.
export async function obtenerDestacamentosQueCoordina(idMiembros) {
  asegurarFirebase();

  if (idMiembros === null || idMiembros === undefined || idMiembros === '') return [];

  const cargosCoordinacion = [
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento,
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorAsistenteDestacamento,
  ];

  // Un solo filtro de igualdad (evita exigir indice compuesto en Firestore); el
  // cargo se filtra en el cliente.
  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_ORGANIGRAMA_DIRECTIVA_DESTACAMENTOS),
      where('idMiembros', '==', Number(idMiembros))
    )
  ).catch(() => null);

  const destacamentos = (snapshot?.docs || [])
    .map((documentSnapshot) => documentSnapshot.data())
    .filter((data) => cargosCoordinacion.includes(data?.cargo) && data?.activo !== false)
    .map((data) => data?.idDestacamento)
    .filter((value) => value !== null && value !== undefined);

  return Array.from(new Set(destacamentos.map(Number)));
}

// Solicitudes pendientes de los destacamentos indicados (consulta `in` por lotes
// de 30, limite de Firestore).
export async function obtenerSolicitudesPendientesPorDestacamentos(idsDestacamentos = []) {
  asegurarFirebase();

  const ids = Array.from(new Set((idsDestacamentos || []).map(Number))).filter((value) =>
    Number.isFinite(value)
  );

  if (!ids.length) return [];

  // Un solo filtro (`in` por lotes de 30); el estado pendiente se filtra en el
  // cliente para no requerir indice compuesto.
  const lotes = chunkArray(ids, 30);
  const snapshots = await Promise.all(
    lotes.map((lote) =>
      getDocs(
        query(
          collection(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_MIEMBRO),
          where('idDestacamento', 'in', lote)
        )
      ).catch(() => ({ docs: [] }))
    )
  );

  return snapshots
    .flatMap((snapshot) => snapshot.docs.map(mapSolicitud))
    .filter((solicitud) => solicitud.estado === ESTADOS_SOLICITUD_CAMBIO.pendiente)
    .sort((a, b) => String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || '')));
}

// Solicitudes pendientes que el usuario (por su idMiembros) puede revisar.
export async function obtenerSolicitudesPendientesParaCoordinador(idMiembros) {
  const destacamentos = await obtenerDestacamentosQueCoordina(idMiembros);

  return obtenerSolicitudesPendientesPorDestacamentos(destacamentos);
}

// Marca la solicitud como resuelta. `resultadoCampos` describe que paso con cada
// campo (aprobado/editado/rechazado) para poder mostrarlo en el historial y
// notificar al solicitante.
export async function resolverSolicitudCambioMiembro(
  idSolicitud,
  { estado, resultadoCampos = [], resueltoPorUid = '', resueltoPorNombre = '' } = {}
) {
  asegurarFirebase();

  if (!idSolicitud) {
    throw new Error('idSolicitud es requerido para resolver la solicitud.');
  }

  await updateDoc(doc(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_MIEMBRO, String(idSolicitud)), {
    estado: estado || ESTADOS_SOLICITUD_CAMBIO.aprobada,
    resultadoCampos,
    resueltoPorUid,
    resueltoPorNombre,
    fechaResolucion: new Date().toISOString(),
    actualizadoEnServidor: serverTimestamp(),
  });
}
