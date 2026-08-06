import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { optimizeImageFile } from 'src/utils/image-optimizer';

import { AUTH, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

const sanitizeStorageSegment = (value = '') =>
  String(value || 'archivo')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildStorageFileName = (file, index = 0) =>
  `${Date.now()}-${index}-${sanitizeStorageSegment(file?.name)}`;

const optimizeAttachmentIfNeeded = (file) => {
  const isImage = String(file?.type || '').startsWith('image/');

  if (!isImage) {
    return file;
  }

  return optimizeImageFile(file, {
    maxWidth: 2200,
    maxHeight: 2200,
    quality: 0.94,
    mimeType: 'image/webp',
  });
};

export async function uploadFilesToStorage({
  files = [],
  storagePathBuilder,
  metadataBuilder,
} = {}) {
  if (!files.length) {
    return [];
  }

  if (!isFirebaseConfigured || !FIREBASE_STORAGE) {
    throw new Error('Firebase Storage no esta configurado en este entorno.');
  }

  const uploaderUid = String(AUTH?.currentUser?.uid ?? '').trim();

  if (!uploaderUid) {
    throw new Error('La sesión autenticada es necesaria para subir archivos al chat.');
  }

  return Promise.all(
    files.map(async (file, index) => {
      const finalFile = await optimizeAttachmentIfNeeded(file);
      const storagePath = storagePathBuilder?.(finalFile, index);

      if (!storagePath) {
        throw new Error('No se proporciono una ruta de Storage para el archivo.');
      }

      const storageRef = ref(FIREBASE_STORAGE, storagePath);

      await uploadBytes(storageRef, finalFile, {
        contentType: finalFile?.type || file?.type || 'application/octet-stream',
        customMetadata: {
          ...(metadataBuilder?.(finalFile, index) || {}),
          uploaderUid,
        },
      });

      const downloadUrl = await getDownloadURL(storageRef);

      return {
        id: `${sanitizeStorageSegment(finalFile.name)}-${finalFile.lastModified || Date.now()}-${index}`,
        nombre: finalFile.name,
        nombreOriginal: file.name,
        tipo: finalFile.type || file.type || 'application/octet-stream',
        tamano: finalFile.size || file.size || 0,
        tamanoOriginal: file.size || 0,
        optimizado: finalFile.size < file.size,
        fechaCarga: new Date().toISOString(),
        origen: 'producto_restringido',
        almacenamiento: 'firebase',
        storagePath,
        url: downloadUrl,
        downloadURL: downloadUrl,
      };
    })
  );
}
