import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { sonarAviso } from 'src/utils/sonidos-de-aviso.mjs';
import { bloquePorId } from 'src/utils/everest/bloques.mjs';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { CARPETA_MEDIOS_EVEREST } from 'src/utils/everest/colecciones.mjs';
import { TOPE_DE_VIDEO_EN_MB, TIPOS_DE_VIDEO_ADMITIDOS } from 'src/utils/firebase-photos';

import { FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LAS FOTOS Y VIDEOS QUE SE SUBEN DESDE EVEREST DESIGNER.
//
// Van a `everest/<bloque>/<marca de tiempo>`, y NUNCA a la carpeta de las
// tarjetas de hoy (`principal-tarjetas/`): subir un fondo nuevo para un borrador
// no puede cambiar la foto que la portada esta enseñando ahora. Cada subida lleva
// su marca de tiempo, asi que tampoco pisa la de un borrador anterior ni la de
// una version publicada que se quiera recuperar.
//
// Subir no publica nada: devuelve la direccion, que el editor guarda en el
// borrador. Se ve en la portada cuando se publica el bloque.
//
// No hay registro en Firestore (`fotos`): la direccion vive dentro del propio
// bloque, que es donde se usa.
// ----------------------------------------------------------------------

const TIPO_POR_EXTENSION = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// Windows no siempre le pone tipo a un .mp4: entonces se deduce por la extension.
const tipoDeArchivo = (archivo) =>
  archivo?.type ||
  TIPO_POR_EXTENSION[
    String(archivo?.name || '')
      .split('.')
      .pop()
      .toLowerCase()
  ] ||
  '';

/**
 * Sube el fondo de un bloque. Devuelve `{ url, tipo }` para guardar en el
 * borrador, con `tipo` 'imagen' o 'video'.
 */
export async function subirMedioDeBloque({ idBloque, archivo, aceptaVideo = false, usuario }) {
  if (!isFirebaseConfigured || !FIREBASE_STORAGE) {
    throw new Error('Firebase Storage no está configurado.');
  }

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global sube archivos en EVEREST Designer.');
  }

  const bloque = bloquePorId(idBloque);

  if (!bloque || bloque.externo) {
    throw new Error(`"${idBloque}" no es un bloque que se edite en el Designer.`);
  }

  if (!archivo) throw new Error('Elige un archivo.');

  const tipo = tipoDeArchivo(archivo);
  const marca = Date.now();

  if (tipo.startsWith('video/')) {
    if (!aceptaVideo) throw new Error('Esta tarjeta solo admite imágenes.');
    if (tipo === 'video/quicktime') {
      throw new Error('Los videos .mov no se ven en todos los navegadores: expórtalo a MP4.');
    }
    if (!TIPOS_DE_VIDEO_ADMITIDOS.includes(tipo)) {
      throw new Error('El video tiene que ser MP4 o WebM.');
    }
    if (archivo.size > TOPE_DE_VIDEO_EN_MB * 1024 * 1024) {
      throw new Error(`El video pesa demasiado: el máximo es ${TOPE_DE_VIDEO_EN_MB} MB.`);
    }

    // El nombre termina en `-video.mp4`: la regla de Storage distingue asi un
    // video de una imagen.
    const extension = tipo === 'video/webm' ? 'webm' : 'mp4';
    const destino = ref(
      FIREBASE_STORAGE,
      `${CARPETA_MEDIOS_EVEREST}/${idBloque}/${marca}-video.${extension}`
    );

    await uploadBytes(destino, archivo, {
      contentType: tipo,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    sonarAviso('archivoSubido');

    return { url: await getDownloadURL(destino), tipo: 'video' };
  }

  if (!tipo.startsWith('image/')) {
    throw new Error(
      aceptaVideo
        ? 'Elige una imagen o un video MP4 o WebM.'
        : 'Elige una imagen (JPG, PNG o WebP).'
    );
  }

  // Optimizada como portada: con el preset de foto de perfil quedaba en 900 px de
  // ancho y una tarjeta que mide casi la pantalla la estiraba pixelada.
  const subida = await uploadOptimizedImage({
    file: archivo,
    preset: 'portada',
    storagePath: `${CARPETA_MEDIOS_EVEREST}/${idBloque}/${marca}.webp`,
  });

  return { url: subida.downloadUrl, tipo: 'imagen' };
}
