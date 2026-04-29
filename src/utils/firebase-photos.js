import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

const getFileExtension = (file) => {
  const extensionFromName = file?.name?.split('.').pop()?.toLowerCase();

  if (extensionFromName) return extensionFromName;

  return file?.type?.split('/').pop()?.toLowerCase() || 'jpg';
};

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

  const extension = getFileExtension(file);
  const rutaArchivo = `${folder}/${idEntidad}/${tipoFoto}.${extension}`;
  const storageRef = ref(FIREBASE_STORAGE, rutaArchivo);

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'image/jpeg',
    customMetadata: {
      tipoEntidad,
      idEntidad: String(idEntidad),
      tipoFoto,
      subidoPor: subidoPor || '',
    },
  });

  const urlFoto = await getDownloadURL(storageRef);
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
