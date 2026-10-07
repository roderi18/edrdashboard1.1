import {
  FUENTES_ONERRD,
  paginaDesdeSvg,
  cajaDeTextoOnerrd,
  pesoDeCampoOnerrd,
  INTERLINEADO_ONERRD,
  lineaDeDegradadoOnerrd,
  paradasDeDegradadoOnerrd,
  desplazamientosDeContorno,
} from 'src/utils/certificado-onerrd.mjs';

// ----------------------------------------------------------------------
// IMÁGENES DEL CERTIFICADO ONERRD, preparadas en el navegador antes de subir.
//
// El PDF solo entiende PNG y JPG (`@react-pdf/renderer` no lee WebP ni SVG
// con filtros), y cada imagen viaja en un documento de Firestore de 1 MB como
// mucho. Por eso todo se pinta aquí en un lienzo y sale reducido:
//   - el SVG de fondo → JPG del tamaño de la página a ~2400 px (≈220 ppp);
//   - la imagen y las firmas → PNG (conservan la transparencia) o JPG si la
//     original lo era, a 1600 px como mucho por lado.
// ----------------------------------------------------------------------

// Holgura bajo el límite de Firestore (1 048 487 bytes por documento): el
// resto del documento (nombre, autor, fechas) cabe de sobra.
const LIMITE_DATA_URL = 900_000;

export const TIPOS_DE_IMAGEN_ONERRD = ['image/png', 'image/jpeg', 'image/webp'];

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.decoding = 'async';
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    imagen.src = src;
  });

const lienzo = (ancho, alto) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(ancho));
  canvas.height = Math.max(1, Math.round(alto));
  return canvas;
};

// ¿Tiene algún píxel transparente? Se mira una versión pequeña: basta para
// decidir entre PNG y JPG sin recorrer millones de píxeles.
const tieneTransparencia = (imagen) => {
  const muestra = lienzo(64, 64);
  const ctx = muestra.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imagen, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
};

// Pinta a varios tamaños/calidades hasta caber en el límite.
const exportarHastaCaber = (pintar, intentos) => {
  for (const { ancho, tipo, calidad } of intentos) {
    const canvas = pintar(ancho);
    const dataUrl = canvas.toDataURL(tipo, calidad);
    if (dataUrl.length <= LIMITE_DATA_URL) return dataUrl;
  }
  throw new Error('La imagen es demasiado grande incluso reducida. Prueba con una más ligera.');
};

// SVG → JPG de fondo. Devuelve también el tamaño de página (pt) del viewBox.
export async function rasterizarSvgOnerrd(archivo) {
  if (!archivo || !/svg/i.test(archivo.type || archivo.name)) {
    throw new Error('La plantilla tiene que ser un archivo .svg.');
  }

  const texto = await archivo.text();
  if (!/<svg[\s>]/i.test(texto)) throw new Error('El archivo no parece un SVG válido.');

  const pagina = paginaDesdeSvg(texto);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));

  try {
    const imagen = await cargarImagen(url);
    const proporcion = pagina.alto / pagina.ancho;

    const pintar = (ancho) => {
      const canvas = lienzo(ancho, ancho * proporcion);
      const ctx = canvas.getContext('2d');
      // El JPG no tiene transparencia: lo que el SVG deja vacío sale blanco,
      // como en papel, y no negro.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    let dataUrl;
    try {
      dataUrl = exportarHastaCaber(pintar, [
        { ancho: 2400, tipo: 'image/jpeg', calidad: 0.9 },
        { ancho: 2400, tipo: 'image/jpeg', calidad: 0.82 },
        { ancho: 2000, tipo: 'image/jpeg', calidad: 0.82 },
        { ancho: 1600, tipo: 'image/jpeg', calidad: 0.8 },
        { ancho: 1400, tipo: 'image/jpeg', calidad: 0.72 },
      ]);
    } catch (error) {
      // Safari marca como "sucio" el lienzo con un SVG y no deja exportarlo.
      if (error?.name === 'SecurityError') {
        throw new Error('Este navegador no deja convertir el SVG. Súbelo desde Chrome o Edge.');
      }
      throw error;
    }

    return { dataUrl, pagina, nombreArchivo: archivo.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// PNG/JPG/WebP → PNG o JPG reducido. `proporcion` = alto / ancho.
export async function prepararImagenOnerrd(archivo, { ladoMaximo = 1600 } = {}) {
  if (!archivo || !TIPOS_DE_IMAGEN_ONERRD.includes(archivo.type)) {
    throw new Error('Usa una imagen PNG, JPG o WebP.');
  }

  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await cargarImagen(url);
    const { naturalWidth: w, naturalHeight: h } = imagen;
    if (!w || !h) throw new Error('No se pudo leer la imagen.');

    const proporcion = h / w;
    const transparente = archivo.type !== 'image/jpeg' && tieneTransparencia(imagen);
    const tipo = transparente ? 'image/png' : 'image/jpeg';
    const anchoInicial = Math.min(w, w >= h ? ladoMaximo : ladoMaximo / proporcion);

    const pintar = (ancho) => {
      const canvas = lienzo(ancho, ancho * proporcion);
      const ctx = canvas.getContext('2d');
      if (!transparente) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    const dataUrl = exportarHastaCaber(
      pintar,
      [1, 0.8, 0.6, 0.45, 0.32].map((factor) => ({
        ancho: Math.max(64, anchoInicial * factor),
        tipo,
        calidad: 0.9,
      }))
    );

    return { dataUrl, proporcion, nombreArchivo: archivo.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// La foto de una región tal como está en Niveles organizacionales (Storage).
// Los buckets no tienen CORS: se pide al proxy con sesión `/api/image-data-url`
// (el mismo que usa el PDF de la ficha del miembro). Luego se reduce como una
// subida más: el PDF solo entiende PNG y JPG, y la foto puede ser WebP o AVIF.
export async function leerFotoDeRegionOnerrd(url) {
  if (!url) return null;
  let dataUrl = url;
  if (!url.startsWith('data:image/')) {
    const { authHeaders } = await import('src/services/member-service');
    const respuesta = await fetch(`/api/image-data-url/?url=${encodeURIComponent(url)}`, {
      headers: await authHeaders(),
    });
    if (!respuesta.ok) throw new Error('No se pudo leer la foto de la región.');
    ({ dataUrl } = await respuesta.json());
    if (!dataUrl) return null;
  }

  let blob = await (await fetch(dataUrl)).blob();
  if (!TIPOS_DE_IMAGEN_ONERRD.includes(blob.type)) {
    // AVIF u otro: se pasa a PNG antes de prepararla.
    const imagen = await cargarImagen(dataUrl);
    const canvas = lienzo(imagen.naturalWidth, imagen.naturalHeight);
    canvas.getContext('2d').drawImage(imagen, 0, 0);
    blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
  }
  return prepararImagenOnerrd(new File([blob], 'region', { type: blob.type }), {
    ladoMaximo: 800,
  });
}

// ---------------------------------------------------------------------- texto

export const cssDeFuenteOnerrd = (fuente) =>
  FUENTES_ONERRD.find((item) => item.value === fuente)?.css || FUENTES_ONERRD[0].css;

let contextoDeMedida = null;

const lineasBase = new Map();

// Antes de medir, la fuente de cada texto tiene que estar cargada: si no, se
// mide la de reserva y el PDF sale a otra altura.
export const cargarLetrasOnerrd = (campos) =>
  typeof document === 'undefined' || !document.fonts
    ? Promise.resolve()
    : Promise.all(
        campos.map((campo) =>
          document.fonts.load(`${pesoDeCampoOnerrd(campo)} 16px ${cssDeFuenteOnerrd(campo.fuente)}`)
        )
      ).catch(() => null);

// Dónde cae la línea base de una línea de texto, desde su borde de arriba y en
// tamaños de letra, con el mismo interlineado que el lienzo. Se mide con un
// marcador de alto 0 alineado a la línea base: lo que cuenta es dónde lo pone
// este navegador, que reparte el interlineado según las medidas de la fuente
// que él elige (no siempre las mismas en Windows y en Mac).
export const lineaBaseOnerrd = (campo) => {
  if (typeof document === 'undefined') return 0;
  // A 1000 px: el navegador redondea la línea a píxeles, y a 100 px eso ya
  // era un 1 % del tamaño de la letra.
  const letra = `${pesoDeCampoOnerrd(campo)} 1000px ${cssDeFuenteOnerrd(campo.fuente)}`;
  if (lineasBase.has(letra)) return lineasBase.get(letra);

  const caja = document.createElement('div');
  caja.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap';
  caja.style.font = letra;
  caja.style.lineHeight = String(INTERLINEADO_ONERRD);
  caja.textContent = 'Hg';
  const marca = document.createElement('span');
  marca.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  caja.appendChild(marca);
  document.body.appendChild(caja);
  const valor = (marca.getBoundingClientRect().top - caja.getBoundingClientRect().top) / 1000;
  caja.remove();
  // Con la fuente aún bajando se mediría la de reserva: eso no se guarda.
  if (document.fonts?.check?.(letra)) lineasBase.set(letra, valor);
  return valor;
};

// Ancho del texto a 1 pt con la fuente real del navegador. Se mide a 100 px
// para no perder precisión y se divide.
export const medirTextoOnerrd = (texto, campo) => {
  if (typeof document === 'undefined') return 0;
  if (!contextoDeMedida) contextoDeMedida = document.createElement('canvas').getContext('2d');
  contextoDeMedida.font = `${campo.cursiva ? 'italic ' : ''}${pesoDeCampoOnerrd(campo)} 100px ${cssDeFuenteOnerrd(campo.fuente)}`;
  return contextoDeMedida.measureText(texto).width / 100;
};

// ----------------------------------------------------------------------
// TEXTO CON DEGRADADO PARA EL PDF. El PDF no sabe rellenar letras con un
// degradado, así que el navegador dibuja el texto (contorno incluido) igual que
// en la vista previa —misma fuente, misma línea base, el mismo degradado— y el
// PDF pone la imagen en su sitio. A 8 px por punto (576 ppp): no se distingue
// del texto al imprimir.
// ----------------------------------------------------------------------

const PIXELES_POR_PUNTO = 8;

// CÓDIGO QR como imagen (vista previa y PDF). 1024 px: en una pulgada son más
// de 1000 ppp, nítido al imprimir. Corrección M: aguanta un poco de suciedad
// o un doblez. La librería se carga solo cuando hace falta.
export const generarQrOnerrd = async (texto, color = '#000000') => {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(texto, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 1024,
    color: { dark: color, light: '#FFFFFF' },
  });
};

export const rasterizarTextoOnerrd = ({ campo, texto, tamano, pagina, lineaBase }) => {
  const anchoCaja = (campo.ancho / 100) * pagina.ancho;
  const altoLinea = tamano * INTERLINEADO_ONERRD;
  // Margen para lo que sobresale de la línea: el contorno y las letras altas.
  const margen = tamano * 0.6 + (campo.contorno ? campo.grosorContorno : 0);
  const ancho = anchoCaja + margen * 2;
  const alto = altoLinea + margen * 2;

  const hoja = document.createElement('canvas');
  hoja.width = Math.ceil(ancho * PIXELES_POR_PUNTO);
  hoja.height = Math.ceil(alto * PIXELES_POR_PUNTO);
  const ctx = hoja.getContext('2d');
  ctx.scale(PIXELES_POR_PUNTO, PIXELES_POR_PUNTO);
  ctx.translate(margen, margen);
  ctx.font = `${pesoDeCampoOnerrd(campo)} ${tamano}px ${cssDeFuenteOnerrd(campo.fuente)}`;
  ctx.letterSpacing = `${campo.espaciado}px`;
  ctx.textBaseline = 'alphabetic';

  // Como en la vista previa: el texto es una caja del ancho de lo escrito,
  // alineada dentro de la del campo, y el degradado ocupa esa caja.
  const anchoTexto = ctx.measureText(texto).width;
  const x = { left: 0, center: (anchoCaja - anchoTexto) / 2, right: anchoCaja - anchoTexto }[
    campo.alineacion
  ];
  const y = (lineaBase || 1) * tamano;

  if (campo.contorno) {
    ctx.fillStyle = campo.contorno;
    desplazamientosDeContorno(campo.grosorContorno).forEach(([dx, dy]) =>
      ctx.fillText(texto, x + dx, y + dy)
    );
  }

  const linea = lineaDeDegradadoOnerrd(campo.anguloDegradado, anchoTexto, altoLinea);
  const degradado = ctx.createLinearGradient(x + linea.x1, linea.y1, x + linea.x2, linea.y2);
  paradasDeDegradadoOnerrd(campo).forEach(({ color, posicion }) =>
    degradado.addColorStop(Math.min(1, Math.max(0, posicion / 100)), color)
  );
  ctx.fillStyle = degradado;
  ctx.fillText(texto, x, y);

  const caja = cajaDeTextoOnerrd(campo, tamano, pagina);
  return {
    dataUrl: hoja.toDataURL('image/png'),
    // La caja de la vista previa (sin el ajuste de línea base, que es del
    // texto del PDF): aquí todo lo dibujó el navegador.
    caja: { left: caja.left - margen, top: caja.top - margen, width: ancho, height: alto },
  };
};

// Los textos ya resueltos, listos para el PDF (certificado y factura): con su
// fuente cargada, la línea base que tienen en pantalla y, si llevan degradado,
// dibujados por el navegador. Los vacíos no van.
export const prepararTextosParaPdfOnerrd = async (textos, pagina) => {
  const conTexto = textos.filter((t) => t.texto);
  await cargarLetrasOnerrd(conTexto.map((t) => t.campo));
  return conTexto.map((t) => {
    const lineaBase = lineaBaseOnerrd(t.campo);
    return {
      ...t,
      lineaBase,
      // El PDF no rellena letras con degradado: las dibuja el navegador.
      ...(t.campo.degradado && { dibujo: rasterizarTextoOnerrd({ ...t, pagina, lineaBase }) }),
    };
  });
};
