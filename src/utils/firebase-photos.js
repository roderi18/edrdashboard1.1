import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
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
import { leerConCache, invalidarLecturas, avisarAOtrasSesiones } from 'src/utils/cache-de-lecturas.mjs';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const COLLECTION_NAME = 'fotos';

const PHOTO_FOLDERS = {
  miembro: 'miembros',
  destacamento: 'destacamentos',
  seccion: 'secciones',
  region: 'regiones',
  // Las imagenes de las tarjetas de la pantalla Principal, que pone el
  // Administrador Global. Carpeta propia y no `principal/`, que es la de las
  // fotos de las publicaciones del muro: aquella tiene `allow update: if false`
  // —una publicacion no se reedita— y aqui la imagen se reemplaza cada vez que
  // se cambia.
  principalTarjeta: 'principal-tarjetas',
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
  urlFotoMiniatura = '',
  subidoPor,
  // 'imagen' o 'video'. Se escribe SIEMPRE, tambien al subir una imagen: el
  // registro se guarda con `merge`, y sin pisarlo una imagen nueva heredaba el
  // 'video' de la anterior y se intentaba reproducir.
  tipoMedio = 'imagen',
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
    // La misma cara, pero para listas. Vacia en las fotos de antes: quien la lee
    // se queda con `urlFoto`, que siempre esta.
    urlFotoMiniatura: urlFotoMiniatura || '',
    tipoMedio,
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
  // Las listas llevan la foto dentro (regiones, secciones, destacamentos): toda
  // lectura guardada puede traer la de antes.
  invalidarLecturas();
  avisarAOtrasSesiones('fotos:', 'regiones:', 'secciones:', 'destacamentos:', 'principal-tarjeta:');

  const cacheKey = getFotosCacheKey({ tipoEntidad, tipoFoto });
  const fotosEnCache = fotosPrincipalesCache.get(cacheKey);
  if (fotosEnCache) {
    fotosPrincipalesCache.set(cacheKey, {
      ...fotosEnCache,
      [String(idEntidad)]: { id: documentId, ...payload },
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('foto-principal-actualizada', {
        detail: {
          tipoEntidad,
          idEntidad: String(idEntidad),
          tipoFoto,
          foto: { id: documentId, ...payload },
        },
      })
    );
  }

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
  // `avatar` por defecto porque casi todo lo que pasa por aqui es una cara. Las
  // portadas anchas piden `portada`: con `avatar` quedaban en 900px de ancho.
  preset = 'avatar',
}) {
  asegurarFirebaseFotos();

  if (!file) throw new Error('Selecciona una foto para subir.');
  if (!tipoEntidad || !idEntidad)
    throw new Error('No se pudo identificar a quién pertenece la foto.');

  const folder = carpetaDeEntidad(tipoEntidad);
  // Cada reemplazo usa una ruta nueva: la imagen lleva cache immutable por un
  // año, y reutilizar la misma ruta podía dejar la foto anterior en el navegador.
  const version =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const basePath = `${folder}/${idEntidad}/${tipoFoto}-${version}.webp`;
  const metadatos = {
    tipoEntidad,
    idEntidad: String(idEntidad),
    tipoFoto,
    subidoPor: subidoPor || '',
  };

  // DOS TAMAÑOS, DE UNA VEZ.
  //
  // La grande es la que se ve al abrir la ficha. La pequeña es para las listas
  // —el buscador del chat, los contactos—, donde la cara se dibuja a 40px y
  // bajarse 300 kB por cada persona no tiene ningun sentido.
  const [uploadResult, miniatura] = await Promise.all([
    uploadOptimizedImage({ file, preset, storagePath: basePath, metadata: metadatos }),
    uploadOptimizedImage({
      file,
      preset: 'miniatura',
      storagePath: `${folder}/${idEntidad}/${tipoFoto}-mini-${version}.webp`,
      metadata: { ...metadatos, variante: 'miniatura' },
      // Si la miniatura falla, la foto se sube igual: es una comodidad, no un
      // requisito. Sin ella las listas usan la grande, como hasta ahora.
    }).catch(() => null),
  ]);

  return registrarFotoEntidadSubida({
    tipoEntidad,
    idEntidad,
    tipoFoto,
    rutaArchivo: uploadResult.storagePath,
    urlFoto: uploadResult.downloadUrl,
    urlFotoMiniatura: miniatura?.downloadUrl || '',
    subidoPor,
  });
}

// Lo que admite la regla de Storage de `principal-tarjetas`. MP4 y WebM porque son
// los que reproducen todos los navegadores; el .mov de un iPhone no se ve en
// Chrome ni en Windows.
export const TIPOS_DE_VIDEO_ADMITIDOS = ['video/mp4', 'video/webm'];
export const TOPE_DE_VIDEO_EN_MB = 20;

/**
 * Sube un VIDEO como medio principal de una entidad.
 *
 * Tal cual, sin optimizar: en el navegador no hay forma razonable de
 * recomprimir un video, asi que el tope de tamaño hace de freno. Va a una ruta
 * distinta de la imagen (`<tipoFoto>-video.mp4`) para que la regla de Storage
 * pueda distinguirlos por el nombre.
 */
export async function subirVideoEntidad({
  file,
  // El tipo ya resuelto por quien llama. `file.type` llega vacio en algunos
  // Windows, y sin tipo la regla de Storage rechaza el video.
  tipoMime = file?.type,
  tipoEntidad,
  idEntidad,
  tipoFoto = 'portada',
  subidoPor,
}) {
  asegurarFirebaseFotos();

  if (!file) throw new Error('Selecciona un video para subir.');
  if (tipoMime === 'video/quicktime') {
    throw new Error('Los videos .mov no se ven en todos los navegadores: expórtalo a MP4.');
  }
  if (!TIPOS_DE_VIDEO_ADMITIDOS.includes(tipoMime)) {
    throw new Error('El video tiene que ser MP4 o WebM.');
  }
  if (file.size > TOPE_DE_VIDEO_EN_MB * 1024 * 1024) {
    throw new Error(`El video pesa demasiado: el máximo es ${TOPE_DE_VIDEO_EN_MB} MB.`);
  }

  const folder = carpetaDeEntidad(tipoEntidad);
  const extension = tipoMime === 'video/webm' ? 'webm' : 'mp4';
  const storagePath = `${folder}/${idEntidad}/${tipoFoto}-video.${extension}`;
  const storageRef = ref(FIREBASE_STORAGE, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: tipoMime,
    // Mismo motivo que en las imagenes: al reemplazarlo Storage da otra
    // direccion, asi que guardarlo para siempre no sirve el viejo.
    cacheControl: 'public, max-age=31536000, immutable',
    customMetadata: {
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
    rutaArchivo: storagePath,
    urlFoto: await getDownloadURL(storageRef),
    subidoPor,
    tipoMedio: 'video',
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

// Ultimo resultado de cada consulta de fotos. Volver a una lista la remontaba
// con las fotos en blanco hasta que Firestore respondia otra vez, y las caras
// "pestaneaban"; con esto la vista puede pintar ya lo ultimo que vio.
const fotosPrincipalesCache = new Map();

const getFotosCacheKey = ({ tipoEntidad, tipoFoto }) => `${tipoEntidad}|${tipoFoto}`;

export function obtenerFotosPrincipalesEnCache({ tipoEntidad, tipoFoto = 'perfil' }) {
  if (!tipoEntidad) return null;

  return fotosPrincipalesCache.get(getFotosCacheKey({ tipoEntidad, tipoFoto })) || null;
}

// Pasa por la caché de lecturas: cada lista y cada organigrama pedía TODAS las
// fotos de su tipo en cada visita. Subir una foto la invalida.
export async function obtenerFotosPrincipalesPorEntidad({ tipoEntidad, tipoFoto = 'perfil' }) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return {};
  }

  if (!tipoEntidad) return {};

  return leerConCache(`fotos:${getFotosCacheKey({ tipoEntidad, tipoFoto })}`, () =>
    leerFotosPrincipales({ tipoEntidad, tipoFoto })
  );
}

async function leerFotosPrincipales({ tipoEntidad, tipoFoto }) {
  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLLECTION_NAME), where('tipoEntidad', '==', tipoEntidad))
  );

  const fotos = Object.fromEntries(
    snapshot.docs
      .map((photoDoc) => ({
        id: photoDoc.id,
        ...photoDoc.data(),
      }))
      .filter((photo) => photo.tipoFoto === tipoFoto && photo.estado === 'activo')
      .map((photo) => [String(photo.idEntidad), photo])
  );

  fotosPrincipalesCache.set(getFotosCacheKey({ tipoEntidad, tipoFoto }), fotos);

  return fotos;
}
