import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  collection,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { crearNotificacionAdmin } from 'src/services/notification-service';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import { resolverDestinatariosPorIdMiembros } from 'src/services/solicitudes-cambio-notificaciones-service';
import {
  CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO,
  obtenerAsignacionesOrganigramaPorDestacamento,
} from 'src/services/organigrama-directiva-destacamentos-service';

export const COLECCION_SOLICITUDES_ACCESO_SALUD = 'solicitudes_acceso_dispensa_medica';

export const SECCIONES_ACCESO_SALUD = {
  general: 'general',
  documentos: 'documentos',
  medicacion: 'medicacion',
  alergias: 'alergias',
  condiciones: 'condiciones',
};

export const TODAS_SECCIONES_ACCESO_SALUD = Object.values(SECCIONES_ACCESO_SALUD);

export const ETIQUETAS_SECCIONES_ACCESO_SALUD = {
  general: 'Información general',
  documentos: 'Documentos',
  medicacion: 'Medicación',
  alergias: 'Alergias',
  condiciones: 'Condiciones médicas',
};

export const DURACIONES_ACCESO_SALUD = {
  unaVez: 'una_vez',
  unaHora: '1_hora',
  unDia: '1_dia',
  tresDias: '3_dias',
  sieteDias: '7_dias',
};

export const OPCIONES_DURACION_ACCESO_SALUD = [
  { value: DURACIONES_ACCESO_SALUD.unaVez, label: 'Una única vez', milliseconds: null },
  { value: DURACIONES_ACCESO_SALUD.unaHora, label: '1 hora', milliseconds: 60 * 60 * 1000 },
  { value: DURACIONES_ACCESO_SALUD.unDia, label: '1 día', milliseconds: 24 * 60 * 60 * 1000 },
  { value: DURACIONES_ACCESO_SALUD.tresDias, label: '3 días', milliseconds: 3 * 24 * 60 * 60 * 1000 },
  { value: DURACIONES_ACCESO_SALUD.sieteDias, label: '7 días', milliseconds: 7 * 24 * 60 * 60 * 1000 },
];

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado para gestionar el acceso médico.');
  }
};

const getNombreUsuario = (usuario = {}) =>
  usuario.displayName ||
  usuario.nombre ||
  [usuario.nombres || usuario.firstName, usuario.apellidos || usuario.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  usuario.email ||
  usuario.correo ||
  'Usuario';

const getUsuarioId = (usuario = {}) => String(usuario.uid || usuario.id || '').trim();

const getNombreCorto = (value = '') => {
  const parts = String(value || 'Coordinador de Destacamento').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
};

const getNombreCortoUsuario = (usuario = {}) => {
  const nombreCompleto = getNombreUsuario(usuario);
  const primerNombre = String(usuario.nombres || usuario.firstName || nombreCompleto)
    .trim()
    .split(/\s+/)[0];
  const apellidoEstructurado = String(usuario.apellidos || usuario.lastName || '')
    .trim()
    .split(/\s+/)[0];

  return apellidoEstructurado
    ? `${primerNombre} ${apellidoEstructurado}`
    : getNombreCorto(nombreCompleto);
};

const getMemberName = (member = {}) =>
  [member.firstName || member.nombres, member.lastName || member.apellidos]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  member.name ||
  member.memberId ||
  member.codigoMiembro ||
  'Miembro';

const getMemberRouteSegment = (member = {}) =>
  encodeURIComponent(String(member.memberId || member.codigoMiembro || member.id || ''));

const mapSnapshot = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

const normalizarSecciones = (secciones = []) => {
  const permitidas = new Set(TODAS_SECCIONES_ACCESO_SALUD);
  return Array.from(new Set(secciones)).filter((seccion) => permitidas.has(seccion));
};

const obtenerCoordinadoresDestacamento = async (idDestacamento) => {
  const asignaciones = await obtenerAsignacionesOrganigramaPorDestacamento(idDestacamento);
  const cargos = [
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorDestacamento,
    CARGOS_ORGANIGRAMA_DIRECTIVA_DESTACAMENTO.coordinadorAsistenteDestacamento,
  ];

  return asignaciones.filter((item) => cargos.includes(item.cargo) && item.activo !== false);
};

export const esMiembroMenorDeEdad = (member = {}, fechaReferencia = new Date()) => {
  const rawBirthdate =
    member.birthDate || member.birth || member.dateOfBirth || member.fechaNacimiento || '';
  if (!rawBirthdate) return false;

  const birthdate = new Date(rawBirthdate);
  if (Number.isNaN(birthdate.getTime())) return false;

  let edad = fechaReferencia.getFullYear() - birthdate.getFullYear();
  const mes = fechaReferencia.getMonth() - birthdate.getMonth();
  if (mes < 0 || (mes === 0 && fechaReferencia.getDate() < birthdate.getDate())) edad -= 1;

  return edad >= 0 && edad < 18;
};

export const estaPermisoAccesoSaludVigente = (solicitud = {}, now = Date.now()) => {
  if (solicitud.estado !== 'aprobada') return false;
  if (solicitud.duracion === DURACIONES_ACCESO_SALUD.unaVez) {
    return !solicitud.fechaConsumo;
  }

  const expiresAt = new Date(solicitud.fechaExpiracion || 0).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
};

export async function crearSolicitudAccesoSalud({ member = {}, usuario = {}, justificacion = '' }) {
  asegurarFirebase();

  if (!esMiembroMenorDeEdad(member)) {
    throw new Error('Este flujo de acceso solo aplica a miembros menores de edad.');
  }

  const texto = String(justificacion || '').trim();
  if (!texto) throw new Error('La justificación es obligatoria.');

  const solicitadoPorUid = getUsuarioId(usuario);
  if (!solicitadoPorUid) throw new Error('No se pudo identificar al solicitante.');

  const idMiembros = Number(member.id || member.idMiembros) || null;
  const idDestacamento = Number(member.destId || member.idDestacamento) || null;
  if (!idMiembros || !idDestacamento) {
    throw new Error('No se pudo identificar al miembro o su destacamento.');
  }

  const pendientes = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_SOLICITUDES_ACCESO_SALUD),
      where('solicitadoPorUid', '==', solicitadoPorUid)
    )
  );
  const pendienteExistente = pendientes.docs
    .map(mapSnapshot)
    .find((item) => Number(item.idMiembros) === idMiembros && item.estado === 'pendiente');
  if (pendienteExistente) return pendienteExistente;

  const solicitudRef = doc(collection(FIRESTORE, COLECCION_SOLICITUDES_ACCESO_SALUD));
  const fechaCreacion = new Date().toISOString();
  const payload = {
    id: solicitudRef.id,
    idMiembros,
    codigoMiembro: member.memberId || member.codigoMiembro || '',
    nombreMiembro: getMemberName(member),
    idDestacamento,
    solicitadoPorUid,
    solicitadoPorIdMiembros: Number(usuario.idMiembros || usuario.memberId) || null,
    solicitadoPorNombre: getNombreUsuario(usuario),
    solicitadoPorRol: usuario.rolId || usuario.roleId || usuario.rol || usuario.role || '',
    justificacion: texto,
    estado: 'pendiente',
    fechaCreacion,
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(solicitudRef, payload);

  await registrarAuditoriaSilenciosa({
    modulo: 'dispensa_medica',
    accion: 'solicitud_acceso_creada',
    descripcion: `${payload.solicitadoPorNombre} solicitó acceso a la Dispensa Médica de ${payload.nombreMiembro}.`,
    entidad: { tipo: 'miembro', id: idMiembros, nombre: payload.nombreMiembro },
    realizadoPor: usuario,
    origen: 'member-health-access-service',
    metadatos: { idSolicitud: payload.id, justificacion: texto, idDestacamento },
  });

  const coordinadores = await obtenerCoordinadoresDestacamento(idDestacamento);
  const ruta = `${paths.dashboard.level.member.editHealth(getMemberRouteSegment(member))}?accesoSolicitud=${payload.id}`;

  await Promise.all(
    coordinadores.map(async (coordinador) => {
      const ids = await resolverDestinatariosPorIdMiembros(coordinador.idMiembros);
      if (!ids.length) return null;

      return crearNotificacionAdmin({
        tipoNotificacion: 'solicitud_acceso_dispensa_medica',
        modulo: 'miembros',
        titulo: 'Solicitud de acceso a Dispensa Médica',
        mensaje: `${payload.solicitadoPorNombre} solicita acceso a la información médica de ${payload.nombreMiembro}. Justificación: ${texto}`,
        prioridad: 'importante',
        entidadTipo: 'miembro',
        entidadId: String(idMiembros),
        ruta,
        etiquetaAccion: 'Revisar solicitud',
        actorId: solicitadoPorUid,
        actorNombre: payload.solicitadoPorNombre,
        idsDestinatariosPrecalculados: ids,
        metadatos: { idSolicitudAcceso: payload.id, justificacion: texto, fechaCreacion },
      });
    })
  );

  return payload;
}

export async function obtenerSolicitudAccesoSaludPorId(idSolicitud) {
  asegurarFirebase();
  if (!idSolicitud) return null;
  const snapshot = await getDoc(
    doc(FIRESTORE, COLECCION_SOLICITUDES_ACCESO_SALUD, String(idSolicitud))
  );
  return snapshot.exists() ? mapSnapshot(snapshot) : null;
}

export async function obtenerEstadoAccesoSalud({ member = {}, usuario = {} }) {
  asegurarFirebase();
  const solicitadoPorUid = getUsuarioId(usuario);
  const idMiembros = Number(member.id || member.idMiembros) || null;
  if (!solicitadoPorUid || !idMiembros) return { permiso: null, solicitudPendiente: null };

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_SOLICITUDES_ACCESO_SALUD),
      where('solicitadoPorUid', '==', solicitadoPorUid)
    )
  );
  const solicitudes = snapshot.docs
    .map(mapSnapshot)
    .filter((item) => Number(item.idMiembros) === idMiembros)
    .sort((a, b) => String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || '')));

  return {
    permiso: solicitudes.find(estaPermisoAccesoSaludVigente) || null,
    solicitudPendiente: solicitudes.find((item) => item.estado === 'pendiente') || null,
  };
}

export async function consumirPermisoAccesoSaludUnaVez(idSolicitud, usuario = {}) {
  asegurarFirebase();
  if (!idSolicitud) return false;

  const solicitudRef = doc(FIRESTORE, COLECCION_SOLICITUDES_ACCESO_SALUD, String(idSolicitud));
  const fechaConsumo = new Date().toISOString();
  const consumido = await runTransaction(FIRESTORE, async (transaction) => {
    const snapshot = await transaction.get(solicitudRef);
    if (!snapshot.exists()) return false;
    const data = snapshot.data();
    if (
      data.duracion !== DURACIONES_ACCESO_SALUD.unaVez ||
      data.fechaConsumo ||
      data.estado !== 'aprobada' ||
      data.solicitadoPorUid !== getUsuarioId(usuario)
    ) {
      return false;
    }
    transaction.update(solicitudRef, {
      fechaConsumo,
      consumidoPorUid: getUsuarioId(usuario),
      actualizadoEnServidor: serverTimestamp(),
    });
    return true;
  });

  if (consumido) {
    registrarAuditoriaSilenciosa({
      modulo: 'dispensa_medica',
      accion: 'permiso_acceso_consumido',
      descripcion: 'Se consumió un permiso de acceso de una única vez.',
      entidad: { tipo: 'solicitud_acceso_salud', id: idSolicitud },
      realizadoPor: usuario,
      origen: 'member-health-access-service',
    });
  }

  return consumido;
}

export async function resolverSolicitudAccesoSalud({
  idSolicitud,
  decision,
  duracion = '',
  secciones = [],
  usuario = {},
}) {
  asegurarFirebase();
  const solicitud = await obtenerSolicitudAccesoSaludPorId(idSolicitud);
  if (!solicitud || solicitud.estado !== 'pendiente') {
    throw new Error('La solicitud ya no está pendiente.');
  }

  const coordinadores = await obtenerCoordinadoresDestacamento(solicitud.idDestacamento);
  const idMiembrosActor = Number(usuario.idMiembros || usuario.memberId) || null;
  const puedeResolver = coordinadores.some(
    (coordinador) => Number(coordinador.idMiembros) === idMiembrosActor
  );
  if (!puedeResolver) {
    throw new Error('No tienes autorización para resolver solicitudes de este destacamento.');
  }

  const aprobada = decision === 'aprobar';
  const opcionDuracion = OPCIONES_DURACION_ACCESO_SALUD.find((item) => item.value === duracion);
  const seccionesFinales = normalizarSecciones(secciones);
  if (aprobada && (!opcionDuracion || !seccionesFinales.length)) {
    throw new Error('Selecciona la duración y al menos una sección.');
  }

  const fechaResolucion = new Date();
  const fechaExpiracion =
    aprobada && opcionDuracion.milliseconds
      ? new Date(fechaResolucion.getTime() + opcionDuracion.milliseconds).toISOString()
      : null;
  const payload = {
    estado: aprobada ? 'aprobada' : 'rechazada',
    duracion: aprobada ? duracion : null,
    duracionTexto: aprobada ? opcionDuracion.label : null,
    secciones: aprobada ? seccionesFinales : [],
    fechaExpiracion,
    fechaResolucion: fechaResolucion.toISOString(),
    resueltoPorUid: getUsuarioId(usuario),
    resueltoPorIdMiembros: Number(usuario.idMiembros || usuario.memberId) || null,
    resueltoPorNombre: getNombreUsuario(usuario),
    resueltoPorNombreCorto: getNombreCortoUsuario(usuario),
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_SOLICITUDES_ACCESO_SALUD, String(idSolicitud)),
    payload,
    { merge: true }
  );

  await registrarAuditoriaSilenciosa({
    modulo: 'dispensa_medica',
    accion: aprobada ? 'solicitud_acceso_aprobada' : 'solicitud_acceso_rechazada',
    descripcion: `${payload.resueltoPorNombre} ${aprobada ? 'aprobó' : 'rechazó'} el acceso solicitado por ${solicitud.solicitadoPorNombre}.`,
    entidad: { tipo: 'miembro', id: solicitud.idMiembros, nombre: solicitud.nombreMiembro },
    realizadoPor: usuario,
    origen: 'member-health-access-service',
    metadatos: {
      idSolicitud,
      justificacion: solicitud.justificacion,
      duracion: payload.duracionTexto,
      secciones: payload.secciones,
    },
  });

  const segmento = encodeURIComponent(
    String(solicitud.codigoMiembro || solicitud.idMiembros || '')
  );
  const hastaTexto = fechaExpiracion
    ? new Date(fechaExpiracion).toLocaleString('es-DO')
    : 'completar una única visualización';
  await crearNotificacionAdmin({
    tipoNotificacion: 'resultado_acceso_dispensa_medica',
    modulo: 'miembros',
    titulo: aprobada ? 'Acceso a Dispensa Médica aprobado' : 'Acceso a Dispensa Médica rechazado',
    mensaje: aprobada
      ? `Tu acceso fue autorizado por ${payload.resueltoPorNombreCorto} y es válido hasta ${hastaTexto}.`
      : 'Tu solicitud de acceso a la Dispensa Médica fue rechazada.',
    prioridad: 'informativa',
    entidadTipo: 'miembro',
    entidadId: String(solicitud.idMiembros),
    ruta: segmento ? `${paths.dashboard.level.member.editHealth(segmento)}?accesoResultado=${idSolicitud}` : '/dashboard',
    etiquetaAccion: 'Ver resultado',
    actorId: getUsuarioId(usuario),
    actorNombre: payload.resueltoPorNombre,
    idsDestinatariosPrecalculados: [String(solicitud.solicitadoPorUid)],
    metadatos: {
      idSolicitudAcceso: idSolicitud,
      estado: payload.estado,
      duracion: payload.duracion,
      duracionTexto: payload.duracionTexto,
      secciones: payload.secciones,
      fechaResolucion: payload.fechaResolucion,
      fechaExpiracion: payload.fechaExpiracion,
      resueltoPorNombre: payload.resueltoPorNombre,
      resueltoPorNombreCorto: payload.resueltoPorNombreCorto,
    },
  });

  return { ...solicitud, ...payload };
}

export const formatearTiempoRestanteAccesoSalud = (permiso = {}, now = Date.now()) => {
  if (permiso.duracion === DURACIONES_ACCESO_SALUD.unaVez) return 'una única visualización';
  const remaining = Math.max(0, new Date(permiso.fechaExpiracion || 0).getTime() - now);
  const totalHours = Math.ceil(remaining / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (!days) return `${totalHours} hora${totalHours === 1 ? '' : 's'}`;
  return `${days} día${days === 1 ? '' : 's'}${hours ? ` y ${hours} hora${hours === 1 ? '' : 's'}` : ''}`;
};
