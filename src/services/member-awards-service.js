import { ref, deleteObject } from 'firebase/storage';
import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import {
  conCache,
  conInvalidacion,
  invalidarLecturas,
  avisarAOtrasSesiones,
} from 'src/utils/cache-de-lecturas.mjs';

import { getMemberById } from 'src/services/member-service';
import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';
import { registrarCambiosHistorialMiembro } from 'src/services/member-history-service';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';
import {
  getAwardsProgressCache,
  setAwardsProgressCache,
  notifyAwardsProgressChanged,
} from 'src/services/awards-progress-cache';
import {
  notificarAgregadoSistemaAscenso,
  notificarCambioEstadoSistemaAscenso,
} from 'src/services/solicitudes-cambio-notificaciones-service';

export const COLECCION_ITEMS_ASCENSO = 'itemsAscenso';
export const COLECCION_PROGRESO_ASCENSO_MIEMBROS = 'progresoAscensoMiembros';
export const COLECCION_VINCULOS_CERTIFICADOS_ASCENSO = 'vinculosCertificadosAscenso';
export const COLECCION_FAVORITOS_ASCENSO_MIEMBROS = 'favoritosAscensoMiembros';

const AWARD_PROGRESS_HISTORY_FIELDS = {
  estado: 'Estado',
  fechaCompletado: 'Fecha completado',
  vecesCompletado: 'Veces completado',
  idCertificadoActual: 'Certificado actual',
};

const AWARD_FAVORITE_HISTORY_FIELDS = {
  favorito: 'Favorito',
};

export const normalizeIdSegment = (value = '') =>
  String(value || 'archivo')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getCreator = (user, fallbackName = 'Usuario') => ({
  uid: user?.uid || user?.id || '',
  nombre:
    user?.displayName ||
    user?.name ||
    [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
    user?.email ||
    user?.codigoMiembro ||
    fallbackName,
  correo: user?.email || '',
});

const SECURITY_AWARD_LINK = {
  id: 'escalon-seguridad_seguridad-y-primeros-auxilios',
  idPlantilla: 'escalon-seguridad',
  nombrePlantilla: 'ESCALON SEGURIDAD',
  idCurso: 'escalon-seguridad',
  nombreCurso: 'ESCALON SEGURIDAD',
  idItemAscenso: 'seguridad-y-primeros-auxilios',
  nombreItemAscenso: 'Seguridad y Primeros Auxilios',
  sistema: 'academia',
  idDivision: '',
  nombreDivision: '',
  idGrupo: 'lider-de-destacamento',
  nombreGrupo: 'Lider de Destacamento',
  activo: true,
};

const DEFAULT_AWARD_CERTIFICATE_LINKS = [SECURITY_AWARD_LINK];

const normalizeLink = (link = {}) => ({
  id: link.id || `${link.idPlantilla || link.idCurso}_${link.idItemAscenso}`,
  idPlantilla: link.idPlantilla || '',
  nombrePlantilla: link.nombrePlantilla || '',
  idCurso: link.idCurso || '',
  nombreCurso: link.nombreCurso || '',
  idItemAscenso: link.idItemAscenso || '',
  nombreItemAscenso: link.nombreItemAscenso || '',
  sistema: link.sistema || 'sistemaAscenso',
  idDivision: link.idDivision || '',
  nombreDivision: link.nombreDivision || '',
  idGrupo: link.idGrupo || '',
  nombreGrupo: link.nombreGrupo || '',
  activo: link.activo !== false,
});

const linkMatches = (link, values) => {
  const normalizedLink = normalizeLink(link);
  const candidates = [
    values.idPlantilla,
    values.nombrePlantilla,
    values.idCurso,
    values.nombreCurso,
    values.tituloCertificado,
  ].map(normalizeText);

  const linkValues = [
    normalizedLink.idPlantilla,
    normalizedLink.nombrePlantilla,
    normalizedLink.idCurso,
    normalizedLink.nombreCurso,
  ].map(normalizeText);

  return linkValues.some(
    (linkValue) =>
      linkValue &&
      candidates.some(
        (candidate) =>
          candidate === linkValue || candidate.includes(linkValue) || linkValue.includes(candidate)
      )
  );
};

const findDefaultLink = (values) => {
  const text = [
    values.idPlantilla,
    values.nombrePlantilla,
    values.idCurso,
    values.nombreCurso,
    values.tituloCertificado,
  ]
    .map(normalizeText)
    .join(' ');

  if (text.includes('seguridad')) {
    return SECURITY_AWARD_LINK;
  }

  return DEFAULT_AWARD_CERTIFICATE_LINKS.find((link) => linkMatches(link, values)) || null;
};

const buscarVinculoCertificadoAscensoSinCache = async ({
  idPlantilla = '',
  nombrePlantilla = '',
  idCurso = '',
  nombreCurso = '',
  tituloCertificado = '',
} = {}) => {
  const values = { idPlantilla, nombrePlantilla, idCurso, nombreCurso, tituloCertificado };

  if (isFirebaseConfigured && FIRESTORE) {
    const snapshot = await getDocs(
      query(
        collection(FIRESTORE, COLECCION_VINCULOS_CERTIFICADOS_ASCENSO),
        where('activo', '==', true)
      )
    ).catch(() => ({ docs: [] }));

    const remoteLink = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .find((item) => linkMatches(item, values));

    if (remoteLink) {
      return normalizeLink(remoteLink);
    }
  }

  const defaultLink = findDefaultLink(values);

  return defaultLink ? normalizeLink(defaultLink) : null;
};

const guardarVinculoCertificadoAscensoDirecto = async (vinculo) => {
  if (!isFirebaseConfigured || !FIRESTORE || !vinculo?.id) return vinculo;

  const document = normalizeLink(vinculo);

  await setDoc(
    doc(FIRESTORE, COLECCION_VINCULOS_CERTIFICADOS_ASCENSO, document.id),
    { ...document, actualizadoEnServidor: serverTimestamp() },
    { merge: true }
  );

  return document;
};

export const getProgressId = (idMiembro, idItemAscenso) =>
  `${normalizeIdSegment(idMiembro)}_${normalizeIdSegment(idItemAscenso)}`;

const resolveMember = async (memberOrId) => {
  if (memberOrId && typeof memberOrId === 'object') return memberOrId;
  if (!memberOrId) return null;

  return getMemberById(memberOrId).catch(() => null);
};

// `member` puede llegar `null` (el padrón no respondió o no lo tiene) y el valor
// por defecto solo cubre `undefined`: `null.nombreMiembro` tumbaba TODO guardado
// de premios mientras la API .NET no contestara.
const getMemberName = (miembro) => {
  const member = miembro || {};

  return nombreDeMiembro(member);
};

const nombreDeMiembro = (member) =>
  member.nombreMiembro ||
  member.memberName ||
  member.fullName ||
  [member.firstName || member.nombres, member.lastName || member.apellidos]
    .filter(Boolean)
    .join(' ') ||
  member.memberId ||
  member.codigoMiembro ||
  '';

const getCertificateForProgress = (certificado = {}) => {
  if (!certificado?.id) return null;

  return {
    id: certificado.id,
    nombre:
      certificado.nombreArchivo || certificado.nombre || certificado.name || 'certificado.pdf',
    urlPdf: certificado.urlPdf || certificado.pdfUrl || '',
    rutaPdf: certificado.rutaPdf || certificado.pdfPath || '',
    pesoPdf: certificado.pesoPdf || certificado.pdfSize || 0,
    creadoEn: certificado.creadoEn || certificado.createdAt || new Date().toISOString(),
  };
};

/**
 * Fecha, veces y certificado del documento de progreso a partir del anterior.
 *   - `certificado: null` BORRA el certificado; `undefined` deja el que había.
 *     Antes los dos dejaban el anterior (`certificado || previous`): borrar un
 *     certificado o quitar un completado no llegaba a Firestore y al recargar
 *     el certificado volvía.
 *   - Sin completar no hay fecha de completado (antes se quedaba la de antes).
 */
export const camposDelProgreso = ({
  previous = {},
  estado,
  fechaCompletado,
  vecesCompletado,
  certificado,
  now,
}) => {
  const certificateForProgress = getCertificateForProgress(certificado);
  const borrarCertificado = certificado === null;
  const completado = estado === 'completado';
  const idsPrevios = previous.idsCertificados || [];

  return {
    borrarCertificado,
    certificateForProgress,
    fechaCompletado: completado ? fechaCompletado || previous.fechaCompletado || now : null,
    vecesCompletado:
      typeof vecesCompletado === 'number'
        ? vecesCompletado
        : Number(previous.vecesCompletado || (completado ? 1 : 0)),
    idCertificadoActual: borrarCertificado
      ? ''
      : certificateForProgress?.id || previous.idCertificadoActual || '',
    idsCertificados: certificateForProgress?.id
      ? Array.from(new Set([...idsPrevios, certificateForProgress.id]))
      : borrarCertificado
        ? idsPrevios.filter((id) => String(id) !== String(previous.idCertificadoActual))
        : idsPrevios,
    certificadoActual: borrarCertificado
      ? null
      : certificateForProgress || previous.certificadoActual || null,
  };
};

// LOS GUARDADOS DE UN MISMO PREMIO VAN EN FILA.
//
// Cada guardado lee el documento, espera (al miembro, al historial) y lo vuelve a
// escribir entero. Dos seguidos sobre el mismo premio —quitar el completado y
// borrar su certificado, o completar y cambiar la fecha— se pisaban: el que
// terminaba último ganaba, aunque fuera el primero en empezar, y el premio podía
// quedar "completado" en Firestore después de quitarlo. Ahora el segundo espera
// al primero; premios distintos siguen guardándose en paralelo.
const colasDeGuardado = new Map();

export const enColaDelPremio = (clave, tarea) => {
  const anterior = colasDeGuardado.get(clave) ?? Promise.resolve();
  const siguiente = anterior.catch(() => null).then(tarea);
  const cola = siguiente.catch(() => null);
  colasDeGuardado.set(clave, cola);
  cola.then(() => {
    if (colasDeGuardado.get(clave) === cola) colasDeGuardado.delete(clave);
  });

  return siguiente;
};

const guardarProgresoAscensoMiembroDirecto = (opciones = {}) =>
  enColaDelPremio(
    `${opciones.idMiembro || opciones.member?.id || ''}_${opciones.vinculo?.idItemAscenso || ''}`,
    () => guardarProgresoEnFirestore(opciones)
  );

const guardarProgresoEnFirestore = async ({
  member,
  idMiembro,
  codigoMiembro,
  nombreMiembro,
  vinculo,
  estado = 'completado',
  fechaCompletado,
  vecesCompletado,
  certificado,
  user,
  // `false` en los lotes: se manda UN aviso con todos (`avisarCambioEstadoEnLote`)
  // en vez de uno por premio a cada coordinador.
  avisar = true,
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !vinculo?.idItemAscenso) return null;

  const resolvedMember = await resolveMember(member || idMiembro);
  const finalIdMiembro = String(
    idMiembro || resolvedMember?.id || resolvedMember?.idMiembros || ''
  );

  if (!finalIdMiembro) return null;

  const finalCodigoMiembro = String(
    codigoMiembro || resolvedMember?.memberId || resolvedMember?.codigoMiembro || ''
  );
  const finalNombreMiembro = nombreMiembro || getMemberName(resolvedMember);
  const progressId = getProgressId(finalIdMiembro, vinculo.idItemAscenso);
  const progressRef = doc(FIRESTORE, COLECCION_PROGRESO_ASCENSO_MIEMBROS, progressId);
  const previousSnap = await getDoc(progressRef).catch(() => null);
  const previous = previousSnap?.exists?.() ? previousSnap.data() : {};
  const now = new Date().toISOString();
  const { borrarCertificado, certificateForProgress, ...campos } = camposDelProgreso({
    previous,
    estado,
    fechaCompletado,
    vecesCompletado,
    certificado,
    now,
  });

  const document = {
    id: progressId,
    idMiembro: finalIdMiembro,
    codigoMiembro: finalCodigoMiembro,
    nombreMiembro: finalNombreMiembro,
    idItemAscenso: vinculo.idItemAscenso,
    nombreItemAscenso: vinculo.nombreItemAscenso,
    sistema: vinculo.sistema,
    idDivision: vinculo.idDivision || '',
    nombreDivision: vinculo.nombreDivision || '',
    idGrupo: vinculo.idGrupo || '',
    nombreGrupo: vinculo.nombreGrupo || '',
    estado,
    ...campos,
    actualizadoEn: now,
    actualizadoPor: getCreator(user),
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_ITEMS_ASCENSO, vinculo.idItemAscenso),
    {
      id: vinculo.idItemAscenso,
      nombre: vinculo.nombreItemAscenso,
      sistema: vinculo.sistema,
      idDivision: vinculo.idDivision || '',
      nombreDivision: vinculo.nombreDivision || '',
      idGrupo: vinculo.idGrupo || '',
      nombreGrupo: vinculo.nombreGrupo || '',
      actualizadoEn: now,
      actualizadoEnServidor: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => null);

  // Pasa por la puerta de cambios: primero queda en Historial y solo despues se
  // escribe. Sistema de Ascenso y Academia Ministerial comparten esta funcion,
  // asi que el ambito sale del propio vinculo.
  await proponerCambio({
    ambito:
      vinculo.sistema === 'sistemaAscenso'
        ? AMBITOS_CAMBIO.sistemaAscenso
        : AMBITOS_CAMBIO.academiaMinisterial,
    entidad: {
      tipo: 'miembro',
      id: finalIdMiembro,
      nombre: finalNombreMiembro,
      ruta: `/dashboard/level/member/${finalCodigoMiembro || finalIdMiembro}/edit/awards`,
    },
    cambios: [
      {
        campo: vinculo.idItemAscenso,
        etiqueta: vinculo.nombreItemAscenso || vinculo.idItemAscenso,
        antes: previous?.estado ?? null,
        despues: estado,
      },
    ],
    usuario: user,
    descripcion: `Se actualizó "${vinculo.nombreItemAscenso || vinculo.idItemAscenso}" de ${finalNombreMiembro}: ${previous?.estado ?? 'sin registro'} → ${estado}.`,
    aplicar: () =>
      setDoc(progressRef, { ...document, actualizadoEnServidor: serverTimestamp() }, { merge: true }),
    lecturasAfectadas: LECTURAS_DEL_PROGRESO,
  });

  // Quitar el certificado lo BORRA, como al aprobar una solicitud
  // (`award-status-change-request-service`): su ficha en `certificados` y el
  // archivo. Antes solo se soltaba la referencia y el archivo quedaba huérfano.
  // El aviso que se confirma ya dice que se eliminará.
  if (borrarCertificado && previous.idCertificadoActual) {
    const rutaArchivo =
      previous.certificadoActual?.rutaPdf || previous.certificadoActual?.pdfPath || '';
    deleteDoc(doc(FIRESTORE, 'certificados', String(previous.idCertificadoActual))).catch(
      () => null
    );
    if (rutaArchivo && FIREBASE_STORAGE) {
      deleteObject(ref(FIREBASE_STORAGE, rutaArchivo)).catch(() => null);
    }
  }

  registrarCambiosHistorialMiembro({
    idMiembro: finalIdMiembro,
    codigoMiembro: finalCodigoMiembro,
    nombreMiembro: finalNombreMiembro,
    modulo: 'Sistema de Ascenso',
    antes: previous,
    despues: document,
    campos: AWARD_PROGRESS_HISTORY_FIELDS,
    usuario: user,
    metadata: {
      origen: 'member-awards-service',
      idItemAscenso: vinculo.idItemAscenso,
      nombreItemAscenso: vinculo.nombreItemAscenso,
      sistema: vinculo.sistema,
    },
  }).catch(() => null);

  // Aviso informativo al Coordinador y Coordinador Asistente de Destacamento: se
  // notifica solo cuando se AGREGA algo (el item pasa a completado por primera
  // vez o se adjunta un nuevo certificado), indicando quién, qué y a quién.
  const cambioEstado = previous.estado !== estado;
  const seAgregoCertificado = Boolean(
    certificateForProgress?.id && !(previous.idsCertificados || []).includes(certificateForProgress.id)
  );

  if (avisar && (cambioEstado || seAgregoCertificado)) {
    const segmento = encodeURIComponent(finalCodigoMiembro || finalIdMiembro);
    const contexto = [vinculo.nombreDivision, vinculo.nombreGrupo].filter(Boolean).join(' · ');
    const actor = getCreator(user);
    // Enlace directo a la carpeta (grupo) donde se agregó el item, no a la raiz
    // de premios. La navegacion de premios usa ?folder=<idGrupo>.
    const rutaBaseAwards = paths.dashboard.level.member.editAwards(segmento);
    const ruta = vinculo.idGrupo
      ? `${rutaBaseAwards}?folder=${encodeURIComponent(vinculo.idGrupo)}`
      : rutaBaseAwards;

    const notificationMember = {
      ...(resolvedMember || {}),
      id: finalIdMiembro,
      idMiembros: finalIdMiembro,
      memberId: finalCodigoMiembro,
      nombreMiembro: finalNombreMiembro,
    };

    if (cambioEstado && vinculo.sistema === 'sistemaAscenso') {
      notificarCambioEstadoSistemaAscenso({
        member: notificationMember,
        actorId: actor.uid || 'sistema',
        actorIdMiembros: user?.idMiembros ?? user?.id ?? null,
        actorNombre: actor.nombre,
        itemNombre: vinculo.nombreItemAscenso,
        estadoAnterior: previous.estado,
        estadoNuevo: estado,
        ruta,
      }).catch(() => null);
    } else if (seAgregoCertificado) {
      notificarAgregadoSistemaAscenso({
        member: notificationMember,
        actorId: actor.uid || 'sistema',
        actorIdMiembros: user?.idMiembros ?? user?.id ?? null,
        actorNombre: actor.nombre,
        itemNombre: `Certificado: ${vinculo.nombreItemAscenso}`,
        itemContexto: contexto,
        ruta,
      }).catch(() => null);
    }
  }

  return document;
};

const listarProgresoAscensoMiembroSinCache = async (idMiembro) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembro) return [];

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_PROGRESO_ASCENSO_MIEMBROS),
      where('idMiembro', '==', String(idMiembro))
    )
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

const toLocalCertificate = (progress) => {
  const certificate = progress.certificadoActual || {};

  if (!progress.idCertificadoActual && !certificate.urlPdf) return null;

  return {
    id: progress.idCertificadoActual || certificate.id,
    name: certificate.nombre || certificate.nombreArchivo || 'certificado.pdf',
    urlPdf: certificate.urlPdf || '',
    pdfUrl: certificate.urlPdf || '',
    rutaPdf: certificate.rutaPdf || '',
    fileBase64: certificate.fileBase64 || '',
  };
};

export const combinarProgresoAscensoEnCache = (idMiembro, progressList = []) => {
  if (!idMiembro) return { status: {}, data: {} };

  const cached = getAwardsProgressCache(idMiembro);
  const status = { ...(cached.status || {}) };
  const data = { ...(cached.data || {}) };

  progressList.forEach((progress) => {
    const system = progress.sistema === 'sistemaAscenso' ? 'sistemaAscenso' : 'academia';
    const itemId = progress.idItemAscenso;
    // idGrupo/idDivision pueden faltar según cómo se resolvió el contexto al
    // guardar; no descartamos el progreso por eso (se usa '' como clave estable y
    // la lectura tiene un respaldo por idItemAscenso). Solo el itemId es obligatorio.
    const groupId = progress.idGrupo || '';

    if (!itemId) return;

    // Lo que ya hay en memoria y es MÁS NUEVO que lo leído se queda: es un cambio
    // hecho en esta sesión cuyo guardado aún no había llegado a Firestore cuando
    // se leyó. Antes lo leído lo pisaba y un premio recién completado perdía el
    // check al volver a la pestaña.
    const local =
      progress.sistema === 'sistemaAscenso'
        ? data.sistemaAscenso?.[progress.idDivision || '']?.[groupId]?.[itemId]
        : data.academia?.[groupId]?.[itemId];
    if (local?.updatedAt && progress.actualizadoEn && local.updatedAt > progress.actualizadoEn) {
      return;
    }

    const node = {
      status: progress.estado || 'no_iniciado',
      completedDate: progress.fechaCompletado || null,
      timesCompleted: Number(progress.vecesCompletado || 0),
      certificate: toLocalCertificate(progress),
      updatedAt: progress.actualizadoEn || null,
    };

    if (system === 'sistemaAscenso') {
      const divisionId = progress.idDivision || '';

      status.sistemaAscenso ??= {};
      status.sistemaAscenso[divisionId] ??= {};
      status.sistemaAscenso[divisionId][groupId] ??= {};
      status.sistemaAscenso[divisionId][groupId][itemId] = node.status;

      data.sistemaAscenso ??= {};
      data.sistemaAscenso[divisionId] ??= {};
      data.sistemaAscenso[divisionId][groupId] ??= {};
      data.sistemaAscenso[divisionId][groupId][itemId] = node;
    } else {
      status.academia ??= {};
      status.academia[groupId] ??= {};
      status.academia[groupId][itemId] = node.status;

      data.academia ??= {};
      data.academia[groupId] ??= {};
      data.academia[groupId][itemId] = node;
    }
  });

  return setAwardsProgressCache(idMiembro, { status, data });
};

// Traer el progreso es una LECTURA. Antes iba envuelta en `conInvalidacion` sin
// prefijos: cada vez que alguien abría la pestaña de premios se vaciaba la caché
// ENTERA de la aplicación (padrón, directivas, fotos…) y se avisaba a las demás
// sesiones para que vaciaran la suya, y la propia lectura nunca se aprovechaba.
// Ahora pasa por la caché como cualquier lectura; las escrituras ya la invalidan.
// `fresco`: para quien acaba de escribir por otra vía (aprobar una solicitud) y
// necesita lo último, no lo guardado.
export const sincronizarProgresoAscensoFirebase = async (idMiembro, { fresco = false } = {}) => {
  if (fresco) {
    invalidarLecturas('ascenso:');
    avisarAOtrasSesiones('ascenso:');
  }

  const progressList = await listarProgresoAscensoMiembro(idMiembro);
  const result = combinarProgresoAscensoEnCache(idMiembro, progressList);

  notifyAwardsProgressChanged(idMiembro);

  return result;
};

const listarFavoritosAscensoMiembroSinCache = async (idMiembro) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembro) return {};

  const snap = await getDoc(
    doc(FIRESTORE, COLECCION_FAVORITOS_ASCENSO_MIEMBROS, String(idMiembro))
  ).catch(() => null);

  if (!snap?.exists?.()) return {};

  const data = snap.data() || {};

  return data.elementos || data.items || {};
};

const guardarFavoritoAscensoMiembroDirecto = async ({
  idMiembro,
  itemId,
  favorito,
  item = {},
  user,
} = {}) => {
  if (!idMiembro || !itemId) return null;

  const key = String(itemId);
  const now = new Date().toISOString();
  const payload = {
    favorito: Boolean(favorito),
    idItem: key,
    nombreItem: item.name || item.nombre || '',
    tipoItem: item.type || '',
    idPadre: item.parentId || '',
    actualizadoEn: now,
    actualizadoPor: getCreator(user),
  };

  if (!isFirebaseConfigured || !FIRESTORE) return payload;

  const docRef = doc(FIRESTORE, COLECCION_FAVORITOS_ASCENSO_MIEMBROS, String(idMiembro));
  const currentSnap = await getDoc(docRef).catch(() => null);
  const currentData = currentSnap?.exists?.() ? currentSnap.data() || {} : {};
  const currentItems = currentData.elementos || currentData.items || {};
  const previousItem = currentItems[key] || {};

  await setDoc(
    docRef,
    {
      idMiembro: String(idMiembro),
      elementos: {
        ...currentItems,
        [key]: payload,
      },
      actualizadoEn: now,
      actualizadoEnServidor: serverTimestamp(),
    },
    { merge: true }
  );

  registrarCambiosHistorialMiembro({
    idMiembro: String(idMiembro),
    modulo: 'Sistema de Ascenso',
    antes: previousItem,
    despues: payload,
    campos: AWARD_FAVORITE_HISTORY_FIELDS,
    usuario: user,
    metadata: {
      origen: 'member-awards-service',
      idItem: key,
      nombreItem: payload.nombreItem,
      tipoItem: payload.tipoItem,
    },
  }).catch(() => null);

  return payload;
};

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const listarProgresoAscensoMiembro = conCache('ascenso:listarProgresoAscensoMiembro', listarProgresoAscensoMiembroSinCache);
export const listarFavoritosAscensoMiembro = conCache('ascenso:listarFavoritosAscensoMiembro', listarFavoritosAscensoMiembroSinCache);
export const buscarVinculoCertificadoAscenso = conCache('ascenso:buscarVinculoCertificadoAscenso', buscarVinculoCertificadoAscensoSinCache);
export const guardarVinculoCertificadoAscenso = conInvalidacion(guardarVinculoCertificadoAscensoDirecto, [], ['ascenso:']);
// UN aviso para un lote (completar o quitar varios de una vez): antes cada
// premio mandaba el suyo a cada coordinador y completar 59 eran 59 avisos.
export const avisarCambioEstadoEnLote = async ({
  idMiembro,
  nombres = [],
  estadoAnterior,
  estadoNuevo,
  idGrupo,
  user,
} = {}) => {
  if (!idMiembro || !nombres.length) return 0;

  // Un aviso nunca puede tumbar el guardado: cualquier fallo se queda aquí.
  try {
    return await enviarAvisoDeLote({ idMiembro, nombres, estadoAnterior, estadoNuevo, idGrupo, user });
  } catch (error) {
    console.error('[ascenso] no se pudo avisar del lote', error);
    return 0;
  }
};

const enviarAvisoDeLote = async ({ idMiembro, nombres, estadoAnterior, estadoNuevo, idGrupo, user }) => {
  // Sin miembro en el padrón (no cargó, o no está) el aviso sale igual, con su id.
  const member = (await resolveMember(idMiembro)) || {};
  const codigo = member?.memberId || member?.codigoMiembro || idMiembro;
  const rutaBase = paths.dashboard.level.member.editAwards(encodeURIComponent(codigo));
  const actor = getCreator(user);
  const lista = nombres.length > 5 ? `${nombres.slice(0, 5).join(', ')}…` : nombres.join(', ');

  return notificarCambioEstadoSistemaAscenso({
    member: {
      ...(member || {}),
      id: String(idMiembro),
      idMiembros: String(idMiembro),
      memberId: codigo,
      nombreMiembro: getMemberName(member),
    },
    actorId: actor.uid || 'sistema',
    actorIdMiembros: user?.idMiembros ?? user?.id ?? null,
    actorNombre: actor.nombre,
    itemNombre: nombres.length === 1 ? nombres[0] : `${nombres.length} premios (${lista})`,
    estadoAnterior,
    estadoNuevo,
    ruta: idGrupo ? `${rutaBase}?folder=${encodeURIComponent(idGrupo)}` : rutaBase,
  }).catch(() => 0);
};

// Lo que un guardado de progreso puede dejar viejo: el progreso, el historial
// del miembro, las solicitudes/auditoría de la puerta de cambios. Antes vaciaba
// la caché ENTERA (padrón, directivas, fotos…) en cada premio: completar 59 de
// golpe eran 59 vaciados y la aplicación entera volvía a pedirlo todo.
export const LECTURAS_DEL_PROGRESO = ['ascenso:', 'ascenso-estado:', 'historial:', 'solicitudes:', 'auditoria:'];
export const guardarProgresoAscensoMiembro = conInvalidacion(guardarProgresoAscensoMiembroDirecto, LECTURAS_DEL_PROGRESO, ['ascenso:']);
// Un favorito solo cambia lo de ascenso y el historial del miembro. Antes cada
// estrella vaciaba la caché ENTERA de la aplicación.
export const guardarFavoritoAscensoMiembro = conInvalidacion(guardarFavoritoAscensoMiembroDirecto, ['ascenso:', 'historial:'], ['ascenso:']);
