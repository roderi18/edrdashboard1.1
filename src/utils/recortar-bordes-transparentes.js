// ----------------------------------------------------------------------
// QUITA LOS BORDES TRANSPARENTES DE UNA IMAGEN antes de subirla.
//
// La barra dorada (`placa-dorada.webp`) traía 104 px transparentes arriba —casi
// un 20 % de su alto—, 18 abajo y 29 a los lados. Debajo de la foto eso se veía
// como un margen enorme que ningún ajuste de la tarjeta podía quitar: el hueco
// era de la imagen. Se recorta a lo que de verdad se ve; una imagen sin
// transparencia (una foto) sale igual que entró.
// ----------------------------------------------------------------------

const cargar = (archivo) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagen);
    };
    imagen.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    imagen.src = url;
  });

export async function recortarBordesTransparentes(archivo) {
  try {
    const imagen = await cargar(archivo);
    const { naturalWidth: ancho, naturalHeight: alto } = imagen;
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext('2d', { willReadFrequently: true });

    if (!contexto) return archivo;

    contexto.drawImage(imagen, 0, 0);
    const { data } = contexto.getImageData(0, 0, ancho, alto);

    let arriba = alto;
    let abajo = -1;
    let izquierda = ancho;
    let derecha = -1;

    for (let y = 0; y < alto; y += 1) {
      for (let x = 0; x < ancho; x += 1) {
        // Casi transparente cuenta como transparente: el borde suavizado.
        if (data[(y * ancho + x) * 4 + 3] > 8) {
          if (y < arriba) arriba = y;
          if (y > abajo) abajo = y;
          if (x < izquierda) izquierda = x;
          if (x > derecha) derecha = x;
        }
      }
    }

    // Toda transparente, o nada que recortar: tal cual.
    if (abajo < 0) return archivo;
    if (arriba === 0 && izquierda === 0 && abajo === alto - 1 && derecha === ancho - 1) {
      return archivo;
    }

    const recorte = document.createElement('canvas');
    recorte.width = derecha - izquierda + 1;
    recorte.height = abajo - arriba + 1;
    recorte
      .getContext('2d')
      .drawImage(
        lienzo,
        izquierda,
        arriba,
        recorte.width,
        recorte.height,
        0,
        0,
        recorte.width,
        recorte.height
      );

    const blob = await new Promise((resolve) => recorte.toBlob(resolve, 'image/png'));

    if (!blob) return archivo;

    const nombre = String(archivo?.name || 'imagen').replace(/\.[^.]+$/, '');

    return new File([blob], `${nombre}.png`, { type: 'image/png', lastModified: Date.now() });
  } catch {
    // Si no se puede leer, se sube como venía: mejor con borde que sin imagen.
    return archivo;
  }
}
