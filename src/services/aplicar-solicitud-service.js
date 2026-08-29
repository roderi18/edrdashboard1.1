import { eliminarArchivoDeStorage } from 'src/utils/firebase-photos';

import { updateRegional, aplicarFotoRegion } from './regional-service';
import { guardarAsignacionDirectiva } from './directivas-organizacionales-service';
import { createDestApi, updateDestApi, aplicarFotoDestacamento } from './dest-service';
import { saveSectional, updateSectional, aplicarFotoSeccion } from './sectional-service';
import { AMBITOS_CAMBIO, ESTADOS_CAMBIO, resolverSolicitudCambio } from './solicitudes-cambio-service';

// ----------------------------------------------------------------------
// Aplicar lo aprobado.
//
// No se guarda una copia de la escritura: se vuelve a llamar a la MISMA funcion
// por la que entro el cambio, esta vez con la Oficina Nacional como usuario. Al
// tener ella permiso para aplicar directo, la puerta la deja pasar y el cambio
// se escribe.
//
// Hacerlo asi —y no con una escritura aparte— evita el fallo clasico de estos
// sistemas: que la ruta de aprobacion se desincronice de la ruta normal y acabe
// guardando algo distinto de lo que se propuso.
// ----------------------------------------------------------------------

const APLICADORES = {
  // Como en secciones: sin id es un destacamento que todavia no existe —lo
  // sugirio un cargo de seccion— y hay que crearlo, no modificarlo.
  [AMBITOS_CAMBIO.destacamento]: (payload, usuario) =>
    Number(payload?.idDestacamento ?? payload?.id ?? 0) > 0
      ? updateDestApi(payload, { usuario })
      : createDestApi(payload, { usuario }),
  // La foto ya esta subida: aprobarla es apuntarla como principal.
  [AMBITOS_CAMBIO.fotoDestacamento]: (payload) => aplicarFotoDestacamento(payload),
  [AMBITOS_CAMBIO.fotoSeccion]: (payload) => aplicarFotoSeccion(payload),
  [AMBITOS_CAMBIO.fotoRegion]: (payload) => aplicarFotoRegion(payload),
  // El mismo ambito cubre el alta y la modificacion: sin `idSeccion` es una
  // seccion que todavia no existe, y aplicarla con `updateSectional` habria
  // intentado modificar la seccion 0.
  [AMBITOS_CAMBIO.seccion]: (payload, usuario) =>
    Number(payload?.idSeccion ?? payload?.id ?? 0) > 0
      ? updateSectional(payload, { usuario })
      : saveSectional(payload, { usuario }),
  [AMBITOS_CAMBIO.region]: (payload, usuario) => updateRegional(payload, { usuario }),
  [AMBITOS_CAMBIO.directivaSeccion]: (payload, usuario) =>
    guardarAsignacionDirectiva({ ...payload, usuario }),
  [AMBITOS_CAMBIO.directivaRegion]: (payload, usuario) =>
    guardarAsignacionDirectiva({ ...payload, usuario }),
  [AMBITOS_CAMBIO.directivaNacional]: (payload, usuario) =>
    guardarAsignacionDirectiva({ ...payload, usuario }),
};

/**
 * `payload` sustituye al de la propuesta cuando se aprueba SOLO UNA PARTE: quien
 * resuelve devuelve los campos rechazados a su valor anterior y lo que se
 * escribe es esa mezcla, no lo que se propuso.
 */
export async function aprobarSolicitud(solicitud, { usuario, comentario = '', payload = null } = {}) {
  return resolverSolicitudCambio(solicitud.id, {
    estado: ESTADOS_CAMBIO.aprobada,
    usuario,
    comentario,
    aplicar: async (guardada) => {
      const aplicador = APLICADORES[guardada.ambito];
      const datos = payload || guardada.payload;

      if (!aplicador) {
        throw new Error(`No hay forma de aplicar un cambio de tipo "${guardada.ambito}".`);
      }

      if (!datos) {
        throw new Error(
          'La propuesta no guardó los datos del cambio, así que no se puede aplicar. Pídele a quien la envió que la vuelva a hacer.'
        );
      }

      await aplicador(datos, usuario);
    },
  });
}

// Que hacer con lo que la propuesta dejo a medias cuando NO sale adelante. La
// foto sugerida ya esta subida: si se rechaza, nada la referencia y se queda
// ocupando sitio para siempre.
const LIMPIADORES = {
  [AMBITOS_CAMBIO.fotoDestacamento]: (payload) => eliminarArchivoDeStorage(payload?.rutaArchivo),
  [AMBITOS_CAMBIO.fotoSeccion]: (payload) => eliminarArchivoDeStorage(payload?.rutaArchivo),
  [AMBITOS_CAMBIO.fotoRegion]: (payload) => eliminarArchivoDeStorage(payload?.rutaArchivo),
};

export async function rechazarSolicitud(solicitud, { usuario, comentario = '' } = {}) {
  const resultado = await resolverSolicitudCambio(solicitud.id, {
    estado: ESTADOS_CAMBIO.rechazada,
    usuario,
    comentario,
  });

  // Despues de resolver y sin bloquear: el rechazo ya esta escrito y avisado, y
  // un archivo que no se pudo borrar no lo invalida.
  const limpiar = LIMPIADORES[solicitud?.ambito];

  if (limpiar && solicitud?.payload) {
    limpiar(solicitud.payload).catch((error) => {
      console.warn('[aprobaciones] no se pudo limpiar lo que dejo la propuesta', error);
    });
  }

  return resultado;
}
