export const IMAGE_UPLOAD_PRESETS = {
  general: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.9,
    mimeType: 'image/webp',
  },
  avatar: {
    maxWidth: 900,
    maxHeight: 900,
    quality: 0.82,
    mimeType: 'image/webp',
    maxSizeBytes: 320000,
  },
  producto: {
    maxWidth: 1800,
    maxHeight: 1800,
    quality: 0.92,
    mimeType: 'image/webp',
    maxSizeBytes: 1050000,
  },
};

const PRESERVE_MIME_TYPES = new Set(['image/svg+xml']);
const MIN_QUALITY = 0.52;
const QUALITY_STEP = 0.08;
const DIMENSION_STEP = 0.86;
const MIN_DIMENSION = 420;

const getPresetOptions = (presetOrOptions = 'general') =>
  typeof presetOrOptions === 'string'
    ? IMAGE_UPLOAD_PRESETS[presetOrOptions] || IMAGE_UPLOAD_PRESETS.general
    : { ...IMAGE_UPLOAD_PRESETS.general, ...(presetOrOptions || {}) };

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    image.src = objectUrl;
  });

const getTargetDimensions = ({ width, height, maxWidth, maxHeight }) => {
  if (!width || !height) {
    return { width: maxWidth, height: maxHeight };
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const blobToFile = (blob, originalFile, mimeType) => {
  const targetExtension = mimeType === 'image/png' ? 'png' : 'webp';
  const safeName = String(originalFile?.name || 'imagen')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-');

  return new File([blob], `${safeName}.${targetExtension}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
};

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

const drawImageToCanvas = ({ image, width, height }) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas;
};

export async function optimizeImageFile(file, presetOrOptions = 'general') {
  if (!(file instanceof File)) return file;
  if (!String(file.type || '').startsWith('image/')) return file;
  if (PRESERVE_MIME_TYPES.has(file.type)) return file;

  const { maxWidth, maxHeight, quality, mimeType, maxSizeBytes } =
    getPresetOptions(presetOrOptions);
  const image = await loadImageElement(file);
  const { width, height } = getTargetDimensions({
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    maxWidth,
    maxHeight,
  });
  let targetWidth = width;
  let targetHeight = height;
  let bestBlob = null;

  while (targetWidth >= MIN_DIMENSION && targetHeight >= MIN_DIMENSION) {
    const canvas = drawImageToCanvas({ image, width: targetWidth, height: targetHeight });
    if (!canvas) return file;

    for (
      let currentQuality = quality;
      currentQuality >= MIN_QUALITY;
      currentQuality -= QUALITY_STEP
    ) {
      const blob = await canvasToBlob(canvas, mimeType, currentQuality);
      if (!blob) continue;

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }

      if (!maxSizeBytes || blob.size <= maxSizeBytes) {
        if (blob.size >= file.size && targetWidth === (image.naturalWidth || image.width)) {
          return file;
        }

        return blobToFile(blob, file, mimeType);
      }
    }

    targetWidth = Math.max(MIN_DIMENSION, Math.round(targetWidth * DIMENSION_STEP));
    targetHeight = Math.max(MIN_DIMENSION, Math.round(targetHeight * DIMENSION_STEP));

    if (targetWidth === MIN_DIMENSION || targetHeight === MIN_DIMENSION) break;
  }

  if (!bestBlob) return file;
  if (!maxSizeBytes && bestBlob.size >= file.size && width === (image.naturalWidth || image.width)) {
    return file;
  }

  return blobToFile(bestBlob, file, mimeType);
}

export async function optimizeImageFiles(files = [], presetOrOptions = 'general') {
  return Promise.all((files || []).map((file) => optimizeImageFile(file, presetOrOptions)));
}
