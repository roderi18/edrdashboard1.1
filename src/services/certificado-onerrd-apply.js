import { ref, uploadBytes } from 'firebase/storage';
import { doc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import {
  rutaPdfOnerrd,
  idContadorOnerrd,
  sanearDisenoOnerrd,
  formatearNumeroOnerrd,
  siguienteSecuenciaOnerrd,
} from 'src/utils/certificado-onerrd.mjs';

import { FIRESTORE, FIREBASE_STORAGE } from 'src/lib/firebase';
import { COLECCIONES } from 'src/config/esquema-firestore.mjs';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el certificado ONERRD.
//
// Mismo caso que `sonidos-apply.js`: aquí solo viven las escrituras que
// `proponerCambio` ejecuta DESPUÉS de haberlas registrado en Historial
// (`certificado-onerrd-service.js`). No es una puerta paralela; la regla de
// ESLint mira la sintaxis y no puede distinguirlo.
// ----------------------------------------------------------------------

export const COLECCION_ONERRD = COLECCIONES.certificadosOnerrd;
export const COLECCION_ONERRD_EMITIDOS = COLECCIONES.certificadosOnerrdEmitidos;
export const COLECCION_ONERRD_FIRMAS = COLECCIONES.firmasCertificadosOnerrd;

export const escribirDocumentoOnerrd = (id, datos, autor) =>
  setDoc(doc(FIRESTORE, COLECCION_ONERRD, id), {
    ...datos,
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: autor,
    actualizadoEnServidor: serverTimestamp(),
  });

export const escribirFirmaOnerrd = (id, datos, { fusionar = false } = {}) =>
  setDoc(doc(FIRESTORE, COLECCION_ONERRD_FIRMAS, id), datos, { merge: fusionar });

// Reserva el siguiente número del año y deja el registro en la MISMA
// transacción: dos personas que emiten a la vez no pueden sacar el mismo
// número (Firestore relee el contador y una de las dos lo vuelve a intentar).
export const escribirEmisionOnerrd = ({ anio, valores, firmas, diseno, autor, claveAcceso }) => {
  const refContador = doc(FIRESTORE, COLECCION_ONERRD, idContadorOnerrd(anio));

  return runTransaction(FIRESTORE, async (transaccion) => {
    const contador = await transaccion.get(refContador);
    const secuencia = siguienteSecuenciaOnerrd(contador.exists() ? contador.data().ultimo : 0);
    const numeroRegistro = formatearNumeroOnerrd(anio, secuencia);
    const refEmitido = doc(FIRESTORE, COLECCION_ONERRD_EMITIDOS, numeroRegistro);
    const ahora = new Date().toISOString();

    const emitido = {
      numeroRegistro,
      anio: Number(anio),
      secuencia,
      valores: { ...valores, numeroRegistro },
      firmas,
      diseno: sanearDisenoOnerrd(diseno),
      // La clave del enlace del QR: sin ella la ruta pública no entrega el PDF.
      claveAcceso,
      emitidoEnIso: ahora,
      emitidoPor: autor,
      emitidoEnServidor: serverTimestamp(),
    };

    transaccion.set(refContador, { anio: Number(anio), ultimo: secuencia, actualizadoEn: ahora });
    transaccion.set(refEmitido, emitido);

    return { id: numeroRegistro, ...emitido };
  });
};

// El PDF emitido, en Storage: es lo que abre el código QR. Se vuelve a subir
// en cada descarga desde "Certificados emitidos" (si la primera vez falló, así
// se arregla) y nunca se borra.
export const subirPdfOnerrd = (numeroRegistro, blob) =>
  uploadBytes(ref(FIREBASE_STORAGE, rutaPdfOnerrd(numeroRegistro)), blob, {
    contentType: 'application/pdf',
    cacheControl: 'private, max-age=300',
  });
