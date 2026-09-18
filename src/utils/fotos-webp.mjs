// ----------------------------------------------------------------------
// FOTOS DE PERFIL A WEBP: LO QUE DECIDE EL SCRIPT, SIN FIREBASE.
//
// Las fotos que se suben hoy ya salen del navegador en WebP (preset `avatar` de
// `image-optimizer.js`). Las de antes siguen en Storage como JPG o PNG, y pesan
// de tres a diez veces mas para pintarse en un circulo de 144 pixeles.
//
// `scripts/convertir-fotos-webp.mjs` las convierte. Aqui vive lo que se puede
// probar sin tocar nada: que foto se convierte, a que ruta va la nueva sin pisar
// la original, y las cuentas del informe.
// ----------------------------------------------------------------------

/** Los perfiles de los niveles organizacionales: lo que se convierte. */
export const TIPOS_DE_PERFIL = ['miembro', 'destacamento', 'seccion', 'region'];

/** Las carpetas de Storage de esos perfiles. */
export const CARPETAS_DE_PERFIL = {
  miembro: 'miembros',
  destacamento: 'destacamentos',
  seccion: 'secciones',
  region: 'regiones',
};

/** Los mismos numeros que el preset `avatar` y `miniatura` de hoy. */
export const AJUSTE_FOTO = { lado: 900, calidad: 82 };
export const AJUSTE_MINIATURA = { lado: 128, calidad: 78 };

/** Desde cuanto una imagen de cualquier otra carpeta cuenta como pesada. */
export const UMBRAL_PESADA_BYTES = 500 * 1024;

const EXTENSIONES_DE_IMAGEN = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif)$/i;

export const esImagen = ({ ruta = '', tipo = '' } = {}) =>
  String(tipo).startsWith('image/') || EXTENSIONES_DE_IMAGEN.test(String(ruta));

export const esWebp = ({ ruta = '', tipo = '' } = {}) =>
  String(tipo).toLowerCase() === 'image/webp' || (!tipo && /\.webp$/i.test(String(ruta)));

/**
 * La ruta de Storage de una foto. Las fotos viejas no siempre guardaban
 * `rutaArchivo`, pero la direccion de descarga la lleva dentro:
 * `.../o/miembros%2F323%2Fperfil.jpg?alt=media&token=...`.
 */
export const rutaDeLaFoto = ({ rutaArchivo = '', urlFoto = '' } = {}) => {
  if (String(rutaArchivo).trim()) return String(rutaArchivo).trim();

  const encontrada = String(urlFoto).match(/\/o\/([^?]+)/);

  return encontrada ? decodeURIComponent(encontrada[1]) : '';
};

/**
 * A donde va la WebP: al lado de la original y con otro nombre, para no pisarla
 * nunca. Si la original ya se llamaba `.webp` sin serlo, lleva sufijo.
 */
export const rutaWebpDe = (ruta) => {
  const sinExtension = String(ruta).replace(/\.[^./]+$/, '');
  const propuesta = `${sinExtension}.webp`;

  return propuesta === ruta ? `${sinExtension}-convertida.webp` : propuesta;
};

export const rutaMiniaturaDe = (rutaWebp) => String(rutaWebp).replace(/\.webp$/i, '-mini.webp');

/**
 * Lo que hay que hacer con un registro de `fotos`: convertir la foto, crear la
 * miniatura que le falta, las dos cosas o nada. Los videos no se tocan.
 */
export const planDeFoto = (registro = {}, archivo = null) => {
  const tipoEntidad = String(registro.tipoEntidad ?? '');

  if (!TIPOS_DE_PERFIL.includes(tipoEntidad)) return { accion: 'fuera', motivo: 'no es perfil' };
  if (registro.estado && registro.estado !== 'activo') {
    return { accion: 'fuera', motivo: 'inactiva' };
  }
  if (registro.tipoMedio === 'video') return { accion: 'fuera', motivo: 'video' };

  const ruta = rutaDeLaFoto(registro);

  if (!ruta) return { accion: 'fuera', motivo: 'sin ruta' };
  if (!archivo) return { accion: 'fuera', motivo: 'el archivo no está en Storage', ruta };

  const yaEsWebp = esWebp({ ruta, tipo: archivo.tipo });
  const faltaMiniatura = !String(registro.urlFotoMiniatura ?? '').trim();

  if (yaEsWebp && !faltaMiniatura) return { accion: 'nada', ruta };

  return {
    accion: yaEsWebp ? 'miniatura' : 'convertir',
    ruta,
    rutaWebp: yaEsWebp ? ruta : rutaWebpDe(ruta),
    rutaMiniatura: rutaMiniaturaDe(yaEsWebp ? ruta : rutaWebpDe(ruta)),
    faltaMiniatura,
  };
};

/** La direccion de descarga de Firebase para un objeto con su token. */
export const urlDeDescarga = ({ bucket, ruta, token }) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;

// ----------------------------------------------------------------------
// EL INFORME
// ----------------------------------------------------------------------

export const megas = (bytes) => `${(Number(bytes || 0) / (1024 * 1024)).toFixed(2)} MB`;

/**
 * Suma los archivos de Storage por carpeta de perfil y aparta las imagenes
 * pesadas de cualquier otra carpeta.
 */
export const resumirStorage = (archivos = [], { umbral = UMBRAL_PESADA_BYTES } = {}) => {
  const carpetas = Object.values(CARPETAS_DE_PERFIL);
  const porCarpeta = Object.fromEntries(
    carpetas.map((carpeta) => [carpeta, { archivos: 0, bytes: 0, noWebp: 0, bytesNoWebp: 0 }])
  );
  const pesadas = [];

  archivos.forEach(({ ruta = '', bytes = 0, tipo = '' }) => {
    const primera = String(ruta).split('/')[0];

    if (porCarpeta[primera]) {
      const cuenta = porCarpeta[primera];

      cuenta.archivos += 1;
      cuenta.bytes += Number(bytes);

      if (esImagen({ ruta, tipo }) && !esWebp({ ruta, tipo })) {
        cuenta.noWebp += 1;
        cuenta.bytesNoWebp += Number(bytes);
      }

      return;
    }

    if (esImagen({ ruta, tipo }) && Number(bytes) >= umbral) {
      pesadas.push({ ruta, bytes: Number(bytes), tipo });
    }
  });

  pesadas.sort((a, b) => b.bytes - a.bytes);

  const total = Object.values(porCarpeta).reduce((suma, cuenta) => suma + cuenta.bytes, 0);

  return { porCarpeta, total, pesadas };
};
