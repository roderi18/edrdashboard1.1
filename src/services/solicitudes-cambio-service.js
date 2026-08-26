import { doc, query, where, setDoc, getDoc, getDocs, updateDoc, collection } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { registrarAuditoriaSistema } from './audit-log-service';
import { crearNotificacionUsuario } from './notification-service';
import { notificarCambioPropuesto } from './notificar-oficina-nacional-service';

// ----------------------------------------------------------------------
// PUERTA UNICA de cambios.
//
// Todo cambio y toda sugerencia —de cualquier persona, sobre cualquier cosa:
// destacamentos, secciones, regiones, sus directivas y la tienda— entra por
// aqui. No es una via mas comoda: es la unica, y su razon de ser es que NADA se
// mueva sin quedar registrado en Historial.
//
// El registro en auditoria se hace ANTES de tocar nada y de forma bloqueante. Si
// no se puede registrar, el cambio no se aplica: se prefiere no hacerlo a
// hacerlo a escondidas.
//
// Segun el ambito, la peticion sigue uno de dos caminos:
//
//   - APROBACION: los cambios sobre destacamento, seccion y region (la entidad,
//     no su gente) y sobre las directivas de seccion, region y consejo nacional
//     quedan PENDIENTES. Solo la Oficina Nacional los aprueba o los rechaza.
//   - DIRECTO: el resto se aplica en el momento, pero igualmente registrado.
//
// La directiva de DESTACAMENTO queda fuera de la aprobacion a proposito: la
// gestiona su Coordinador, como hasta ahora.
// ----------------------------------------------------------------------

export const COLECCION_SOLICITUDES_CAMBIO = 'solicitudes_cambio';

export const AMBITOS_CAMBIO = {
  destacamento: 'destacamento',
  // La FOTO del destacamento va aparte de su ficha: la puede sugerir el
  // Coordinador de Destacamento aunque el resto de la ficha no la toque.
  fotoDestacamento: 'foto_destacamento',
  seccion: 'seccion',
  region: 'region',
  directivaSeccion: 'directiva_seccion',
  directivaRegion: 'directiva_region',
  directivaNacional: 'directiva_nacional',
  directivaDestacamento: 'directiva_destacamento',
  tienda: 'tienda',
  miembro: 'miembro',
  // Sistema de Ascenso y Academia Ministerial: no van a aprobacion de la Oficina
  // Nacional —los lleva el destacamento—, pero cada movimiento queda en
  // Historial, que es lo que se pidio.
  sistemaAscenso: 'sistema_ascenso',
  academiaMinisterial: 'academia_ministerial',
  // El catalogo de lo que puede hacer cada combinacion de cargos. Solo lo toca
  // el Administrador Global, asi que no espera aprobacion de nadie, pero cada
  // ajuste queda en Historial: es lo que decide quien puede que.
  combinacionesRoles: 'combinaciones_roles',
};

// Ambitos cuya modificacion aprueba UNICAMENTE la Oficina Nacional.
export const AMBITOS_QUE_APRUEBA_OFICINA_NACIONAL = [
  AMBITOS_CAMBIO.destacamento,
  AMBITOS_CAMBIO.fotoDestacamento,
  AMBITOS_CAMBIO.seccion,
  AMBITOS_CAMBIO.region,
  AMBITOS_CAMBIO.directivaSeccion,
  AMBITOS_CAMBIO.directivaRegion,
  AMBITOS_CAMBIO.directivaNacional,
];

export const ESTADOS_CAMBIO = {
  pendiente: 'pendiente',
  aprobada: 'aprobada',
  rechazada: 'rechazada',
  aplicada: 'aplicada',
};

export const requiereAprobacionDeOficinaNacional = (ambito) =>
  AMBITOS_QUE_APRUEBA_OFICINA_NACIONAL.includes(String(ambito || '').trim());

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado: no se puede registrar el cambio.');
  }
};

const describirActor = (usuario = {}) =>
  usuario?.displayName ||
  [usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ').trim() ||
  usuario?.nombre ||
  usuario?.correo ||
  usuario?.email ||
  'Usuario sin identificar';

/**
 * Deja constancia en Historial. Bloqueante y sin `catch` que lo silencie: si
 * falla, la operacion entera falla.
 */
const registrarEnHistorial = async ({
  ambito,
  accion,
  descripcion,
  entidad,
  antes,
  despues,
  usuario,
  metadatos,
}) => {
  const registro = await registrarAuditoriaSistema({
    modulo: ambito,
    accion,
    descripcion,
    severidad: 'importante',
    entidad,
    antes,
    despues,
    realizadoPor: usuario,
    origen: 'puerta_de_cambios',
    metadatos,
  });

  if (!registro) {
    throw new Error('No se pudo registrar el cambio en Historial: la operación se cancela.');
  }

  return registro;
};

/**
 * Propone un cambio. Es el UNICO camino para modificar o sugerir algo.
 *
 * @param {string} ambito        Uno de AMBITOS_CAMBIO.
 * @param {object} entidad       { tipo, id, nombre, ruta }.
 * @param {array}  cambios       [{ campo, etiqueta, antes, despues }].
 * @param {object} usuario       Quien lo propone.
 * @param {function} aplicar     Escritura real. Se ejecuta ahora si el ambito no
 *                               necesita aprobacion; si la necesita, se guarda la
 *                               propuesta y se ejecutara al aprobarla.
 * @param {boolean} esSugerencia Una sugerencia nunca se aplica sola.
 *
 * @returns {{ estado: string, idSolicitud: string|null, idAuditoria: string }}
 */
export async function proponerCambio({
  ambito,
  entidad = {},
  cambios = [],
  usuario = {},
  aplicar = null,
  esSugerencia = false,
  descripcion = '',
  aplicarDirecto = false,
  payload = null,
} = {}) {
  asegurarFirebase();

  if (!ambito) {
    throw new Error('Todo cambio necesita un ámbito: no se puede registrar de otro modo.');
  }

  // `aplicarDirecto` lo pone quien llama para el Administrador Global y para la
  // propia Oficina Nacional: no tiene sentido que esperen una aprobacion que se
  // darian a si mismos, y sin esta salida un cambio suyo se quedaria pendiente
  // para siempre si no hay nadie mas con el rol. Salta la aprobacion, NO el
  // registro: su cambio queda en Historial igual que cualquier otro.
  //
  // Una sugerencia nunca se aplica sola, ni siquiera con este permiso.
  const necesitaAprobacion =
    esSugerencia || (requiereAprobacionDeOficinaNacional(ambito) && !aplicarDirecto);
  const actor = describirActor(usuario);
  const textoEntidad = entidad?.nombre ? ` ${entidad.nombre}` : '';
  const detalle =
    descripcion ||
    (esSugerencia
      ? `${actor} sugirió cambios en ${ambito}${textoEntidad}.`
      : `${actor} propuso cambios en ${ambito}${textoEntidad}.`);

  const auditoria = await registrarEnHistorial({
    ambito,
    accion: necesitaAprobacion ? 'cambio_propuesto' : 'cambio_aplicado',
    descripcion: detalle,
    entidad,
    antes: cambios.length ? Object.fromEntries(cambios.map((c) => [c.campo, c.antes])) : null,
    despues: cambios.length ? Object.fromEntries(cambios.map((c) => [c.campo, c.despues])) : null,
    usuario,
    metadatos: { ambito, esSugerencia, requiereAprobacion: necesitaAprobacion },
  });

  if (!necesitaAprobacion) {
    if (typeof aplicar === 'function') {
      await aplicar();
    }

    return { estado: ESTADOS_CAMBIO.aplicada, idSolicitud: null, idAuditoria: auditoria.id };
  }

  const solicitudRef = doc(collection(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO));

  await setDoc(solicitudRef, {
    id: solicitudRef.id,
    ambito,
    entidad: {
      tipo: entidad?.tipo ?? ambito,
      id: entidad?.id != null ? String(entidad.id) : null,
      nombre: entidad?.nombre ?? '',
      ruta: entidad?.ruta ?? '',
    },
    cambios,
    // Los datos con los que se escribira SI se aprueba. La funcion `aplicar` no
    // se puede guardar —es codigo—, asi que sin esto la propuesta describiria el
    // cambio sin poder llevarlo a cabo despues.
    payload,
    esSugerencia,
    estado: ESTADOS_CAMBIO.pendiente,
    idAuditoria: auditoria.id,
    solicitadoPorUid: usuario?.uid || usuario?.id || '',
    solicitadoPorNombre: actor,
    solicitadoPorRol: usuario?.rolId || usuario?.memberRole || usuario?.rol || '',
    creadoEn: new Date().toISOString(),
    resueltoEn: null,
    resueltoPorUid: '',
    resueltoPorNombre: '',
    comentarioResolucion: '',
  });

  // El aviso va DESPUES de guardar y sin bloquear: la propuesta ya esta a salvo
  // y en Historial. Que falle el correo o la notificacion no puede tumbar un
  // cambio que ya se registro.
  const solicitudGuardada = await obtenerSolicitudCambio(solicitudRef.id);

  notificarCambioPropuesto({ solicitud: solicitudGuardada, usuario }).catch((error) => {
    console.warn('[puerta de cambios] no se pudo avisar a la Oficina Nacional', error);
  });

  return { estado: ESTADOS_CAMBIO.pendiente, idSolicitud: solicitudRef.id, idAuditoria: auditoria.id };
}

export async function obtenerSolicitudesCambio({ estado = ESTADOS_CAMBIO.pendiente } = {}) {
  asegurarFirebase();

  const solicitudesRef = collection(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO);
  const snapshot = await getDocs(
    estado ? query(solicitudesRef, where('estado', '==', estado)) : solicitudesRef
  );

  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

export async function obtenerSolicitudCambio(idSolicitud) {
  asegurarFirebase();

  const snapshot = await getDoc(doc(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO, String(idSolicitud)));

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/**
 * Resuelve una propuesta. Reservado a la Oficina Nacional y al Administrador
 * Global; el permiso lo comprueba quien llama, y la resolucion queda en
 * Historial igual que la propuesta.
 */
export async function resolverSolicitudCambio(
  idSolicitud,
  { estado, usuario = {}, comentario = '', aplicar = null } = {}
) {
  asegurarFirebase();

  if (![ESTADOS_CAMBIO.aprobada, ESTADOS_CAMBIO.rechazada].includes(estado)) {
    throw new Error('Una solicitud solo se puede aprobar o rechazar.');
  }

  const solicitud = await obtenerSolicitudCambio(idSolicitud);

  if (!solicitud) {
    throw new Error('La solicitud ya no existe.');
  }

  if (solicitud.estado !== ESTADOS_CAMBIO.pendiente) {
    throw new Error('Esa solicitud ya fue resuelta.');
  }

  const actor = describirActor(usuario);

  await registrarEnHistorial({
    ambito: solicitud.ambito,
    accion: estado === ESTADOS_CAMBIO.aprobada ? 'cambio_aprobado' : 'cambio_rechazado',
    descripcion: `${actor} ${estado === ESTADOS_CAMBIO.aprobada ? 'aprobó' : 'rechazó'} los cambios propuestos por ${solicitud.solicitadoPorNombre}.`,
    entidad: solicitud.entidad,
    antes: null,
    despues: null,
    usuario,
    metadatos: { idSolicitud: solicitud.id, comentario, idAuditoriaPropuesta: solicitud.idAuditoria },
  });

  if (estado === ESTADOS_CAMBIO.aprobada && typeof aplicar === 'function') {
    await aplicar(solicitud);
  }

  await updateDoc(doc(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO, String(idSolicitud)), {
    estado,
    resueltoEn: new Date().toISOString(),
    resueltoPorUid: usuario?.uid || usuario?.id || '',
    resueltoPorNombre: actor,
    comentarioResolucion: comentario,
  });

  // Quien lo propuso se entera. Sin esto, mandaba su cambio y no volvia a saber
  // nada: ni que se aplico ni por que no. Que el aviso falle no invalida una
  // resolucion que ya quedo escrita, asi que va por detras.
  notificarResolucionAlSolicitante({ solicitud, estado, comentario, actor, usuario }).catch(
    (error) => {
      console.warn('[cambios] no se pudo avisar al solicitante', error);
    }
  );

  return { ...solicitud, estado };
}

// ----------------------------------------------------------------------

const notificarResolucionAlSolicitante = async ({
  solicitud = {},
  estado,
  comentario = '',
  actor = '',
  usuario = {},
} = {}) => {
  const destinatario = String(solicitud?.solicitadoPorUid || '').trim();
  const resolvioElMismo = destinatario && destinatario === String(usuario?.uid || usuario?.id || '');

  // Sin quien lo propuso —propuestas viejas sin uid— no hay a quien avisar, y a
  // quien resuelve su propia solicitud no hay nada que contarle.
  if (!destinatario || resolvioElMismo) return null;

  const aprobada = estado === ESTADOS_CAMBIO.aprobada;
  const que = solicitud?.entidad?.nombre || 'la organización';
  const quien = actor || 'La Oficina Nacional';
  const motivo = String(comentario || '').trim();

  return crearNotificacionUsuario({
    tipoNotificacion: aprobada ? 'cambio_aprobado' : 'cambio_rechazado',
    modulo: 'aprobaciones',
    titulo: aprobada ? 'Cambio aprobado' : 'Cambio rechazado',
    mensaje: aprobada
      ? `${quien} aprobó tus cambios en ${que}. Ya están aplicados.`
      : `${quien} rechazó tus cambios en ${que}.${motivo ? ` Motivo: ${motivo}` : ''}`,
    prioridad: aprobada ? 'informativa' : 'importante',
    actorNombre: quien,
    entidadTipo: solicitud?.entidad?.tipo || 'solicitud_cambio',
    entidadId: String(solicitud?.id || ''),
    ruta: solicitud?.entidad?.ruta || '/dashboard',
    etiquetaAccion: 'Ver',
    metadatos: { idSolicitud: solicitud?.id, ambito: solicitud?.ambito, comentario: motivo },
    idsDestinatarios: [destinatario],
  });
};
