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

import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const COLLECTION_NAME = 'fotos';

const PHOTO_FOLDERS = {
  miembro: 'miembros',
  destacamento: 'destacamentos',
  seccion: 'secciones',
  region: 'regiones',
};

const getPhotoDocumentId = ({ tipoEntidad, idEntidad, tipoFoto = 'perfil' }) =>
  `${tipoEntidad}_${idEntidad}_${tipoFoto}`;

export async function subirFotoEntidad({
  file,
  tipoEntidad,
  idEntidad,
  tipoFoto = 'perfil',
  subidoPor,
}) {
  if (!isFirebaseConfigured || !FIRESTORE || !FIREBASE_STORAGE) {
    throw new Error('Firebase no está configurado en este entorno.');
  }

  if (!file) throw new Error('Selecciona una foto para subir.');
  if (!tipoEntidad || !idEntidad)
    throw new Error('No se pudo identificar a quién pertenece la foto.');

  const folder = PHOTO_FOLDERS[tipoEntidad];

  if (!folder) throw new Error(`Tipo de entidad no soportado: ${tipoEntidad}`);

  const basePath = `${folder}/${idEntidad}/${tipoFoto}.webp`;
  const uploadResult = await uploadOptimizedImage({
    file,
    preset: 'avatar',
    storagePath: basePath,
    metadata: {
      tipoEntidad,
      idEntidad: String(idEntidad),
      tipoFoto,
      subidoPor: subidoPor || '',
    },
  });
  const rutaArchivo = uploadResult.storagePath;
  const urlFoto = uploadResult.downloadUrl;
  const documentId = getPhotoDocumentId({ tipoEntidad, idEntidad, tipoFoto });
  const photoRef = doc(FIRESTORE, COLLECTION_NAME, documentId);

  const payload = {
    tipoEntidad,
    idEntidad: String(idEntidad),
    rutaArchivo,
    urlFoto,
    tipoFoto,
    esPrincipal: true,
    subidoPor: subidoPor || null,
    estado: 'activo',
    actualizadoEn: serverTimestamp(),
  };

  await setDoc(
    photoRef,
    {
      ...payload,
      creadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: documentId,
    ...payload,
  };
}

export async function obtenerFotoPrincipal({ tipoEntidad, idEntidad, tipoFoto = 'perfil' }) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return null;
  }

  if (!tipoEntidad || !idEntidad) return null;

  const documentId = getPhotoDocumentId({ tipoEntidad, idEntidad, tipoFoto });
  const snapshot = await getDoc(doc(FIRESTORE, COLLECTION_NAME, documentId));

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function obtenerFotosPrincipalesPorEntidad({ tipoEntidad, tipoFoto = 'perfil' }) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return {};
  }

  if (!tipoEntidad) return {};

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLLECTION_NAME), where('tipoEntidad', '==', tipoEntidad))
  );

  return Object.fromEntries(
    snapshot.docs
      .map((photoDoc) => ({
        id: photoDoc.id,
        ...photoDoc.data(),
      }))
      .filter((photo) => photo.tipoFoto === tipoFoto && photo.estado === 'activo')
      .map((photo) => [String(photo.idEntidad), photo])
  );
}
