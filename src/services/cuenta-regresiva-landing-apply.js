import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import {
  DOC_CUENTA_REGRESIVA,
  COLECCION_CONFIG_LANDING,
} from 'src/utils/cuenta-regresiva-landing.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA la cuenta atrás de la landing de registro.
//
// Mismo caso que `estado-destacamentos-apply.js`: aquí solo vive la escritura
// que `proponerCambio` ejecuta DESPUÉS de haberla registrado en Historial.
// ----------------------------------------------------------------------

export const referenciaCuentaRegresiva = () =>
  doc(FIRESTORE, COLECCION_CONFIG_LANDING, DOC_CUENTA_REGRESIVA);

export const escribirCuentaRegresiva = (valores, actualizadoPor = {}) =>
  setDoc(referenciaCuentaRegresiva(), {
    ...valores,
    actualizadoPor,
    actualizadoEn: serverTimestamp(),
  });
