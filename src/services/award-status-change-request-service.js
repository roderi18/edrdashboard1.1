import { ref, deleteObject } from 'firebase/storage';
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

import { paths } from 'src/routes/paths';

import { getMemberById } from 'src/services/member-service';
import { crearNotificacionAdmin } from 'src/services/notification-service';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';
import { registrarCambiosHistorialMiembro } from 'src/services/member-history-service';
import {
  getProgressId,
  sincronizarProgresoAscensoFirebase,
  COLECCION_PROGRESO_ASCENSO_MIEMBROS,
} from 'src/services/member-awards-service';
import {
  resolverDestinatariosPorIdMiembros,
  notificarCambioEstadoSistemaAscenso,
} from 'src/services/solicitudes-cambio-notificaciones-service';
import {
  CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO,
  obtenerAsignacionesOrganigramaPorDestacamento,
} from 'src/services/organigrama-directiva-destacamentos-service';

export const COLECCION_SOLICITUDES_CAMBIO_ESTADO_ASCENSO =
  'solicitudes_cambio_estado_ascenso';

const STATUS_LABELS = {
  no_iniciado: 'No iniciado',
  en_progreso: 'En progreso',
  completado: 'Completado',
};

const ensureFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado para solicitudes del Sistema de Ascenso.');
  }
};

const getUserName = (user = {}) =>
  user.displayName ||
  user.nombre ||
  [user.nombres || user.firstName, user.apellidos || user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  user.email ||
  'Usuario';

const getMemberName = (member = {}) =>
  [member.firstName || member.nombres, member.lastName || member.apellidos]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  member.name ||
  member.memberId ||
  member.codigoMiembro ||
  'Miembro';

const getCoordinators = async (idDestacamento) => {
  const assignments = await obtenerAsignacionesOrganigramaPorDestacamento(idDestacamento);
  const roles = [
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento,
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorAsistenteDestacamento,
  ];
  return assignments.filter((item) => roles.includes(item.cargo) && item.activo !== false);
};

const mapSnapshot = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

export async function crearSolicitudCambioEstadoAscenso({
  memberId,
  context = {},
  metadata = {},
  nextStatus,
  nextTimesCompleted = 0,
  user = {},
}) {
  ensureFirebase();
  if (!memberId || !context.rowId || !nextStatus || nextStatus === 'completado') {
    throw new Error('La solicitud de cambio de estado no es válida.');
  }

  const member = await getMemberById(memberId).catch(() => null);
  const finalMemberId = String(member?.id || member?.idMiembros || memberId);
  const idDestacamento = Number(member?.destId || member?.idDestacamento) || null;
  if (!member || !idDestacamento) {
    throw new Error('No se pudo identificar el destacamento del miembro.');
  }

  const progressId = getProgressId(finalMemberId, context.rowId);
  const progressSnapshot = await getDoc(
    doc(FIRESTORE, COLECCION_PROGRESO_ASCENSO_MIEMBROS, progressId)
  );
  const progress = progressSnapshot.exists() ? progressSnapshot.data() : null;
  if (!progress || progress.estado !== 'completado') {
    throw new Error('El registro ya no se encuentra en estado Completado.');
  }

  const requesterUid = String(user.uid || user.id || '');
  const existingSnapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_ESTADO_ASCENSO),
      where('progressId', '==', progressId)
    )
  );
  const existing = existingSnapshot.docs
    .map(mapSnapshot)
    .find((item) => item.estado === 'pendiente');
  if (existing) return existing;

  const requestRef = doc(collection(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_ESTADO_ASCENSO));
  const now = new Date().toISOString();
  const memberCode = member.memberId || member.codigoMiembro || '';
  const payload = {
    id: requestRef.id,
    progressId,
    idMiembro: finalMemberId,
    codigoMiembro: memberCode,
    nombreMiembro: getMemberName(member),
    idDestacamento,
    sistema: 'sistemaAscenso',
    sectionId: context.sectionId || '',
    parentId: context.parentId || '',
    rowId: context.rowId,
    nombreItemAscenso: metadata.nombreItemAscenso || metadata.nombre || context.rowId,
    estadoAnterior: 'completado',
    estadoSolicitado: nextStatus,
    vecesCompletadoSolicitadas: Number(nextTimesCompleted || 0),
    tieneDocumentoAnexo: Boolean(progress.idCertificadoActual || progress.certificadoActual),
    certificado: progress.certificadoActual || null,
    idCertificado: progress.idCertificadoActual || '',
    solicitadoPorUid: requesterUid,
    solicitadoPorIdMiembros: Number(user.idMiembros || user.memberId) || null,
    solicitadoPorNombre: getUserName(user),
    estado: 'pendiente',
    fechaCreacion: now,
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(requestRef, payload);
  await registrarAuditoriaSilenciosa({
    modulo: 'sistema_ascenso',
    accion: 'solicitud_cambio_estado_creada',
    descripcion: `${payload.solicitadoPorNombre} solicitó cambiar "${payload.nombreItemAscenso}" de Completado a ${STATUS_LABELS[nextStatus] || nextStatus}.`,
    entidad: { tipo: 'miembro', id: finalMemberId, nombre: payload.nombreMiembro },
    realizadoPor: user,
    origen: 'award-status-change-request-service',
    metadatos: { idSolicitud: payload.id, progressId, tieneDocumentoAnexo: payload.tieneDocumentoAnexo },
  });

  const segment = encodeURIComponent(String(memberCode || finalMemberId));
  const baseRoute = paths.dashboard.level.member.editAwards(segment);
  const route = `${baseRoute}?folder=${encodeURIComponent(context.parentId || '')}&solicitudEstadoAscenso=${payload.id}`;
  const coordinators = await getCoordinators(idDestacamento);
  await Promise.all(
    coordinators.map(async (coordinator) => {
      const recipientIds = await resolverDestinatariosPorIdMiembros(coordinator.idMiembros);
      if (!recipientIds.length) return null;
      return crearNotificacionAdmin({
        tipoNotificacion: 'solicitud_cambio_estado_ascenso',
        modulo: 'miembros',
        titulo: 'Solicitud de cambio en Sistema de Ascenso',
        mensaje: `${payload.solicitadoPorNombre} solicita cambiar "${payload.nombreItemAscenso}" de Completado a ${STATUS_LABELS[nextStatus] || nextStatus}.`,
        prioridad: 'importante',
        entidadTipo: 'miembro',
        entidadId: finalMemberId,
        ruta: route,
        etiquetaAccion: 'Revisar solicitud',
        actorId: requesterUid || 'sistema',
        actorNombre: payload.solicitadoPorNombre,
        idsDestinatariosPrecalculados: recipientIds,
        metadatos: { idSolicitudEstadoAscenso: payload.id },
      }).catch(() => null);
    })
  );

  return payload;
}

export async function obtenerSolicitudCambioEstadoAscenso(idSolicitud) {
  ensureFirebase();
  if (!idSolicitud) return null;
  const snapshot = await getDoc(
    doc(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_ESTADO_ASCENSO, String(idSolicitud))
  );
  return snapshot.exists() ? mapSnapshot(snapshot) : null;
}

export async function resolverSolicitudCambioEstadoAscenso({
  idSolicitud,
  decision,
  user = {},
}) {
  ensureFirebase();
  const request = await obtenerSolicitudCambioEstadoAscenso(idSolicitud);
  if (!request || request.estado !== 'pendiente') {
    throw new Error('La solicitud ya no está pendiente.');
  }

  const coordinators = await getCoordinators(request.idDestacamento);
  const actorMemberId = Number(user.idMiembros || user.memberId) || null;
  if (!coordinators.some((item) => Number(item.idMiembros) === actorMemberId)) {
    throw new Error('No tienes autorización para resolver esta solicitud.');
  }

  const approved = decision === 'aprobar';
  const resolutionDate = new Date().toISOString();
  if (approved) {
    const progressRef = doc(
      FIRESTORE,
      COLECCION_PROGRESO_ASCENSO_MIEMBROS,
      request.progressId
    );
    const progressSnapshot = await getDoc(progressRef);
    const progress = progressSnapshot.exists() ? progressSnapshot.data() : null;
    if (!progress || progress.estado !== 'completado') {
      throw new Error('El estado cambió y la solicitud ya no puede aplicarse.');
    }

    const certificate = progress.certificadoActual || request.certificado || {};
    const certificatePath = certificate.rutaPdf || certificate.pdfPath || '';
    const certificateId = progress.idCertificadoActual || request.idCertificado || '';
    const updatedProgress = {
      ...progress,
      estado: request.estadoSolicitado,
      fechaCompletado: null,
      vecesCompletado: Number(request.vecesCompletadoSolicitadas || 0),
      idCertificadoActual: '',
      idsCertificados: (progress.idsCertificados || []).filter(
        (id) => String(id) !== String(certificateId)
      ),
      certificadoActual: null,
      actualizadoEn: resolutionDate,
      actualizadoPor: {
        uid: user.uid || user.id || '',
        nombre: getUserName(user),
        correo: user.email || '',
      },
    };
    await updateDoc(progressRef, {
      ...updatedProgress,
      actualizadoEnServidor: serverTimestamp(),
    });

    if (certificateId) {
      await deleteDoc(doc(FIRESTORE, 'certificados', String(certificateId))).catch(() => null);
    }
    if (certificatePath && FIREBASE_STORAGE) {
      await deleteObject(ref(FIREBASE_STORAGE, certificatePath)).catch(() => null);
    }

    registrarCambiosHistorialMiembro({
      idMiembro: request.idMiembro,
      codigoMiembro: request.codigoMiembro,
      nombreMiembro: request.nombreMiembro,
      modulo: 'Sistema de Ascenso',
      antes: progress,
      despues: updatedProgress,
      campos: {
        estado: 'Estado',
        fechaCompletado: 'Fecha completado',
        vecesCompletado: 'Veces completado',
        idCertificadoActual: 'Certificado actual',
      },
      usuario: user,
      metadata: {
        origen: 'award-status-change-request-service',
        idSolicitud,
        idItemAscenso: request.rowId,
      },
    }).catch(() => null);
    await sincronizarProgresoAscensoFirebase(request.idMiembro);

    notificarCambioEstadoSistemaAscenso({
      member: {
        id: request.idMiembro,
        idMiembros: request.idMiembro,
        memberId: request.codigoMiembro,
        nombreMiembro: request.nombreMiembro,
        idDestacamento: request.idDestacamento,
      },
      actorId: user.uid || user.id || 'sistema',
      actorNombre: getUserName(user),
      itemNombre: request.nombreItemAscenso,
      estadoAnterior: request.estadoAnterior,
      estadoNuevo: request.estadoSolicitado,
      ruta: paths.dashboard.level.member.editAwards(
        encodeURIComponent(String(request.codigoMiembro || request.idMiembro))
      ),
    }).catch(() => null);
  }

  const resolution = {
    estado: approved ? 'aprobada' : 'rechazada',
    fechaResolucion: resolutionDate,
    resueltoPorUid: String(user.uid || user.id || ''),
    resueltoPorNombre: getUserName(user),
    actualizadoEnServidor: serverTimestamp(),
  };
  await setDoc(
    doc(FIRESTORE, COLECCION_SOLICITUDES_CAMBIO_ESTADO_ASCENSO, String(idSolicitud)),
    resolution,
    { merge: true }
  );

  await registrarAuditoriaSilenciosa({
    modulo: 'sistema_ascenso',
    accion: approved ? 'solicitud_cambio_estado_aprobada' : 'solicitud_cambio_estado_rechazada',
    descripcion: `${resolution.resueltoPorNombre} ${approved ? 'aprobó' : 'rechazó'} el cambio de estado de "${request.nombreItemAscenso}".`,
    entidad: { tipo: 'miembro', id: request.idMiembro, nombre: request.nombreMiembro },
    realizadoPor: user,
    origen: 'award-status-change-request-service',
    metadatos: { idSolicitud, progressId: request.progressId, documentoEliminado: approved && request.tieneDocumentoAnexo },
  });

  await crearNotificacionAdmin({
    tipoNotificacion: 'resultado_cambio_estado_ascenso',
    modulo: 'miembros',
    titulo: approved ? 'Cambio de estado aprobado' : 'Cambio de estado rechazado',
    mensaje: approved
      ? `Se aprobó cambiar "${request.nombreItemAscenso}" a ${STATUS_LABELS[request.estadoSolicitado] || request.estadoSolicitado}.`
      : `Se rechazó cambiar "${request.nombreItemAscenso}" fuera de Completado.`,
    prioridad: 'informativa',
    entidadTipo: 'miembro',
    entidadId: String(request.idMiembro),
    ruta: paths.dashboard.level.member.editAwards(
      encodeURIComponent(String(request.codigoMiembro || request.idMiembro))
    ),
    etiquetaAccion: 'Ver Sistema de Ascenso',
    actorId: user.uid || user.id || 'sistema',
    actorNombre: resolution.resueltoPorNombre,
    idsDestinatariosPrecalculados: [String(request.solicitadoPorUid)],
  }).catch(() => null);

  return { ...request, ...resolution };
}
