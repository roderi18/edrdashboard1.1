import { Children, cloneElement, isValidElement } from 'react';

import { optimizeImageFile, optimizeImageFiles } from 'src/utils/image-optimizer';

export function OptimizedImageUpload({
  children,
  multiple = false,
  preset = 'general',
  onDrop,
  onError,
}) {
  const child = Children.only(children);

  if (!isValidElement(child)) {
    throw new Error('OptimizedImageUpload requiere un unico componente hijo valido.');
  }

  return cloneElement(child, {
    onDrop: async (acceptedFiles, ...rest) => {
      try {
        const processedFiles = multiple
          ? await optimizeImageFiles(acceptedFiles, preset)
          : [await optimizeImageFile(acceptedFiles?.[0], preset)].filter(Boolean);

        await onDrop?.(processedFiles, ...rest);
      } catch (error) {
        console.error(error);
        onError?.(error);
      }
    },
  });
}
