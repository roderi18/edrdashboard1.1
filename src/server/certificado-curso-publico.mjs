import { esIdCertificadoValido, esClaveCertificadoValida } from 'src/utils/certificado-publico.mjs';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { mismaClave } from 'src/server/certificado-publico.mjs';
import { getAdminDb, getAdminBucket, isAdminConfigured } from 'src/server/firebase-admin';

// ----------------------------------------------------------------------
// LA BÚSQUEDA DE UN CERTIFICADO DE "CREAR CERTIFICADOS" POR SU QR, para la
// página que abre el QR y para la ruta que entrega el PDF (las dos preguntan
// aquí, como en el ONERRD).
//
// Estados: 'ok' (con `certificado` y `archivo`), 'no-encontrado' (no existe o
// la clave no es la suya: no se distingue), 'sin-pdf' y 'no-disponible'.
// Solo entran los que llevan `claveAcceso` (los creados desde que el QR abre
// esta página); los de antes siguen llevando la URL directa del PDF.
// ----------------------------------------------------------------------

export const buscarCertificadoPublico = async (id, clave) => {
  if (!esIdCertificadoValido(id) || !esClaveCertificadoValida(clave)) {
    return { estado: 'no-encontrado' };
  }

  if (!isAdminConfigured()) return { estado: 'no-disponible' };

  try {
    const doc = await getAdminDb().collection(COLECCIONES.certificados).doc(id).get();

    if (!doc.exists || !mismaClave(doc.get('claveAcceso') || '', clave)) {
      return { estado: 'no-encontrado' };
    }

    const certificado = doc.data();
    const ruta = String(certificado.rutaPdf || '');
    // Solo su PDF, dentro de la carpeta de los certificados.
    if (!ruta.startsWith('certificados/') || ruta.includes('..')) {
      return { estado: 'sin-pdf', certificado };
    }

    const archivo = getAdminBucket().file(ruta);
    const [existe] = await archivo.exists();

    return existe ? { estado: 'ok', certificado, archivo } : { estado: 'sin-pdf', certificado };
  } catch (error) {
    console.error('[certificados] no se pudo consultar el certificado', error);
    return { estado: 'no-disponible' };
  }
};
