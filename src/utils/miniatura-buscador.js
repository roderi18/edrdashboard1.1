import { optimizeImageFile } from 'src/utils/image-optimizer';

// ----------------------------------------------------------------------
// LA CARA DE UN RESULTADO DEL BUSCADOR.
//
// Un `data:` de unos 2 kB que viaja dentro del indice, junto al nombre. No es
// una URL: asi el desplegable no pide NADA al pintar los resultados, que es lo
// que hacia que las primeras busquedas salieran con recuadros grises mientras
// bajaban fotos de 250 kB.
//
// Se genera en el navegador, con el mismo optimizador de siempre, porque es
// donde esta la imagen: al subir un producto ya tenemos el archivo en la mano, y
// para los productos de antes se descarga una vez y se guarda.
// ----------------------------------------------------------------------

const PRESET = 'miniaturaBuscador';

const comoDataUri = (blob) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onload = () => resolve(String(lector.result || ''));
    lector.onerror = () => reject(lector.error ?? new Error('No se pudo leer la miniatura.'));
    lector.readAsDataURL(blob);
  });

/** La miniatura de un archivo que ya tenemos (al subir un producto). */
export async function miniaturaDesdeArchivo(file) {
  if (!(file instanceof File) || !String(file.type || '').startsWith('image/')) return '';

  const miniatura = await optimizeImageFile(file, PRESET);

  return comoDataUri(miniatura);
}

/**
 * La miniatura de una imagen que ya esta subida.
 *
 * Solo para el relleno de lo viejo: baja la imagen entera una vez para no tener
 * que bajarla nunca mas.
 */
export async function miniaturaDesdeUrl(url) {
  if (!url) return '';

  const respuesta = await fetch(url, { mode: 'cors', cache: 'force-cache' });

  if (!respuesta.ok) throw new Error(`La imagen respondió ${respuesta.status}.`);

  const blob = await respuesta.blob();

  return miniaturaDesdeArchivo(
    new File([blob], 'producto.webp', { type: blob.type || 'image/webp' })
  );
}
