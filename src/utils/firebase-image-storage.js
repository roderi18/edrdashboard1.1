import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { optimizeImageFile } from 'src/utils/image-optimizer';

import { FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

const getExtensionFromMime = (mimeType = '') => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'webp';
};

const replaceExtension = (path, extension) => path.replace(/\.[^.]+$/, `.${extension}`);

const calculateReductionPercent = (originalSize, optimizedSize) => {
  if (!originalSize || originalSize <= 0) return 0;
  return Math.max(0, ((originalSize - optimizedSize) / originalSize) * 100);
};

export async function uploadOptimizedImage({
  file,
  storagePath,
  preset = 'general',
  metadata = {},
} = {}) {
  if (!isFirebaseConfigured || !FIREBASE_STORAGE) {
    throw new Error('Firebase Storage no esta configurado en este entorno.');
  }

  if (!file) throw new Error('No se proporciono una imagen para subir.');
  if (!storagePath) throw new Error('No se proporciono una ruta de Storage.');

  const optimizedFile = await optimizeImageFile(file, preset);
  const originalSizeBytes = Number(file.size || 0);
  const optimizedSizeBytes = Number(optimizedFile?.size || file.size || 0);
  const extension = getExtensionFromMime(optimizedFile?.type || file?.type);
  const finalPath = replaceExtension(storagePath, extension);
  const storageRef = ref(FIREBASE_STORAGE, finalPath);

  await uploadBytes(storageRef, optimizedFile, {
    contentType: optimizedFile?.type || file?.type || 'image/webp',
    customMetadata: metadata,
  });

  const downloadUrl = await getDownloadURL(storageRef);

  return {
    file: optimizedFile,
    storagePath: finalPath,
    downloadUrl,
    originalSizeBytes,
    optimizedSizeBytes,
    reductionPercent: calculateReductionPercent(originalSizeBytes, optimizedSizeBytes),
  };
}

export async function uploadOptimizedImages({
  files = [],
  storagePathBuilder,
  preset = 'general',
  metadataBuilder,
} = {}) {
  const uploads = await Promise.all(
    files.map((file, index) =>
      uploadOptimizedImage({
        file,
        preset,
        storagePath: storagePathBuilder(file, index),
        metadata: metadataBuilder?.(file, index) || {},
      })
    )
  );

  return {
    uploads,
    summary: {
      totalOriginalSizeBytes: uploads.reduce((total, item) => total + Number(item.originalSizeBytes || 0), 0),
      totalOptimizedSizeBytes: uploads.reduce(
        (total, item) => total + Number(item.optimizedSizeBytes || 0),
        0
      ),
      reductionPercent: calculateReductionPercent(
        uploads.reduce((total, item) => total + Number(item.originalSizeBytes || 0), 0),
        uploads.reduce((total, item) => total + Number(item.optimizedSizeBytes || 0), 0)
      ),
    },
  };
}
