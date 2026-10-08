import {
  rutaPdfOnerrd,
  esClaveOnerrdValida,
  esNumeroOnerrdValido,
} from 'src/utils/certificado-onerrd.mjs';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { mismaClave } from 'src/server/certificado-publico.mjs';
import { getAdminDb, getAdminBucket, isAdminConfigured } from 'src/server/firebase-admin';

// ----------------------------------------------------------------------
// LA BÚSQUEDA DE UN CERTIFICADO ONERRD POR SU QR, para la página que abre el QR
// y para la ruta que entrega el PDF. Las dos preguntan aquí: si cada una
// comprobara la clave a su modo, bastaría con que una se equivocara para
// entregar el certificado sin ella.
//
// Estados: 'ok' (con `emitido` y `archivo`), 'no-encontrado' (no existe o la
// clave no es la suya: no se distingue, para no confirmar números), 'sin-pdf'
// (emitido, pero su PDF aún no se guardó en Storage) y 'no-disponible'.
// ----------------------------------------------------------------------

// `ruta`: qué PDF entrega (el del certificado o, con `rutaFacturaPdfOnerrd`,
// su factura). La clave es la misma.
export const buscarCertificadoOnerrd = async (numero, clave, { ruta = rutaPdfOnerrd } = {}) => {
  if (!esNumeroOnerrdValido(numero) || !esClaveOnerrdValida(clave)) {
    return { estado: 'no-encontrado' };
  }

  if (!isAdminConfigured()) return { estado: 'no-disponible' };

  try {
    const doc = await getAdminDb()
      .collection(COLECCIONES.certificadosOnerrdEmitidos)
      .doc(numero)
      .get();

    if (!doc.exists || !mismaClave(doc.get('claveAcceso') || '', clave)) {
      return { estado: 'no-encontrado' };
    }

    const archivo = getAdminBucket().file(ruta(numero));
    const [existe] = await archivo.exists();
    const emitido = doc.data();

    return existe ? { estado: 'ok', emitido, archivo } : { estado: 'sin-pdf', emitido };
  } catch (error) {
    console.error('[certificados-onerrd] no se pudo consultar el certificado', error);
    return { estado: 'no-disponible' };
  }
};
