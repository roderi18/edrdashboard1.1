import { ref, uploadBytes, uploadString, deleteObject, getDownloadURL } from 'firebase/storage';
import {
  doc,
  query,
  where,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { getMemberById } from 'src/services/member-service';
import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  getProgressId,
  normalizeIdSegment,
  guardarProgresoAscensoMiembro,
  buscarVinculoCertificadoAscenso,
  guardarVinculoCertificadoAscenso,
} from 'src/services/member-awards-service';

export const COLECCION_PLANTILLAS_CERTIFICADOS = 'plantillasCertificados';
export const COLECCION_LOTES_CERTIFICADOS = 'lotesCertificados';
export const COLECCION_CERTIFICADOS = 'certificados';
export const COLECCION_ESTADOS_CERTIFICADOS = 'estadosCertificadosMiembros';

const COLECCION_PLANTILLAS_CERTIFICADOS_LEGACY = 'certificateTemplates';
const COLECCION_LOTES_CERTIFICADOS_LEGACY = 'certificateBatches';
const COLECCION_CERTIFICADOS_LEGACY = 'certificates';
const COLECCION_ESTADOS_CERTIFICADOS_LEGACY = 'certificateMemberStatuses';

const getDataUrlContentType = (dataUrl = '') => {
  const match = String(dataUrl).match(/^data:([^;]+);/);

  return match?.[1] || 'image/jpeg';
};

const isRemoteUrl = (value = '') => /^https?:\/\//i.test(String(value));

const pickDate = (...values) =>
  values.find((value) => value && typeof value !== 'object') || new Date().toISOString();

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

const toLegacyCreator = (creator = {}) => ({
  uid: creator.uid || '',
  name: creator.nombre || '',
  email: creator.correo || '',
});

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

const getMemberCode = (member = {}) => String(member.memberId || member.codigoMiembro || '');

const getMemberDocId = (member = {}) =>
  String(member.id || member.idMiembros || member.memberDocId || member.idMiembro || '');

const readCollection = async (collectionName) => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(collection(FIRESTORE, collectionName)).catch(() => ({ docs: [] }));

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

const readCollections = async (...collectionNames) => {
  const groups = await Promise.all(
    collectionNames.map((collectionName) => readCollection(collectionName))
  );

  return groups.flat();
};

const dedupeById = (items = []) => {
  const map = new Map();

  items.forEach((item) => {
    const key = String(item.id || item.name || item.nombre || '');
    if (!key || map.has(key)) return;
    map.set(key, item);
  });

  return Array.from(map.values());
};

const normalizeTemplateForUi = (template = {}) => ({
  ...template,
  id: String(template.id || ''),
  name: template.name || template.nombre || 'Seguridad',
  dataUrl:
    template.dataUrl ||
    template.urlImagenVistaPrevia ||
    template.previewImageUrl ||
    template.urlPdfPlantilla ||
    '',
  pdfDataUrl: template.pdfDataUrl || template.pdfDataUrlPlantilla || '',
  previewImageUrl:
    template.previewImageUrl || template.urlImagenVistaPrevia || template.dataUrl || '',
  previewImagePath:
    template.previewImagePath || template.rutaImagenVistaPrevia || template.storagePath || '',
  storagePath:
    template.storagePath || template.rutaImagenVistaPrevia || template.previewImagePath || '',
  fields: Array.isArray(template.fields) ? template.fields : template.campos || [],
  positions: template.positions || template.posiciones || {},
  vinculoAscenso: template.vinculoAscenso || template.rutaAscenso || null,
  createdAt: pickDate(template.createdAt, template.creadoEn),
  updatedAt: template.updatedAt || template.actualizadoEn || '',
  createdBy: template.createdBy || toLegacyCreator(template.creadoPor),
  updatedBy: template.updatedBy || toLegacyCreator(template.actualizadoPor),
});

const normalizeCertificateForUi = (certificate = {}) => ({
  ...certificate,
  id: String(certificate.id || ''),
  batchId: certificate.batchId || certificate.idLote || '',
  memberDocId: String(certificate.memberDocId || certificate.idMiembro || ''),
  memberId: certificate.memberId || certificate.codigoMiembro || '',
  memberName: certificate.memberName || certificate.nombreMiembro || '',
  firstName: certificate.firstName || certificate.nombres || '',
  lastName: certificate.lastName || certificate.apellidos || '',
  memberDivision: certificate.memberDivision || certificate.divisionMiembro || '',
  certificateStatus: certificate.certificateStatus || certificate.estadoCertificado || '',
  courseId: certificate.courseId || certificate.idCurso || '',
  courseName: certificate.courseName || certificate.nombreCurso || '',
  certificateTitle:
    certificate.certificateTitle || certificate.tituloCertificado || certificate.nombreCurso || '',
  templateId: certificate.templateId || certificate.idPlantilla || '',
  templateName: certificate.templateName || certificate.nombrePlantilla || '',
  issuedAt: certificate.issuedAt || certificate.fechaEmision || '',
  pdfUrl: certificate.pdfUrl || certificate.urlPdf || '',
  pdfPath: certificate.pdfPath || certificate.rutaPdf || '',
  pdfSize: certificate.pdfSize || certificate.pesoPdf || 0,
  createdAt: certificate.createdAt || certificate.creadoEn || '',
  createdBy: certificate.createdBy || toLegacyCreator(certificate.creadoPor),
});

const normalizeBatchForUi = (batch = {}) => ({
  ...batch,
  id: String(batch.id || ''),
  course: batch.course || {
    id: batch.idCurso || '',
    name: batch.nombreCurso || batch.titulo || '',
    certificateTitle: batch.tituloCertificado || batch.nombreCurso || batch.titulo || '',
  },
  templateId: batch.templateId || batch.idPlantilla || '',
  templateName: batch.templateName || batch.nombrePlantilla || '',
  formValues: batch.formValues || batch.valoresFormulario || {},
  totalCertificates: batch.totalCertificates || batch.totalCertificados || 0,
  totalSize: batch.totalSize || batch.pesoTotal || 0,
  certificates: (batch.certificates || batch.certificados || []).map(normalizeCertificateForUi),
  createdAt: batch.createdAt || batch.creadoEn || '',
  updatedAt: batch.updatedAt || batch.actualizadoEn || '',
  createdBy: batch.createdBy || toLegacyCreator(batch.creadoPor),
});

const normalizeStatusForUi = (status = {}) => ({
  ...status,
  id: String(status.id || ''),
  scopeId: status.scopeId || status.idAlcance || '',
  memberDocId: String(status.memberDocId || status.idMiembro || ''),
  memberId: status.memberId || status.codigoMiembro || '',
  memberName: status.memberName || status.nombreMiembro || '',
  status: status.status || status.estado || 'presente',
  updatedAt: status.updatedAt || status.actualizadoEn || '',
  updatedBy: status.updatedBy || toLegacyCreator(status.actualizadoPor),
});

const toSpanishCertificate = ({
  certificateId,
  batchId = '',
  member = {},
  batch = {},
  pdfUrl,
  pdfPath,
  pdfSize,
  creator,
  now,
  origen = 'certificados',
  vinculo = null,
}) => ({
  id: certificateId,
  idLote: batchId,
  idMiembro: getMemberDocId(member),
  codigoMiembro: getMemberCode(member),
  nombreMiembro: getMemberName(member),
  nombreArchivo: `${normalizeIdSegment(
    batch?.course?.certificateTitle || batch?.course?.name || 'certificado'
  )}-${normalizeIdSegment(getMemberCode(member) || getMemberDocId(member))}.pdf`,
  nombres: member.firstName || member.nombres || '',
  apellidos: member.lastName || member.apellidos || '',
  divisionMiembro: member.memberDivision || member.divisionMiembro || '',
  estadoCertificado: member.certificateStatus || member.estadoCertificado || '',
  idCurso: batch?.course?.id || batch.idCurso || '',
  nombreCurso: batch?.course?.name || batch.nombreCurso || '',
  tituloCertificado:
    batch?.course?.certificateTitle || batch?.course?.name || batch.tituloCertificado || '',
  idPlantilla: batch?.templateId || batch.idPlantilla || '',
  nombrePlantilla: batch?.templateName || batch.nombrePlantilla || '',
  fechaEmision: batch?.formValues?.issuedAt || batch.fechaEmision || '',
  urlPdf: pdfUrl,
  rutaPdf: pdfPath,
  pesoPdf: Number(pdfSize || 0),
  origen,
  ...(vinculo?.idItemAscenso && {
    idProgresoAscenso: getProgressId(getMemberDocId(member), vinculo.idItemAscenso),
    idItemAscenso: vinculo.idItemAscenso,
    nombreItemAscenso: vinculo.nombreItemAscenso,
    sistema: vinculo.sistema,
    idDivision: vinculo.idDivision || '',
    nombreDivision: vinculo.nombreDivision || '',
    idGrupo: vinculo.idGrupo || '',
    nombreGrupo: vinculo.nombreGrupo || '',
  }),
  creadoPor: creator,
  creadoEn: now,
});

const buildTemplateAwardLink = ({ templateId, templateName, route }) => {
  if (!route?.idItemAscenso) return null;

  return {
    id: `${normalizeIdSegment(templateId)}_${normalizeIdSegment(route.idItemAscenso)}`,
    idPlantilla: templateId,
    nombrePlantilla: templateName,
    idCurso: templateId,
    nombreCurso: templateName,
    idItemAscenso: route.idItemAscenso,
    nombreItemAscenso: route.nombreItemAscenso,
    sistema: route.sistema,
    idDivision: route.idDivision || '',
    nombreDivision: route.nombreDivision || '',
    idGrupo: route.idGrupo || '',
    nombreGrupo: route.nombreGrupo || '',
    rutaTexto: route.rutaTexto || '',
    rutaIds: route.rutaIds || [],
    activo: true,
  };
};

export const listarPlantillasCertificados = async () => {
  const templates = await readCollections(
    COLECCION_PLANTILLAS_CERTIFICADOS,
    COLECCION_PLANTILLAS_CERTIFICADOS_LEGACY
  );

  return dedupeById(templates.map(normalizeTemplateForUi)).sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
};

export const guardarPlantillaCertificado = async ({ template, user } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !FIREBASE_STORAGE) {
    throw new Error('Firebase no esta configurado para guardar plantillas.');
  }

  const templateId = String(template?.id || `TPL-${Date.now()}`);
  const now = new Date().toISOString();
  const creator = getCreator(user);
  const templateName = template?.name || template?.nombre || 'Seguridad';
  const vinculoAscenso = buildTemplateAwardLink({
    templateId,
    templateName,
    route: template?.vinculoAscenso || template?.rutaAscenso,
  });
  let previewImageUrl =
    template?.previewImageUrl || template?.urlImagenVistaPrevia || template?.dataUrl || '';
  let previewImagePath = template?.previewImagePath || template?.rutaImagenVistaPrevia || '';

  if (template?.dataUrl && !isRemoteUrl(template.dataUrl)) {
    previewImagePath = `plantillas-certificados/${templateId}/vista-previa.jpg`;
    const storageRef = ref(FIREBASE_STORAGE, previewImagePath);

    await uploadString(storageRef, template.dataUrl, 'data_url', {
      contentType: getDataUrlContentType(template.dataUrl),
      customMetadata: {
        modulo: 'certificados',
        tipo: 'plantilla',
        idPlantilla: templateId,
      },
    });

    previewImageUrl = await getDownloadURL(storageRef);
  }

  const document = {
    id: templateId,
    nombre: templateName,
    urlImagenVistaPrevia: previewImageUrl,
    rutaImagenVistaPrevia: previewImagePath,
    pdfDataUrlPlantilla:
      template?.pdfDataUrl ||
      template?.pdfDataUrlPlantilla ||
      (!isRemoteUrl(template?.dataUrl) ? template?.dataUrl : ''),
    campos: Array.isArray(template?.fields) ? template.fields : template?.campos || [],
    posiciones: template?.positions || template?.posiciones || {},
    actualizadoEn: now,
    actualizadoPor: creator,
    creadoEn: template?.creadoEn || template?.createdAt || now,
    creadoPor: template?.creadoPor || template?.createdBy || creator,
    vinculoAscenso,
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_PLANTILLAS_CERTIFICADOS, templateId),
    { ...document, actualizadoEnServidor: serverTimestamp() },
    { merge: true }
  );

  if (vinculoAscenso) {
    await guardarVinculoCertificadoAscenso(vinculoAscenso);
  }

  return normalizeTemplateForUi(document);
};

export const eliminarPlantillaCertificado = async (template) => {
  if (!isFirebaseConfigured || !FIRESTORE || !template?.id) return;

  const storagePath =
    template.rutaImagenVistaPrevia || template.previewImagePath || template.storagePath;

  if (storagePath && FIREBASE_STORAGE) {
    await deleteObject(ref(FIREBASE_STORAGE, storagePath)).catch(() => null);
  }

  await Promise.all([
    deleteDoc(doc(FIRESTORE, COLECCION_PLANTILLAS_CERTIFICADOS, String(template.id))).catch(
      () => null
    ),
    deleteDoc(doc(FIRESTORE, COLECCION_PLANTILLAS_CERTIFICADOS_LEGACY, String(template.id))).catch(
      () => null
    ),
  ]);
};

export const listarLotesCertificados = async () => {
  const batches = await readCollections(
    COLECCION_LOTES_CERTIFICADOS,
    COLECCION_LOTES_CERTIFICADOS_LEGACY
  );

  return dedupeById(batches.map(normalizeBatchForUi)).sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
};

export const guardarLoteCertificados = async ({
  batch,
  certificateFiles = [],
  user,
  buildFinalBlob,
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !FIREBASE_STORAGE) {
    throw new Error('Firebase no esta configurado para guardar certificados.');
  }

  const batchId = String(batch?.id || `CERT-${Date.now()}`);
  const now = new Date().toISOString();
  const creator = getCreator(user, batch?.createdBy);
  const vinculo = await buscarVinculoCertificadoAscenso({
    idPlantilla: batch?.templateId,
    nombrePlantilla: batch?.templateName,
    idCurso: batch?.course?.id,
    nombreCurso: batch?.course?.name,
    tituloCertificado: batch?.course?.certificateTitle,
  });

  if (vinculo?.id) {
    await guardarVinculoCertificadoAscenso(vinculo).catch(() => null);
  }

  const certificates = await Promise.all(
    certificateFiles.map(async ({ member, blob, fileName }) => {
      const memberDocId = getMemberDocId(member);
      const memberCode = getMemberCode(member) || memberDocId || Date.now();
      const certificateId = `${batchId}-${normalizeIdSegment(memberCode)}`;
      const pdfPath = `certificados/${batchId}/${normalizeIdSegment(fileName || `${memberCode}.pdf`)}`;
      const storageRef = ref(FIREBASE_STORAGE, pdfPath);

      await uploadBytes(storageRef, blob, {
        contentType: 'application/pdf',
        customMetadata: {
          modulo: 'certificados',
          idLote: batchId,
          idMiembro: memberDocId,
          codigoMiembro: memberCode,
        },
      });

      let pdfUrl = await getDownloadURL(storageRef);
      const finalBlob = buildFinalBlob ? await buildFinalBlob({ member, pdfUrl }) : null;

      if (finalBlob) {
        await uploadBytes(storageRef, finalBlob, {
          contentType: 'application/pdf',
          customMetadata: {
            modulo: 'certificados',
            idLote: batchId,
            idMiembro: memberDocId,
            codigoMiembro: memberCode,
            final: 'true',
          },
        });
        pdfUrl = await getDownloadURL(storageRef);
      }

      const certificateDoc = toSpanishCertificate({
        certificateId,
        batchId,
        member,
        batch,
        pdfUrl,
        pdfPath,
        pdfSize: (finalBlob || blob)?.size,
        creator,
        now,
        vinculo,
      });

      await setDoc(
        doc(FIRESTORE, COLECCION_CERTIFICADOS, certificateId),
        { ...certificateDoc, creadoEnServidor: serverTimestamp() },
        { merge: true }
      );

      if (vinculo?.idItemAscenso) {
        await guardarProgresoAscensoMiembro({
          member,
          idMiembro: memberDocId,
          codigoMiembro: memberCode,
          nombreMiembro: getMemberName(member),
          vinculo,
          estado: 'completado',
          fechaCompletado: certificateDoc.fechaEmision || now,
          vecesCompletado: 1,
          certificado: certificateDoc,
          user,
        }).catch(() => null);
      }

      return normalizeCertificateForUi(certificateDoc);
    })
  );

  const batchDoc = {
    id: batchId,
    titulo: batch?.course?.certificateTitle || batch?.course?.name || '',
    idCurso: batch?.course?.id || '',
    nombreCurso: batch?.course?.name || '',
    tituloCertificado: batch?.course?.certificateTitle || batch?.course?.name || '',
    idPlantilla: batch?.templateId || '',
    nombrePlantilla: batch?.templateName || '',
    valoresFormulario: batch?.formValues || {},
    totalCertificados: certificates.length,
    pesoTotal: certificates.reduce(
      (total, certificate) => total + Number(certificate.pdfSize || 0),
      0
    ),
    certificados: certificates.map((certificate) => ({
      id: certificate.id,
      idMiembro: certificate.memberDocId,
      codigoMiembro: certificate.memberId,
      nombreMiembro: certificate.memberName,
      urlPdf: certificate.pdfUrl,
      rutaPdf: certificate.pdfPath,
      pesoPdf: certificate.pdfSize,
      estadoCertificado: certificate.certificateStatus,
      idItemAscenso: certificate.idItemAscenso || '',
    })),
    idsCertificados: certificates.map((certificate) => certificate.id),
    creadoPor: creator,
    creadoEn: batch?.createdAt || now,
    actualizadoEn: now,
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_LOTES_CERTIFICADOS, batchId),
    { ...batchDoc, actualizadoEnServidor: serverTimestamp() },
    { merge: true }
  );

  return normalizeBatchForUi(batchDoc);
};

export const guardarCertificadoAscensoManual = async ({
  idMiembro,
  sistema,
  context,
  metadata = {},
  certificate,
  user,
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !FIREBASE_STORAGE || !idMiembro || !certificate) {
    return null;
  }

  const member = (await getMemberById(idMiembro).catch(() => null)) || { id: idMiembro };
  const now = new Date().toISOString();
  const creator = getCreator(user);
  const vinculo = {
    id: `${sistema || 'academia'}_${context?.parentId || 'grupo'}_${context?.rowId || 'item'}`,
    idPlantilla: metadata.idPlantilla || '',
    nombrePlantilla: metadata.nombrePlantilla || '',
    idCurso: metadata.idCurso || '',
    nombreCurso: metadata.nombreCurso || '',
    idItemAscenso: context?.rowId || metadata.idItemAscenso || '',
    nombreItemAscenso: metadata.nombreItemAscenso || metadata.nombre || context?.rowName || '',
    sistema: sistema || 'academia',
    idDivision: context?.sectionId || metadata.idDivision || '',
    nombreDivision: metadata.nombreDivision || '',
    idGrupo: context?.parentId || metadata.idGrupo || '',
    nombreGrupo: metadata.nombreGrupo || '',
    activo: true,
  };

  const certificateId = `CERT-ASC-${Date.now()}-${normalizeIdSegment(idMiembro)}-${normalizeIdSegment(
    vinculo.idItemAscenso
  )}`;
  const fileName = certificate.name || `${vinculo.nombreItemAscenso || 'certificado'}.pdf`;
  const pdfPath = `certificados/ascenso/${normalizeIdSegment(idMiembro)}/${certificateId}-${normalizeIdSegment(
    fileName
  )}`;
  const storageRef = ref(FIREBASE_STORAGE, pdfPath);

  await uploadString(storageRef, certificate.fileBase64, 'data_url', {
    contentType: certificate.type || 'application/pdf',
    customMetadata: {
      modulo: 'certificados',
      origen: 'awards',
      idMiembro: String(idMiembro),
      idItemAscenso: vinculo.idItemAscenso,
    },
  });

  const pdfUrl = await getDownloadURL(storageRef);
  const certificateDoc = toSpanishCertificate({
    certificateId,
    member,
    batch: {
      course: {
        id: vinculo.idItemAscenso,
        name: vinculo.nombreItemAscenso,
        certificateTitle: vinculo.nombreItemAscenso,
      },
      templateId: metadata.idPlantilla || '',
      templateName: metadata.nombrePlantilla || '',
      formValues: { issuedAt: certificate.uploadedAt || now },
    },
    pdfUrl,
    pdfPath,
    pdfSize: certificate.size || 0,
    creator,
    now,
    origen: 'awards',
    vinculo,
  });

  await setDoc(
    doc(FIRESTORE, COLECCION_CERTIFICADOS, certificateId),
    { ...certificateDoc, creadoEnServidor: serverTimestamp() },
    { merge: true }
  );

  await guardarProgresoAscensoMiembro({
    member,
    idMiembro,
    codigoMiembro: getMemberCode(member),
    nombreMiembro: getMemberName(member),
    vinculo,
    estado: 'completado',
    fechaCompletado: certificate.uploadedAt || now,
    vecesCompletado: 1,
    certificado: certificateDoc,
    user,
  });

  return {
    id: certificateId,
    name: fileName,
    urlPdf: pdfUrl,
    pdfUrl,
    rutaPdf: pdfPath,
    fileBase64: certificate.fileBase64 || '',
    uploadedAt: certificate.uploadedAt || now,
  };
};

export const buscarCertificadosPorLote = async (batchId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !batchId) return [];

  const [spanishSnapshot, legacySnapshot] = await Promise.all([
    getDocs(
      query(collection(FIRESTORE, COLECCION_CERTIFICADOS), where('idLote', '==', String(batchId)))
    ).catch(() => ({ docs: [] })),
    getDocs(
      query(
        collection(FIRESTORE, COLECCION_CERTIFICADOS_LEGACY),
        where('batchId', '==', String(batchId))
      )
    ).catch(() => ({ docs: [] })),
  ]);

  return dedupeById(
    [...spanishSnapshot.docs, ...legacySnapshot.docs].map((item) =>
      normalizeCertificateForUi({ id: item.id, ...item.data() })
    )
  );
};

export const listarEstadosCertificados = async (scopeId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !scopeId) return [];

  const [spanishSnapshot, legacySnapshot] = await Promise.all([
    getDocs(
      query(
        collection(FIRESTORE, COLECCION_ESTADOS_CERTIFICADOS),
        where('idAlcance', '==', String(scopeId))
      )
    ).catch(() => ({ docs: [] })),
    getDocs(
      query(
        collection(FIRESTORE, COLECCION_ESTADOS_CERTIFICADOS_LEGACY),
        where('scopeId', '==', String(scopeId))
      )
    ).catch(() => ({ docs: [] })),
  ]);

  return dedupeById(
    [...spanishSnapshot.docs, ...legacySnapshot.docs].map((item) =>
      normalizeStatusForUi({ id: item.id, ...item.data() })
    )
  );
};

export const guardarEstadoCertificado = async ({ scopeId, member, status, user } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !scopeId || !member?.id || !status) {
    throw new Error('Firebase no esta configurado para guardar el estado.');
  }

  const memberDocId = getMemberDocId(member);
  const memberId = getMemberCode(member) || memberDocId;
  const statusId = `${normalizeIdSegment(scopeId)}-${normalizeIdSegment(memberDocId)}`;
  const now = new Date().toISOString();
  const document = {
    id: statusId,
    idAlcance: String(scopeId),
    idMiembro: memberDocId,
    codigoMiembro: memberId,
    nombreMiembro: getMemberName(member),
    estado: status,
    actualizadoEn: now,
    actualizadoPor: getCreator(user),
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_ESTADOS_CERTIFICADOS, statusId),
    { ...document, actualizadoEnServidor: serverTimestamp() },
    { merge: true }
  );

  return normalizeStatusForUi(document);
};
