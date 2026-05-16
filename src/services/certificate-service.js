import { ref, uploadBytes, uploadString, deleteObject, getDownloadURL } from 'firebase/storage';
import { doc, query, where, setDoc, getDocs, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

export const COLECCION_PLANTILLAS_CERTIFICADOS = 'certificateTemplates';
export const COLECCION_LOTES_CERTIFICADOS = 'certificateBatches';
export const COLECCION_CERTIFICADOS = 'certificates';
export const COLECCION_ESTADOS_CERTIFICADOS = 'certificateMemberStatuses';

const normalizeIdSegment = (value = '') =>
  String(value || 'archivo')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getDataUrlContentType = (dataUrl = '') => {
  const match = String(dataUrl).match(/^data:([^;]+);/);

  return match?.[1] || 'image/jpeg';
};

const isRemoteUrl = (value = '') => /^https?:\/\//i.test(String(value));

const getCreator = (user, fallbackName = 'Usuario') => ({
  uid: user?.uid || user?.id || '',
  name:
    user?.displayName ||
    user?.name ||
    [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
    user?.email ||
    user?.codigoMiembro ||
    fallbackName,
  email: user?.email || '',
});

export const listarPlantillasCertificados = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_PLANTILLAS_CERTIFICADOS));

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
};

export const guardarPlantillaCertificado = async ({ template, user } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !FIREBASE_STORAGE) {
    throw new Error('Firebase no esta configurado para guardar plantillas.');
  }

  const templateId = String(template?.id || `TPL-${Date.now()}`);
  const now = new Date().toISOString();
  let previewImageUrl = template?.previewImageUrl || template?.dataUrl || '';
  let previewImagePath = template?.previewImagePath || '';

  if (template?.dataUrl && !isRemoteUrl(template.dataUrl)) {
    previewImagePath = `certificate-templates/${templateId}/preview.jpg`;
    const storageRef = ref(FIREBASE_STORAGE, previewImagePath);

    await uploadString(storageRef, template.dataUrl, 'data_url', {
      contentType: getDataUrlContentType(template.dataUrl),
      customMetadata: {
        modulo: 'certificados',
        tipo: 'plantilla',
        templateId,
      },
    });

    previewImageUrl = await getDownloadURL(storageRef);
  }

  const document = {
    ...template,
    id: templateId,
    name: template?.name || 'Seguridad',
    dataUrl: previewImageUrl,
    pdfDataUrl: template?.pdfDataUrl || (!isRemoteUrl(template?.dataUrl) ? template?.dataUrl : ''),
    previewImageUrl,
    previewImagePath,
    storagePath: previewImagePath,
    fields: Array.isArray(template?.fields) ? template.fields : [],
    positions: template?.positions || {},
    updatedAt: now,
    updatedBy: getCreator(user),
    createdAt: template?.createdAt || now,
    createdBy: template?.createdBy || getCreator(user),
  };

  await setDoc(doc(FIRESTORE, COLECCION_PLANTILLAS_CERTIFICADOS, templateId), document, {
    merge: true,
  });

  return document;
};

export const eliminarPlantillaCertificado = async (template) => {
  if (!isFirebaseConfigured || !FIRESTORE || !template?.id) return;

  const storagePath = template.previewImagePath || template.storagePath;

  if (storagePath && FIREBASE_STORAGE) {
    await deleteObject(ref(FIREBASE_STORAGE, storagePath)).catch(() => null);
  }

  await deleteDoc(doc(FIRESTORE, COLECCION_PLANTILLAS_CERTIFICADOS, String(template.id)));
};

export const listarLotesCertificados = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_LOTES_CERTIFICADOS));

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
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

  const certificates = await Promise.all(
    certificateFiles.map(async ({ member, blob, fileName }) => {
      const memberId = String(member?.memberId || member?.codigoMiembro || member?.id || Date.now());
      const certificateId = `${batchId}-${normalizeIdSegment(memberId)}`;
      const pdfPath = `certificates/${batchId}/${normalizeIdSegment(fileName || `${memberId}.pdf`)}`;
      const storageRef = ref(FIREBASE_STORAGE, pdfPath);

      await uploadBytes(storageRef, blob, {
        contentType: 'application/pdf',
        customMetadata: {
          modulo: 'certificados',
          batchId,
          memberId,
        },
      });

      const pdfUrl = await getDownloadURL(storageRef);
      const finalBlob = buildFinalBlob ? await buildFinalBlob({ member, pdfUrl }) : null;

      if (finalBlob) {
        await uploadBytes(storageRef, finalBlob, {
          contentType: 'application/pdf',
          customMetadata: {
            modulo: 'certificados',
            batchId,
            memberId,
            final: 'true',
          },
        });
      }

      const certificateDoc = {
        id: certificateId,
        batchId,
        memberId,
        memberDocId: String(member?.id || ''),
        memberName: member?.memberName || member?.fullName || '',
        firstName: member?.firstName || '',
        lastName: member?.lastName || '',
        memberDivision: member?.memberDivision || '',
        certificateStatus: member?.certificateStatus || '',
        courseId: batch?.course?.id || '',
        courseName: batch?.course?.name || '',
        certificateTitle: batch?.course?.certificateTitle || batch?.course?.name || '',
        templateId: batch?.templateId || '',
        templateName: batch?.templateName || '',
        issuedAt: batch?.formValues?.issuedAt || '',
        pdfUrl,
        pdfPath,
        pdfSize: Number((finalBlob || blob)?.size || 0),
        createdBy: creator,
        createdAt: now,
      };

      await setDoc(doc(FIRESTORE, COLECCION_CERTIFICADOS, certificateId), certificateDoc);

      return certificateDoc;
    })
  );

  const batchDoc = {
    ...batch,
    id: batchId,
    totalCertificates: certificates.length,
    totalSize: certificates.reduce((total, certificate) => total + Number(certificate.pdfSize || 0), 0),
    certificates,
    createdBy: creator,
    createdAt: batch?.createdAt || now,
    updatedAt: now,
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_LOTES_CERTIFICADOS, batchId),
    { ...batchDoc, updatedAtServer: serverTimestamp() },
    { merge: true }
  );

  return batchDoc;
};

export const buscarCertificadosPorLote = async (batchId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !batchId) return [];

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCION_CERTIFICADOS), where('batchId', '==', String(batchId)))
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const listarEstadosCertificados = async (scopeId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !scopeId) return [];

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_ESTADOS_CERTIFICADOS),
      where('scopeId', '==', String(scopeId))
    )
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const guardarEstadoCertificado = async ({ scopeId, member, status, user } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !scopeId || !member?.id || !status) {
    throw new Error('Firebase no esta configurado para guardar el estado.');
  }

  const memberDocId = String(member.id);
  const memberId = String(member.memberId || member.codigoMiembro || memberDocId);
  const statusId = `${normalizeIdSegment(scopeId)}-${normalizeIdSegment(memberDocId)}`;
  const now = new Date().toISOString();
  const document = {
    id: statusId,
    scopeId: String(scopeId),
    memberDocId,
    memberId,
    memberName: member.memberName || member.fullName || '',
    status,
    updatedAt: now,
    updatedBy: getCreator(user),
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_ESTADOS_CERTIFICADOS, statusId),
    { ...document, updatedAtServer: serverTimestamp() },
    { merge: true }
  );

  return document;
};
