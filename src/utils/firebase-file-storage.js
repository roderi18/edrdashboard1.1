import { ref, deleteObject, getDownloadURL, uploadBytesResumable } from 'firebase/storage';

import { optimizeImageFile } from 'src/utils/image-optimizer';

import { AUTH, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

const CHAT_STORAGE_PATH_PATTERN =
  /^chat\/[a-zA-Z0-9_-]{1,160}\/(?:imagenes|archivos)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/;

const sanitizeStorageSegment = (value = '') =>
  String(value || 'archivo')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildStorageFileName = (file, index = 0) =>
  `${Date.now()}-${index}-${sanitizeStorageSegment(file?.name)}`;

export const isSafeChatStoragePath = (storagePath) =>
  CHAT_STORAGE_PATH_PATTERN.test(String(storagePath || '').trim());

export class ChatFileUploadError extends Error {
  constructor(message, { code = 'chat/upload-failed', cancelled = false, cause } = {}) {
    super(message, { cause });
    this.name = 'ChatFileUploadError';
    this.code = code;
    this.cancelled = cancelled;
    this.recoverable = true;
  }
}

export const normalizeChatUploadError = (error) => {
  if (error instanceof ChatFileUploadError) return error;

  const cancelled = error?.code === 'storage/canceled' || error?.name === 'AbortError';

  return new ChatFileUploadError(
    cancelled
      ? 'La carga fue cancelada. Puedes intentarlo nuevamente.'
      : 'No se pudo completar la carga. Revisa tu conexión e inténtalo nuevamente.',
    {
      code: cancelled ? 'chat/upload-cancelled' : error?.code || 'chat/upload-failed',
      cancelled,
      cause: error,
    }
  );
};

const optimizeAttachmentIfNeeded = (file) => {
  const isImage = String(file?.type || '').startsWith('image/');

  if (!isImage) return file;

  return optimizeImageFile(file, {
    maxWidth: 2200,
    maxHeight: 2200,
    quality: 0.94,
    mimeType: 'image/webp',
  });
};

const removeStoragePath = async (storagePath) => {
  if (!FIREBASE_STORAGE || !isSafeChatStoragePath(storagePath)) return false;

  try {
    await deleteObject(ref(FIREBASE_STORAGE, storagePath));
    return true;
  } catch (error) {
    if (error?.code === 'storage/object-not-found') return true;
    console.warn('No se pudo limpiar un archivo incompleto del chat.', error);
    return false;
  }
};

export async function deleteUploadedFilesFromStorage(uploads = []) {
  const paths = uploads
    .map((upload) => (typeof upload === 'string' ? upload : upload?.storagePath))
    .filter(isSafeChatStoragePath);

  return Promise.all(paths.map(removeStoragePath));
}

const buildUploadResult = async ({ file, finalFile, index, storagePath, storageRef }) => {
  try {
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
  } catch (error) {
    await removeStoragePath(storagePath);
    throw error;
  }
};

export async function uploadFilesToStorage({
  files = [],
  storagePathBuilder,
  metadataBuilder,
  onProgress,
  onTask,
  signal,
} = {}) {
  if (!files.length) return [];

  if (!isFirebaseConfigured || !FIREBASE_STORAGE) {
    throw new ChatFileUploadError('Firebase Storage no está configurado en este entorno.', {
      code: 'chat/storage-not-configured',
    });
  }

  const uploaderUid = String(AUTH?.currentUser?.uid ?? '').trim();

  if (!uploaderUid) {
    throw new ChatFileUploadError(
      'La sesión autenticada es necesaria para subir archivos al chat.',
      {
        code: 'chat/auth-required',
      }
    );
  }

  if (signal?.aborted) throw normalizeChatUploadError({ name: 'AbortError' });

  const preparedFiles = await Promise.all(files.map(optimizeAttachmentIfNeeded));
  if (signal?.aborted) throw normalizeChatUploadError({ name: 'AbortError' });

  const descriptors = preparedFiles.map((finalFile, index) => {
    const originalFile = files[index];
    const storagePath = storagePathBuilder?.(finalFile, index);

    if (!isSafeChatStoragePath(storagePath)) {
      throw new ChatFileUploadError('La ruta de almacenamiento del archivo no es válida.', {
        code: 'chat/invalid-storage-path',
      });
    }

    return { index, originalFile, finalFile, storagePath };
  });
  const records = descriptors.map(({ index, originalFile, finalFile, storagePath }) => {
    const storageRef = ref(FIREBASE_STORAGE, storagePath);
    const task = uploadBytesResumable(storageRef, finalFile, {
      contentType: finalFile?.type || originalFile?.type || 'application/octet-stream',
      customMetadata: {
        ...(metadataBuilder?.(finalFile, index) || {}),
        uploaderUid,
      },
    });

    return { index, originalFile, finalFile, storagePath, storageRef, task };
  });

  let firstFailure = null;
  const cancelAll = () => records.forEach(({ task }) => task.cancel());
  const abortHandler = () => cancelAll();
  signal?.addEventListener('abort', abortHandler, { once: true });

  const promises = records.map(
    ({ index, originalFile, finalFile, storagePath, storageRef, task }) =>
      new Promise((resolve, reject) => {
        onTask?.({ index, storagePath, cancel: () => task.cancel() });
        task.on(
          'state_changed',
          (snapshot) => {
            const totalBytes = Number(snapshot.totalBytes || 0);
            const bytesTransferred = Number(snapshot.bytesTransferred || 0);
            onProgress?.({
              index,
              bytesTransferred,
              totalBytes,
              progress: totalBytes ? Math.round((bytesTransferred / totalBytes) * 100) : 0,
              state: snapshot.state,
            });
          },
          (error) => {
            if (!firstFailure) {
              firstFailure = error;
              cancelAll();
            }
            reject(error);
          },
          async () => {
            try {
              const result = await buildUploadResult({
                file: originalFile,
                finalFile,
                index,
                storagePath,
                storageRef,
              });
              onProgress?.({
                index,
                bytesTransferred: finalFile.size,
                totalBytes: finalFile.size,
                progress: 100,
                state: 'success',
              });
              resolve(result);
            } catch (error) {
              if (!firstFailure) {
                firstFailure = error;
                cancelAll();
              }
              reject(error);
            }
          }
        );
      })
  );

  try {
    const settled = await Promise.allSettled(promises);
    const completed = settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const rejected = settled.find((result) => result.status === 'rejected');

    if (rejected) {
      await deleteUploadedFilesFromStorage(completed);
      throw normalizeChatUploadError(firstFailure || rejected.reason);
    }

    return completed;
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }
}
