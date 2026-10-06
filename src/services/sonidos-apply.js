import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE } from 'src/lib/firebase';
import { COLECCIONES } from 'src/config/esquema-firestore.mjs';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA los sonidos de aviso.
//
// Mismo caso que `store-settings-apply.js`: aqui solo vive la escritura que
// `proponerCambio` ejecuta DESPUES de haberla registrado en Historial. No es una
// puerta paralela; la regla de ESLint mira la sintaxis y no puede distinguirlo.
// ----------------------------------------------------------------------

export const COLECCION_SONIDOS = COLECCIONES.configuracionSonidos;
export const DOCUMENTO_SONIDOS = 'avisos';

export const referenciaDeLosSonidos = () => doc(FIRESTORE, COLECCION_SONIDOS, DOCUMENTO_SONIDOS);

export const escribirSonidosDeAviso = (eleccion) =>
  setDoc(
    referenciaDeLosSonidos(),
    { ...eleccion, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
