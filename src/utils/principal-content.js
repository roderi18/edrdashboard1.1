// Limits shared by the social feed UI, persistence layer and Firebase rules.
export const PRINCIPAL_LIMITS = Object.freeze({
  postMessage: 5000,
  commentMessage: 2000,
  imagesPerPost: 10,
  imageBytes: 8 * 1024 * 1024,
});

export const PRINCIPAL_IMAGE_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const PRINCIPAL_IMAGE_ACCEPT = PRINCIPAL_IMAGE_TYPES.join(',');

export function getPrincipalImageValidationError(file) {
  if (!file) return 'No se pudo leer la imagen seleccionada.';

  if (!PRINCIPAL_IMAGE_TYPES.includes(String(file.type || '').toLowerCase())) {
    return 'Formato no permitido. Usa JPG, PNG, WebP o GIF.';
  }

  if (!Number(file.size || 0)) {
    return 'La imagen está vacía o dañada.';
  }

  if (Number(file.size) > PRINCIPAL_LIMITS.imageBytes) {
    return 'Cada imagen debe pesar 8 MB o menos.';
  }

  return '';
}

export function validatePrincipalImages(images = []) {
  if (images.length > PRINCIPAL_LIMITS.imagesPerPost) {
    throw new Error(`Puedes adjuntar hasta ${PRINCIPAL_LIMITS.imagesPerPost} imágenes.`);
  }

  images.forEach((image) => {
    const error = getPrincipalImageValidationError(image?.file || image);

    if (error) throw new Error(error);
  });
}

export function validatePrincipalMessage(value, { type = 'post', allowEmpty = false } = {}) {
  const message = String(value || '').trim();
  const maxLength =
    type === 'comment' ? PRINCIPAL_LIMITS.commentMessage : PRINCIPAL_LIMITS.postMessage;

  if (!allowEmpty && !message) {
    throw new Error(type === 'comment' ? 'Escribe un comentario.' : 'Escribe algo para publicar.');
  }

  if (message.length > maxLength) {
    throw new Error(`El texto no puede superar ${maxLength.toLocaleString('es')} caracteres.`);
  }

  return message;
}
