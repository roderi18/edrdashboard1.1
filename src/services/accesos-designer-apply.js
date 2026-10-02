import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import {
  DOCUMENTO_ACCESOS_DESIGNER,
  COLECCION_CONFIGURACION_DESIGNER,
} from 'src/utils/accesos-designer.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA los accesos de EXPLORA Designer. Como los demás `-apply`:
// aquí solo vive la escritura que `proponerCambio` ejecuta DESPUÉS de haberla
// registrado en Historial.
// ----------------------------------------------------------------------

export const escribirAccesosDesigner = (documento, actualizadoPor = '') =>
  setDoc(doc(FIRESTORE, COLECCION_CONFIGURACION_DESIGNER, DOCUMENTO_ACCESOS_DESIGNER), {
    ...documento,
    actualizadoPor,
    actualizadoEn: serverTimestamp(),
  });
