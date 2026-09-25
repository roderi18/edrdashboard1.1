import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// SUBIR UN CERTIFICADO (panel lateral y fila de la lista).
//
// Qué se rompía:
//   - "Documento cargado exitosamente" salía ANTES de subirlo: si Firebase
//     fallaba, la pantalla enseñaba el certificado y al recargar no estaba.
//   - Sin límite: un vídeo de cientos de MB se leía entero en memoria como texto.
//   - Tras un fallo no se podía elegir el mismo archivo otra vez (el selector no
//     avisa si el archivo es el mismo).
// El certificado puede venir escaneado como imagen, en Word o en PDF.
// ----------------------------------------------------------------------

export const TAMANO_MAXIMO_CERTIFICADO = 10 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const EXTENSIONES_PERMITIDAS = /\.(pdf|docx?|png|jpe?g|webp|heic|heif)$/i;

export const esCertificadoPermitido = (archivo) =>
  Boolean(archivo) &&
  (TIPOS_PERMITIDOS.includes(archivo.type) ||
    archivo.type?.startsWith('image/') ||
    EXTENSIONES_PERMITIDAS.test(archivo.name || ''));

const leerComoDataUrl = (archivo) =>
  new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(archivo);
  });

/**
 * Para el `onChange` de un `<input type="file">`: valida, lee y sube con
 * `actions.uploadCertificate`. El check verde sale al instante; el aviso de éxito
 * solo cuando Firebase lo guardó (si no, se deshace y se avisa).
 */
export async function subirCertificadoDesdeInput(evento, actions) {
  const input = evento?.target;
  const archivo = input?.files?.[0];
  // Vaciar el selector: así se puede volver a elegir el mismo archivo.
  if (input) input.value = '';
  if (!archivo) return false;

  if (!esCertificadoPermitido(archivo)) {
    toast.error('El certificado debe ser un PDF, una imagen o un documento de Word.');
    return false;
  }

  if (archivo.size > TAMANO_MAXIMO_CERTIFICADO) {
    toast.error('El certificado no puede pasar de 10 MB.');
    return false;
  }

  let contenido;
  try {
    contenido = await leerComoDataUrl(archivo);
  } catch {
    toast.error('No se pudo leer el documento. Inténtalo de nuevo.');
    return false;
  }

  const guardado = await actions.uploadCertificate({
    name: archivo.name,
    type: archivo.type,
    size: archivo.size,
    fileBase64: contenido,
    uploadedAt: new Date().toISOString(),
  });

  if (guardado) toast.success('Certificado guardado.');
  else toast.error('No se pudo guardar el certificado. Revisa la conexión e inténtalo de nuevo.');

  return guardado;
}
