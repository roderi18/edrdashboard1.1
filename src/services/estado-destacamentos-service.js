import { getDoc, getDocs, collection } from 'firebase/firestore';

import { leerConCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  ESTADOS_DESTACAMENTO,
  etiquetaEstadoDestacamento,
  normalizarEstadoDestacamento,
  COLECCION_ESTADO_DESTACAMENTOS,
} from 'src/utils/estado-destacamento.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import {
  escribirEstadoDeDestacamento,
  referenciaDeEstadoDeDestacamento,
} from './estado-destacamentos-apply';

// ----------------------------------------------------------------------
// ESTADO DEL DESTACAMENTO (`estado_destacamentos/{idDestacamento}`).
//
// Lo mueven el Administrador Global y la Oficina Nacional, así que se aplica en
// el acto, pero pasa por la puerta de cambios para que quede en Historial quién
// dio de baja (o de alta) un destacamento.
// ----------------------------------------------------------------------

const quienEs = (usuario) => String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '');

/** Sin documento (o sin Firebase) el destacamento es Activo. */
export function leerEstadoDeDestacamento(idDestacamento) {
  if (!idDestacamento || !isFirebaseConfigured || !FIRESTORE) {
    return Promise.resolve(ESTADOS_DESTACAMENTO.activo);
  }

  return leerConCache(`estado-destacamento:${idDestacamento}`, async () => {
    const snap = await getDoc(referenciaDeEstadoDeDestacamento(idDestacamento));
    return normalizarEstadoDestacamento(snap.exists() ? snap.data()?.estado : null);
  });
}

/**
 * Todos los estados de una vez, para la lista: id → estado. El que no tiene
 * documento no sale (y es Activo). Una lectura por destacamento eran cientos.
 */
export function leerEstadosDeDestacamentos() {
  if (!isFirebaseConfigured || !FIRESTORE) return Promise.resolve(new Map());

  return leerConCache('estado-destacamento:todos', async () => {
    const snap = await getDocs(collection(FIRESTORE, COLECCION_ESTADO_DESTACAMENTOS));
    return new Map(
      snap.docs.map((d) => [String(d.id), normalizarEstadoDestacamento(d.data()?.estado)])
    );
  });
}

async function guardarEstadoDeDestacamentoDirecto({
  idDestacamento,
  estado,
  anterior,
  usuario = {},
  nombre = '',
}) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  const nuevo = normalizarEstadoDestacamento(estado);
  const antes = normalizarEstadoDestacamento(anterior);

  if (nuevo === antes) return { estado: 'sin_cambios' };

  return proponerCambio({
    ambito: AMBITOS_CAMBIO.estadoDestacamento,
    entidad: {
      tipo: 'destacamento',
      id: String(idDestacamento),
      nombre,
      ruta: '/dashboard/level/dest',
    },
    cambios: [
      {
        campo: 'estado',
        etiqueta: 'Estado',
        antes: etiquetaEstadoDestacamento(antes),
        despues: etiquetaEstadoDestacamento(nuevo),
      },
    ],
    usuario,
    descripcion: `Estado del destacamento${nombre ? ` ${nombre}` : ''}: ${etiquetaEstadoDestacamento(nuevo)}.`,
    lecturasAfectadas: [`estado-destacamento:${idDestacamento}`],
    aplicar: () => escribirEstadoDeDestacamento(idDestacamento, nuevo, quienEs(usuario)),
  });
}

export const guardarEstadoDeDestacamento = conInvalidacion(guardarEstadoDeDestacamentoDirecto, [
  'estado-destacamento:',
]);
