import { ref, deleteObject, getDownloadURL, uploadBytesResumable } from 'firebase/storage';

import { sonarAviso } from 'src/utils/sonidos-de-aviso.mjs';
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

const CONTENT_TYPE_BY_EXTENSION = Object.freeze({
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
});

// Windows puede entregar PDF/ZIP con `file.type` vacio. El selector del chat los
// reconoce por la extension, pero antes la carga los convertia en
// `application/octet-stream`; las reglas de Storage, correctamente, rechazaban
// ese tipo. La extension solo completa el MIME de los dos formatos que la propia
// interfaz ya valido.
export const resolveUploadContentType = (file, originalFile = file) => {
  const reportedType = String(file?.type || originalFile?.type || '')
    .trim()
    .toLowerCase();
  const fileName = String(file?.name || originalFile?.name || '').toLowerCase();
  const extension = Object.keys(CONTENT_TYPE_BY_EXTENSION).find((suffix) =>
    fileName.endsWith(suffix)
  );

  // La extension admitida manda también cuando Windows informa el tipo genérico
  // `application/octet-stream` o una variante que Storage no reconoce.
  return CONTENT_TYPE_BY_EXTENSION[extension] || reportedType || 'application/octet-stream';
};

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
  const messagesByCode = {
    'storage/unauthenticated': 'Tu sesión expiró. Inicia sesión nuevamente para enviar el archivo.',
    'storage/unauthorized':
      'Tu cuenta no tiene permiso para subir archivos a esta conversación. Actualiza la sesión e inténtalo nuevamente.',
    'storage/invalid-argument': 'El archivo no tiene un formato válido para el chat.',
    'storage/quota-exceeded': 'No hay espacio disponible para completar la carga.',
    'storage/retry-limit-exceeded':
      'La carga tardó demasiado. Comprueba tu conexión e inténtalo nuevamente.',
  };
  const message = cancelled
    ? 'La carga fue cancelada. Puedes intentarlo nuevamente.'
    : messagesByCode[error?.code] ||
      'No se pudo completar la carga. Comprueba tu conexión e inténtalo nuevamente.';

  return new ChatFileUploadError(message, {
    code: cancelled ? 'chat/upload-cancelled' : error?.code || 'chat/upload-failed',
    cancelled,
    cause: error,
  });
};

const refreshChatIdentityClaim = async () => {
  const account = AUTH?.currentUser;

  if (!account) return;

  const currentToken = await account.getIdTokenResult?.().catch(() => null);
  const memberIdClaim = currentToken?.claims?.idMiembros;
  if (Number.isSafeInteger(memberIdClaim) && memberIdClaim > 0) return;

  // Los permisos pueden haberse sincronizado en el servidor después de emitir el
  // token que conserva el SDK. Storage no pasa por el interceptor de Axios, por
  // eso necesita actualizarlo aquí antes de evaluar sus reglas.
  await account.getIdToken?.(true).catch(() => null);
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

const buildUploadResult = async ({
  file,
  finalFile,
  index,
  storagePath,
  storageRef,
  contentType,
}) => {
  try {
    const downloadUrl = await getDownloadURL(storageRef);

    return {
      id: `${sanitizeStorageSegment(finalFile.name)}-${finalFile.lastModified || Date.now()}-${index}`,
      nombre: finalFile.name,
      nombreOriginal: file.name,
      tipo: contentType || resolveUploadContentType(finalFile, file),
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
  silenciado = false,
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

  if (descriptors.some(({ storagePath }) => storagePath.startsWith('chat/'))) {
    await refreshChatIdentityClaim();
  }

  const records = descriptors.map(({ index, originalFile, finalFile, storagePath }) => {
    const storageRef = ref(FIREBASE_STORAGE, storagePath);
    const contentType = resolveUploadContentType(finalFile, originalFile);
    const task = uploadBytesResumable(storageRef, finalFile, {
      contentType,
      customMetadata: {
        ...(metadataBuilder?.(finalFile, index) || {}),
        uploaderUid,
      },
    });

    return { index, originalFile, finalFile, storagePath, storageRef, contentType, task };
  });

  let firstFailure = null;
  const cancelAll = () => records.forEach(({ task }) => task.cancel());
  const abortHandler = () => cancelAll();
  signal?.addEventListener('abort', abortHandler, { once: true });

  const promises = records.map(
    ({ index, originalFile, finalFile, storagePath, storageRef, contentType, task }) =>
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
                contentType,
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

    // EL SONIDO DE "ARCHIVO CARGADO", AQUI Y NO EN CADA PANTALLA.
    //
    // Por esta funcion pasan TODAS las subidas: los adjuntos del chat, las fotos
    // del muro, los documentos, los comprobantes de un pedido. Ponerlo aqui es
    // ponerlo una vez; en cada pantalla habria que acordarse cada vez, y una
    // subida sin sonido no se distingue de una subida a medias.
    //
    // Suena al terminar TODO el lote, no una vez por archivo.
    sonarAviso('archivoSubido', { silenciado });

    return completed;
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }
}
