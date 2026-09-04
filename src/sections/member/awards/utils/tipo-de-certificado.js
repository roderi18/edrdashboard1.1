// ----------------------------------------------------------------------
// ¿EL CERTIFICADO ES UNA FOTO O UN PDF?
//
// De ello depende con que se pinta en el visor: una imagen se centra y se
// escala; un PDF va al visor del navegador. El origen puede llegar de tres
// formas y cada una dice el tipo a su manera:
//
//   - Data URL: lo lleva escrito delante (`data:image/jpeg;base64,...`).
//   - URL de Storage: en la extension de la ruta, codificada y con la firma
//     detras (`.../certificados%2Ffoo.jpg?alt=media&token=...`).
//   - Nombre del archivo: en su extension, cuando la URL no la deja ver.
//
// Ante la duda se responde que NO es imagen, que deja el PDF en su visor: si
// acaso el archivo era una foto, se vera como se veia antes.
// ----------------------------------------------------------------------

const EXTENSIONES_DE_IMAGEN = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;

export function esCertificadoDeImagen(origen, nombreArchivo) {
  const fuente = String(origen || '');

  if (fuente.startsWith('data:')) {
    const finDelTipo = fuente.indexOf(';');

    // Un data URL sin `;` esta mal formado; se corta en la coma para no
    // arrastrar el contenido entero a la comparacion.
    const tipo = fuente.slice(5, finDelTipo === -1 ? fuente.indexOf(',') : finDelTipo);

    return tipo.startsWith('image/');
  }

  if (EXTENSIONES_DE_IMAGEN.test(String(nombreArchivo || ''))) return true;

  const sinFirma = fuente.split(/[?#]/)[0];

  let ruta = sinFirma;

  try {
    ruta = decodeURIComponent(sinFirma);
  } catch {
    // Una URL mal codificada no es motivo para no ensenar nada: se mira tal cual.
  }

  return EXTENSIONES_DE_IMAGEN.test(ruta);
}
