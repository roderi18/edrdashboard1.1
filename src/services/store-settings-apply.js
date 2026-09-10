import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el encabezado de la tienda.
//
// Mismo caso que `primer-acceso-service.js` y `tutores-service.js`: aqui solo
// vive la escritura que `proponerCambio` ejecuta DESPUES de haber registrado el
// cambio en Historial. No es una puerta paralela —nadie llama a esto sin pasar
// antes por la puerta—, pero la regla de ESLint mira la sintaxis y no puede
// distinguir una cosa de la otra.
//
// Si algun dia hace falta escribir algo mas de la configuracion de la tienda,
// que sea aqui y por el mismo camino.
// ----------------------------------------------------------------------

export const COLECCION_CONFIGURACION_TIENDA = 'configuracion_tienda';
export const DOCUMENTO_ENCABEZADO_TIENDA = 'encabezado';

export const referenciaDelEncabezadoTienda = () =>
  doc(FIRESTORE, COLECCION_CONFIGURACION_TIENDA, DOCUMENTO_ENCABEZADO_TIENDA);

export const escribirEncabezadoTienda = (encabezado) =>
  setDoc(
    referenciaDelEncabezadoTienda(),
    { ...encabezado, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
