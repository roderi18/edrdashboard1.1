export const IMAGE_UPLOAD_PRESETS = {
  general: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.9,
    mimeType: 'image/webp',
  },
  avatar: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.92,
    mimeType: 'image/webp',
  },
  producto: {
    maxWidth: 1800,
    maxHeight: 1800,
    quality: 0.92,
    mimeType: 'image/webp',
  },
};

const PRESERVE_MIME_TYPES = new Set(['image/gif', 'image/svg+xml']);

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

export async function optimizeImageFile(file, presetOrOptions = 'general') {
  if (!(file instanceof File)) return file;
  if (!String(file.type || '').startsWith('image/')) return file;
  if (PRESERVE_MIME_TYPES.has(file.type)) return file;

  const { maxWidth, maxHeight, quality, mimeType } = getPresetOptions(presetOrOptions);
  const image = await loadImageElement(file);
  const { width, height } = getTargetDimensions({
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    maxWidth,
    maxHeight,
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return file;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

  if (!blob) return file;
  if (blob.size >= file.size && width === (image.naturalWidth || image.width)) return file;

  return blobToFile(blob, file, mimeType);
}

export async function optimizeImageFiles(files = [], presetOrOptions = 'general') {
  return Promise.all((files || []).map((file) => optimizeImageFile(file, presetOrOptions)));
}
