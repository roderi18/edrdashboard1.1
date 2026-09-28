import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_EVALUACIONES_DESTACAMENTOS } from 'src/utils/evaluacion-destacamento.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA la evaluación de un destacamento.
//
// Mismo caso que `estado-destacamentos-apply.js`: aquí solo vive la escritura
// que `proponerCambio` ejecuta DESPUÉS de haberla registrado en Historial.
// ----------------------------------------------------------------------

export const referenciaDeEvaluacion = (idDestacamento) =>
  doc(FIRESTORE, COLECCION_EVALUACIONES_DESTACAMENTOS, String(idDestacamento));

export const escribirEvaluacion = (idDestacamento, evaluacion, actualizadoPor = '') =>
  setDoc(referenciaDeEvaluacion(idDestacamento), {
    idDestacamento: String(idDestacamento),
    ...evaluacion,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });
