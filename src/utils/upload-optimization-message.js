import { fData } from 'src/utils/format-number';

export const getImageOptimizationMessage = (info) =>
  info?.originalSize && info?.optimizedSize
    ? `Imagen optimizada de ${fData(info.originalSize)} a ${fData(info.optimizedSize)}`
    : 'Imagen optimizada correctamente.';

export const getImagesOptimizationMessage = (items) => {
  const validItems = (items || []).filter((item) => item?.info);

  if (validItems.length === 1) {
    return getImageOptimizationMessage(validItems[0].info);
  }

  const originalSize = validItems.reduce((total, item) => total + (item.info.originalSize || 0), 0);
  const optimizedSize = validItems.reduce(
    (total, item) => total + (item.info.optimizedSize || 0),
    0
  );

  return `Imágenes optimizadas de ${fData(originalSize)} a ${fData(optimizedSize)}`;
};

export const getFileImageOptimizationMessage = (
  file,
  fallback = 'Imagen optimizada correctamente.'
) => getImageOptimizationMessage(file?.__optimizationInfo) || fallback;
