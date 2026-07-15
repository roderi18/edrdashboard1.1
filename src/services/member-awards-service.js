import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { getMemberById } from 'src/services/member-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { registrarCambiosHistorialMiembro } from 'src/services/member-history-service';
import { notificarAgregadoSistemaAscenso } from 'src/services/solicitudes-cambio-notificaciones-service';
import {
  getAwardsProgressCache,
  setAwardsProgressCache,
  notifyAwardsProgressChanged,
} from 'src/services/awards-progress-cache';

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

export const buscarVinculoCertificadoAscenso = async ({
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

export const guardarVinculoCertificadoAscenso = async (vinculo) => {
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

const getMemberName = (member = {}) =>
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

export const guardarProgresoAscensoMiembro = async ({
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
  const certificateForProgress = getCertificateForProgress(certificado);
  const nextCertificateIds = certificateForProgress?.id
    ? Array.from(new Set([...(previous.idsCertificados || []), certificateForProgress.id]))
    : previous.idsCertificados || [];
  const now = new Date().toISOString();

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
    fechaCompletado:
      fechaCompletado || previous.fechaCompletado || (estado === 'completado' ? now : null),
    vecesCompletado:
      typeof vecesCompletado === 'number'
        ? vecesCompletado
        : Number(previous.vecesCompletado || (estado === 'completado' ? 1 : 0)),
    idCertificadoActual: certificateForProgress?.id || previous.idCertificadoActual || '',
    idsCertificados: nextCertificateIds,
    certificadoActual: certificateForProgress || previous.certificadoActual || null,
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

  await setDoc(
    progressRef,
    { ...document, actualizadoEnServidor: serverTimestamp() },
    { merge: true }
  );

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
  const seCompletoAhora = estado === 'completado' && previous.estado !== 'completado';
  const seAgregoCertificado = Boolean(
    certificateForProgress?.id && !(previous.idsCertificados || []).includes(certificateForProgress.id)
  );

  if (seCompletoAhora || seAgregoCertificado) {
    const segmento = encodeURIComponent(finalCodigoMiembro || finalIdMiembro);
    const contexto = [vinculo.nombreDivision, vinculo.nombreGrupo].filter(Boolean).join(' · ');
    const actor = getCreator(user);
    // Enlace directo a la carpeta (grupo) donde se agregó el item, no a la raiz
    // de premios. La navegacion de premios usa ?folder=<idGrupo>.
    const rutaBaseAwards = paths.dashboard.level.member.editAwards(segmento);
    const ruta = vinculo.idGrupo
      ? `${rutaBaseAwards}?folder=${encodeURIComponent(vinculo.idGrupo)}`
      : rutaBaseAwards;

    notificarAgregadoSistemaAscenso({
      member: {
        ...(resolvedMember || {}),
        id: finalIdMiembro,
        idMiembros: finalIdMiembro,
        memberId: finalCodigoMiembro,
        nombreMiembro: finalNombreMiembro,
      },
      actorId: actor.uid || 'sistema',
      actorIdMiembros: user?.idMiembros ?? user?.id ?? null,
      actorNombre: actor.nombre,
      itemNombre: seAgregoCertificado
        ? `Certificado: ${vinculo.nombreItemAscenso}`
        : vinculo.nombreItemAscenso,
      itemContexto: contexto,
      ruta,
    }).catch(() => null);
  }

  return document;
};

export const listarProgresoAscensoMiembro = async (idMiembro) => {
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
    const groupId = progress.idGrupo;

    if (!itemId || !groupId) return;

    const node = {
      status: progress.estado || 'no_iniciado',
      completedDate: progress.fechaCompletado || null,
      timesCompleted: Number(progress.vecesCompletado || 0),
      certificate: toLocalCertificate(progress),
      updatedAt: progress.actualizadoEn || null,
    };

    if (system === 'sistemaAscenso') {
      const divisionId = progress.idDivision;
      if (!divisionId) return;

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

export const sincronizarProgresoAscensoFirebase = async (idMiembro) => {
  const progressList = await listarProgresoAscensoMiembro(idMiembro);
  const result = combinarProgresoAscensoEnCache(idMiembro, progressList);

  notifyAwardsProgressChanged(idMiembro);

  return result;
};

export const listarFavoritosAscensoMiembro = async (idMiembro) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembro) return {};

  const snap = await getDoc(
    doc(FIRESTORE, COLECCION_FAVORITOS_ASCENSO_MIEMBROS, String(idMiembro))
  ).catch(() => null);

  if (!snap?.exists?.()) return {};

  const data = snap.data() || {};

  return data.elementos || data.items || {};
};

export const guardarFavoritoAscensoMiembro = async ({
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
