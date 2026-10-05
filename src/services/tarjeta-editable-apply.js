import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_TARJETAS_DESARROLLO } from 'src/utils/tarjeta-editable.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el guardado de la tarjeta editable. Como los demás
// `-apply`: aquí solo vive la escritura que `proponerCambio` ejecuta DESPUÉS de
// haberla registrado en Historial.
// ----------------------------------------------------------------------

export const escribirTarjetaEditable = (id, tarjeta, actualizadoPor = '') =>
  setDoc(doc(FIRESTORE, COLECCION_TARJETAS_DESARROLLO, id), {
    ...tarjeta,
    actualizadoPor,
    actualizadoEn: serverTimestamp(),
  });
