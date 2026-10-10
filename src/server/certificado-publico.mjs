import { timingSafeEqual } from 'crypto';

// ----------------------------------------------------------------------
// LO QUE COMPARTEN LAS RUTAS PÚBLICAS DE LOS CERTIFICADOS CON QR (ONERRD y
// "Crear certificados"): comparar la clave y entregar el PDF guardado en
// Storage. Una sola pieza para que ninguna de las dos lo haga a su modo.
// ----------------------------------------------------------------------

// Comparación en tiempo constante: no deja adivinar la clave letra a letra.
export const mismaClave = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const respuestaDeTexto = (mensaje, status) =>
  new Response(mensaje, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });

// `archivo`: un File del bucket del Admin SDK. Con `descargar`, se baja en vez
// de abrirse.
export const respuestaDePdf = async (archivo, { nombre, descargar = false }) => {
  try {
    const [bytes] = await archivo.download();
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${descargar ? 'attachment' : 'inline'}; filename="${nombre}"`,
        'content-length': String(bytes.length),
        // Privado: el enlace lleva la clave y no debe quedar en cachés compartidas.
        'cache-control': 'private, max-age=300',
        'x-robots-tag': 'noindex',
      },
    });
  } catch (error) {
    console.error('[certificados] no se pudo leer el PDF', error);
    return respuestaDeTexto('Servicio no disponible.', 503);
  }
};

// La respuesta de la ruta del PDF según lo que encontró la búsqueda.
export const responderPdfDeCertificado = (busqueda, { nombre, descargar }) => {
  if (busqueda.estado === 'no-disponible') {
    return respuestaDeTexto('Servicio no disponible.', 503);
  }
  if (busqueda.estado !== 'ok') return respuestaDeTexto('Certificado no encontrado.', 404);
  return respuestaDePdf(busqueda.archivo, { nombre, descargar });
};
