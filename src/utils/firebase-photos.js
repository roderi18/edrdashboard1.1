import { ref, deleteObject } from 'firebase/storage';
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

const asegurarFirebaseFotos = () => {
  if (!isFirebaseConfigured || !FIRESTORE || !FIREBASE_STORAGE) {
    throw new Error('Firebase no está configurado en este entorno.');
  }
};

const carpetaDeEntidad = (tipoEntidad) => {
  const folder = PHOTO_FOLDERS[tipoEntidad];

  if (!folder) throw new Error(`Tipo de entidad no soportado: ${tipoEntidad}`);

  return folder;
};

/**
 * Deja constancia en Firestore de que una imagen YA SUBIDA es la foto principal
 * de una entidad. Separado de la subida porque no siempre ocurren a la vez: al
 * crear un miembro la foto se sube al elegirla, cuando todavia no hay id al que
 * colgarla, y solo se registra cuando el alta devuelve el id.
 */
export async function registrarFotoEntidadSubida({
  tipoEntidad,
  idEntidad,
  tipoFoto = 'perfil',
  rutaArchivo,
  urlFoto,
  subidoPor,
}) {
  asegurarFirebaseFotos();

  if (!tipoEntidad || !idEntidad)
    throw new Error('No se pudo identificar a quién pertenece la foto.');
  if (!urlFoto) throw new Error('La foto no tiene una dirección válida.');

  carpetaDeEntidad(tipoEntidad);

  const documentId = getPhotoDocumentId({ tipoEntidad, idEntidad, tipoFoto });
  const payload = {
    tipoEntidad,
    idEntidad: String(idEntidad),
    rutaArchivo: rutaArchivo || '',
    urlFoto,
    tipoFoto,
    esPrincipal: true,
    subidoPor: subidoPor || null,
    estado: 'activo',
    actualizadoEn: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COLLECTION_NAME, documentId),
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

export async function subirFotoEntidad({
  file,
  tipoEntidad,
  idEntidad,
  tipoFoto = 'perfil',
  subidoPor,
}) {
  asegurarFirebaseFotos();

  if (!file) throw new Error('Selecciona una foto para subir.');
  if (!tipoEntidad || !idEntidad)
    throw new Error('No se pudo identificar a quién pertenece la foto.');

  const folder = carpetaDeEntidad(tipoEntidad);
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

  return registrarFotoEntidadSubida({
    tipoEntidad,
    idEntidad,
    tipoFoto,
    rutaArchivo: uploadResult.storagePath,
    urlFoto: uploadResult.downloadUrl,
    subidoPor,
  });
}

/**
 * Sube una foto PROPUESTA, sin tocar la que esta en uso.
 *
 * La sube quien puede sugerir el cambio pero no aplicarlo —el Coordinador de
 * Destacamento y su Asistente—, asi que no se registra como principal: hasta que
 * la Oficina Nacional la apruebe, la foto oficial sigue siendo la de antes.
 *
 * Va a `propuestas/<carpeta>/<id>/<marca de tiempo>/perfil.webp`, FUERA de la
 * carpeta de la entidad. Ahi las reglas de Storage no piden permiso sobre la
 * foto de la entidad —sugerirla no es cambiarla, y quien sugiere no tiene ese
 * permiso ni le hace falta—, y con una carpeta por propuesta una segunda
 * sugerencia no pisa a la anterior ni a la que ya se aprobo.
 */
export async function subirFotoEntidadPropuesta({ file, tipoEntidad, idEntidad, subidoPor }) {
  asegurarFirebaseFotos();

  if (!file) throw new Error('Selecciona una foto para subir.');
  if (!tipoEntidad || !idEntidad)
    throw new Error('No se pudo identificar a quién pertenece la foto.');

  const folder = carpetaDeEntidad(tipoEntidad);
  const uploadResult = await uploadOptimizedImage({
    file,
    preset: 'avatar',
    storagePath: `propuestas/${folder}/${idEntidad}/${Date.now()}/perfil.webp`,
    metadata: {
      tipoEntidad,
      idEntidad: String(idEntidad),
      tipoFoto: 'perfil',
      esPropuesta: 'true',
      subidoPor: subidoPor || '',
    },
  });

  return { rutaArchivo: uploadResult.storagePath, urlFoto: uploadResult.downloadUrl };
}

/**
 * Borra un archivo subido que ya no va a usarse.
 *
 * Se usa con las fotos PROPUESTAS que se rechazan: nada las referencia, pero se
 * quedarian ocupando sitio para siempre. Si el borrado no se puede hacer —las
 * reglas de Storage no se lo permiten a quien resuelve— no se convierte en un
 * error: la resolucion ya esta escrita y un archivo huerfano no la invalida.
 */
export async function eliminarArchivoDeStorage(rutaArchivo) {
  const ruta = String(rutaArchivo || '').trim();

  if (!ruta || !isFirebaseConfigured || !FIREBASE_STORAGE) return false;

  try {
    await deleteObject(ref(FIREBASE_STORAGE, ruta));

    return true;
  } catch (error) {
    console.warn('[fotos] no se pudo borrar el archivo propuesto', ruta, error);

    return false;
  }
}

/**
 * Sube la foto de un miembro que TODAVIA no existe.
 *
 * Al crear, la persona no tiene id hasta que el alta vuelve del API, asi que la
 * imagen se guarda bajo un id provisional y NO se escribe documento: no hay
 * miembro al que referirlo. La subida ocurre mientras se termina de llenar el
 * formulario, y al guardar solo queda registrarla —una escritura— en vez de
 * esperar a que suba la imagen entera.
 *
 * El id provisional es un segmento mas de la ruta (`miembros/<id>/perfil.webp`),
 * de modo que las reglas de Storage lo tratan igual que cualquier otra foto de
 * miembro.
 */
export async function subirFotoMiembroPendiente({ file, subidoPor }) {
  asegurarFirebaseFotos();

  if (!file) throw new Error('Selecciona una foto para subir.');

  const idTemporal = `pendiente-${
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;
  const uploadResult = await uploadOptimizedImage({
    file,
    preset: 'avatar',
    storagePath: `${PHOTO_FOLDERS.miembro}/${idTemporal}/perfil.webp`,
    metadata: {
      tipoEntidad: 'miembro',
      idEntidad: idTemporal,
      tipoFoto: 'perfil',
      subidoPor: subidoPor || '',
    },
  });

  return {
    idTemporal,
    rutaArchivo: uploadResult.storagePath,
    urlFoto: uploadResult.downloadUrl,
    originalSizeBytes: uploadResult.originalSizeBytes,
    optimizedSizeBytes: uploadResult.optimizedSizeBytes,
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
