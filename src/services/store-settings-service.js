import { getDoc } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import {
  escribirEncabezadoTienda,
  DOCUMENTO_ENCABEZADO_TIENDA,
  referenciaDelEncabezadoTienda,
  COLECCION_CONFIGURACION_TIENDA,
} from './store-settings-apply';

// ----------------------------------------------------------------------
// EL ENCABEZADO DE LA TIENDA, ESCRITO POR EL ADMINISTRADOR GLOBAL.
//
// Un solo documento —el mismo patron que `respaldos_admin/ultimo`—: la tienda es
// una y su encabezado tambien. Si no existe, se sirven los textos de abajo, que
// es lo que se ve mientras nadie lo haya cambiado.
//
// Quien escribe lo decide `firestore.rules`: leer, cualquier sesion del sistema;
// escribir, solo el Administrador Global.
//
// Y se escribe POR LA PUERTA (`proponerCambio`), como todo en este proyecto: el
// ambito `tienda` se aplica en el momento, pero queda en Historial. Un texto que
// leen todos los que entran a la tienda no puede cambiar sin que conste quien lo
// cambio.
// ----------------------------------------------------------------------

export { DOCUMENTO_ENCABEZADO_TIENDA, COLECCION_CONFIGURACION_TIENDA };

export const ENCABEZADO_TIENDA_POR_DEFECTO = {
  titulo: 'Exploradores del Rey',
  subtitulo: 'Equipando hoy a los líderes del mañana',
};

const limpiar = (valor) => String(valor ?? '').trim();

const leerEncabezado = async () => {
  const instantanea = await getDoc(referenciaDelEncabezadoTienda()).catch(() => null);

  return instantanea?.exists() ? instantanea.data() : null;
};

const conValoresPorDefecto = (datos) => ({
  titulo: limpiar(datos?.titulo) || ENCABEZADO_TIENDA_POR_DEFECTO.titulo,
  subtitulo: limpiar(datos?.subtitulo) || ENCABEZADO_TIENDA_POR_DEFECTO.subtitulo,
});

/** Los textos guardados, o los de por defecto. Nunca lanza: es la portada. */
export async function obtenerEncabezadoTienda() {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return ENCABEZADO_TIENDA_POR_DEFECTO;
  }

  return conValoresPorDefecto(await leerEncabezado());
}

/**
 * Guarda los dos textos.
 *
 * Un campo vacio NO borra el texto: vuelve al de por defecto. Un encabezado en
 * blanco no es una decision que nadie quiera tomar sin querer.
 */
export async function guardarEncabezadoTienda({ titulo, subtitulo } = {}, usuario = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  const anterior = conValoresPorDefecto(await leerEncabezado());
  const encabezado = conValoresPorDefecto({ titulo, subtitulo });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.tienda,
    entidad: {
      tipo: 'configuracion',
      id: DOCUMENTO_ENCABEZADO_TIENDA,
      nombre: 'Encabezado de la tienda',
      ruta: '/dashboard/product',
    },
    cambios: [
      {
        campo: 'titulo',
        etiqueta: 'Título',
        antes: anterior.titulo,
        despues: encabezado.titulo,
      },
      {
        campo: 'subtitulo',
        etiqueta: 'Subtítulo',
        antes: anterior.subtitulo,
        despues: encabezado.subtitulo,
      },
    ],
    usuario,
    descripcion: 'Encabezado de la tienda actualizado.',
    aplicar: () => escribirEncabezadoTienda(encabezado),
  });

  return encabezado;
}
