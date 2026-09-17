import { ref, listAll, uploadBytes, getDownloadURL } from 'firebase/storage';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { sonarAviso } from 'src/utils/sonidos-de-aviso.mjs';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { bloquePorId, bloquesPublicablesDe } from 'src/utils/everest/bloques.mjs';
import { TOPE_DE_VIDEO_EN_MB, TIPOS_DE_VIDEO_ADMITIDOS } from 'src/utils/firebase-photos';
import { PANTALLAS_EVEREST, CARPETA_MEDIOS_EVEREST } from 'src/utils/everest/colecciones.mjs';

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

// ----------------------------------------------------------------------
// LA BIBLIOTECA DE MEDIOS (fase 8).
//
// Todo lo que ya se subio desde el Designer, para volver a usarlo sin subirlo
// otra vez: la foto de la campaña del año pasado, el video de la investidura. Se
// lee de la propia carpeta de Storage —una por bloque—, y no de un registro
// aparte en Firestore que habria que mantener al dia con cada subida.
// ----------------------------------------------------------------------

const MAXIMO_EN_BIBLIOTECA = 80;

/** El instante de subida sale del nombre (`<marca>.webp`, `<marca>-video.mp4`). */
const marcaDelNombre = (nombre) => Number(String(nombre).split(/[.-]/)[0]) || 0;

/**
 * `[{ url, tipo, idBloque, nombre, subidoEn }]`, lo mas nuevo primero.
 * `tipos` filtra (la bienvenida solo admite imagenes).
 */
export async function listarBibliotecaDeMedios({ usuario, tipos = ['imagen', 'video'] } = {}) {
  if (!isFirebaseConfigured || !FIREBASE_STORAGE) return [];

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global usa la biblioteca de EVEREST Designer.');
  }

  const carpetas = await Promise.all(
    bloquesPublicablesDe(PANTALLAS_EVEREST.principal).map(async (bloque) => {
      // Una carpeta que aun no existe no es un error: ese bloque no tiene medios.
      const lista = await listAll(
        ref(FIREBASE_STORAGE, `${CARPETA_MEDIOS_EVEREST}/${bloque.id}`)
      ).catch(() => ({ items: [] }));

      return lista.items.map((item) => ({ item, idBloque: bloque.id }));
    })
  );

  const archivos = carpetas
    .flat()
    .map(({ item, idBloque }) => ({
      item,
      idBloque,
      nombre: item.name,
      tipo: /-video\.(mp4|webm)$/.test(item.name) ? 'video' : 'imagen',
      subidoEn: marcaDelNombre(item.name),
    }))
    .filter((archivo) => tipos.includes(archivo.tipo))
    .sort((a, b) => b.subidoEn - a.subidoEn)
    .slice(0, MAXIMO_EN_BIBLIOTECA);

  const conDireccion = await Promise.all(
    archivos.map(async ({ item, ...archivo }) => ({
      ...archivo,
      url: await getDownloadURL(item).catch(() => ''),
    }))
  );

  return conDireccion.filter((archivo) => archivo.url);
}
