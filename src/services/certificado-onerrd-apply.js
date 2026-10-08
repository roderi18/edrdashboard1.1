import { ref, uploadBytes } from 'firebase/storage';
import { doc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import {
  anioActualOnerrd,
  idContadorFacturasOnerrd,
  formatearNumeroFacturaOnerrd,
} from 'src/utils/factura-onerrd.mjs';
import {
  rutaPdfOnerrd,
  idContadorOnerrd,
  sanearDisenoOnerrd,
  rutaFacturaPdfOnerrd,
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
// La factura reserva su número correlativo igual, en la misma transacción.
export const escribirEmisionOnerrd = ({
  anio,
  valores,
  firmas,
  diseno,
  autor,
  claveAcceso,
  factura,
  disenoFactura,
}) => {
  const refContador = doc(FIRESTORE, COLECCION_ONERRD, idContadorOnerrd(anio));
  // El de las facturas, por el año en que se emite (ONERRD-2026-001…).
  const anioFactura = anioActualOnerrd();
  const refFacturas = doc(FIRESTORE, COLECCION_ONERRD, idContadorFacturasOnerrd(anioFactura));

  return runTransaction(FIRESTORE, async (transaccion) => {
    const contador = await transaccion.get(refContador);
    const facturas = factura ? await transaccion.get(refFacturas) : null;
    const secuenciaFactura = factura
      ? siguienteSecuenciaOnerrd(facturas.exists() ? facturas.data().ultimo : 0)
      : 0;
    const numeroFactura = factura
      ? formatearNumeroFacturaOnerrd(anioFactura, secuenciaFactura)
      : '';
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
      ...(factura && { factura: { ...factura, numero: numeroFactura } }),
      ...(disenoFactura && { disenoFactura }),
      emitidoEnIso: ahora,
      emitidoPor: autor,
      emitidoEnServidor: serverTimestamp(),
    };

    transaccion.set(refContador, { anio: Number(anio), ultimo: secuencia, actualizadoEn: ahora });
    if (factura) {
      transaccion.set(refFacturas, {
        anio: anioFactura,
        ultimo: secuenciaFactura,
        actualizadoEn: ahora,
      });
    }
    transaccion.set(refEmitido, emitido);

    return { id: numeroRegistro, ...emitido };
  });
};

// El PDF emitido, en Storage: es lo que abre el código QR y lo que se
// descarga en "Certificados creados". Se sube al emitir (con reintentos) y
// nunca se borra.
export const subirPdfOnerrd = (numeroRegistro, blob) =>
  uploadBytes(ref(FIREBASE_STORAGE, rutaPdfOnerrd(numeroRegistro)), blob, {
    contentType: 'application/pdf',
    cacheControl: 'private, max-age=300',
  });

// El ORIGINAL de una plantilla (.svg) o de una firma, tal cual se subió
// (`rutaPlantillaOnerrd` / `rutaFirmaOnerrd`). La app no lo lee: pinta desde
// Firestore. Es para no perder el archivo.
export const subirOriginalOnerrd = (ruta, archivo) =>
  uploadBytes(ref(FIREBASE_STORAGE, ruta), archivo, {
    contentType: archivo.type || 'application/octet-stream',
    customMetadata: { modulo: 'certificado-onerrd', nombreOriginal: archivo.name || '' },
  });

// La factura emitida, en Storage: lo que abre su QR. Se sube al emitir.
export const subirFacturaPdfOnerrd = (numeroRegistro, blob) =>
  uploadBytes(ref(FIREBASE_STORAGE, rutaFacturaPdfOnerrd(numeroRegistro)), blob, {
    contentType: 'application/pdf',
    cacheControl: 'private, max-age=300',
  });

// La configuración de la membresía ONERRD 2027 (la lee la landing de pago).
export const escribirConfiguracionMembresia = (datos, autor) =>
  setDoc(doc(FIRESTORE, COLECCIONES.configuracionMembresia2027, 'general'), {
    ...datos,
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: autor,
    actualizadoEnServidor: serverTimestamp(),
  });
