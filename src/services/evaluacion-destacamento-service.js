import { getDoc } from 'firebase/firestore';

import { leerConCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  EVALUACION_VACIA,
  cambiosDeEvaluacion,
  normalizarEvaluacion,
} from 'src/utils/evaluacion-destacamento.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { escribirEvaluacion, referenciaDeEvaluacion } from './evaluacion-destacamento-apply';

// ----------------------------------------------------------------------
// EVALUACIÓN DEL DESTACAMENTO (`evaluaciones_destacamentos/{idDestacamento}`).
//
// La cambian el Administrador Global y la Oficina Nacional: se aplica en el
// acto, pero pasa por la puerta de cambios para que quede en Historial quién la
// puso y qué había antes.
// ----------------------------------------------------------------------

const quienEs = (usuario) => String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '');

/** Sin documento (o sin Firebase), la evaluación vacía. */
export function leerEvaluacionDeDestacamento(idDestacamento) {
  if (!idDestacamento || !isFirebaseConfigured || !FIRESTORE) {
    return Promise.resolve({ ...EVALUACION_VACIA });
  }

  return leerConCache(`evaluacion-destacamento:${idDestacamento}`, async () => {
    const snap = await getDoc(referenciaDeEvaluacion(idDestacamento));
    return normalizarEvaluacion(snap.exists() ? snap.data() : {});
  });
}

async function guardarEvaluacionDirecto({
  idDestacamento,
  valores,
  anterior,
  usuario = {},
  nombre = '',
}) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  const nueva = normalizarEvaluacion(valores);
  const cambios = cambiosDeEvaluacion(anterior, nueva);

  if (!cambios.length) return { estado: 'sin_cambios' };

  return proponerCambio({
    ambito: AMBITOS_CAMBIO.evaluacionDestacamento,
    entidad: {
      tipo: 'destacamento',
      id: String(idDestacamento),
      nombre,
      ruta: `/dashboard/level/dest/${idDestacamento}/edit/evaluation`,
    },
    cambios,
    usuario,
    descripcion: `Evaluación del destacamento${nombre ? ` ${nombre}` : ''} actualizada.`,
    lecturasAfectadas: [`evaluacion-destacamento:${idDestacamento}`],
    aplicar: () => escribirEvaluacion(idDestacamento, nueva, quienEs(usuario)),
  });
}

export const guardarEvaluacionDeDestacamento = conInvalidacion(guardarEvaluacionDirecto, [
  'evaluacion-destacamento:',
]);
