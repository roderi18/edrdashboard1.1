import { updateRegional } from './regional-service';
import { updateSectional } from './sectional-service';
import { updateDestApi, aplicarFotoDestacamento } from './dest-service';
import { guardarAsignacionDirectiva } from './directivas-organizacionales-service';
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
  [AMBITOS_CAMBIO.destacamento]: (payload, usuario) => updateDestApi(payload, { usuario }),
  // La foto ya esta subida: aprobarla es apuntarla como principal.
  [AMBITOS_CAMBIO.fotoDestacamento]: (payload) => aplicarFotoDestacamento(payload),
  [AMBITOS_CAMBIO.seccion]: (payload, usuario) => updateSectional(payload, { usuario }),
  [AMBITOS_CAMBIO.region]: (payload, usuario) => updateRegional(payload, { usuario }),
  [AMBITOS_CAMBIO.directivaSeccion]: (payload, usuario) =>
    guardarAsignacionDirectiva({ ...payload, usuario }),
  [AMBITOS_CAMBIO.directivaRegion]: (payload, usuario) =>
    guardarAsignacionDirectiva({ ...payload, usuario }),
  [AMBITOS_CAMBIO.directivaNacional]: (payload, usuario) =>
    guardarAsignacionDirectiva({ ...payload, usuario }),
};

export async function aprobarSolicitud(solicitud, { usuario, comentario = '' } = {}) {
  return resolverSolicitudCambio(solicitud.id, {
    estado: ESTADOS_CAMBIO.aprobada,
    usuario,
    comentario,
    aplicar: async (guardada) => {
      const aplicador = APLICADORES[guardada.ambito];

      if (!aplicador) {
        throw new Error(`No hay forma de aplicar un cambio de tipo "${guardada.ambito}".`);
      }

      if (!guardada.payload) {
        throw new Error(
          'La propuesta no guardó los datos del cambio, así que no se puede aplicar. Pídele a quien la envió que la vuelva a hacer.'
        );
      }

      await aplicador(guardada.payload, usuario);
    },
  });
}

export async function rechazarSolicitud(solicitud, { usuario, comentario = '' } = {}) {
  return resolverSolicitudCambio(solicitud.id, {
    estado: ESTADOS_CAMBIO.rechazada,
    usuario,
    comentario,
  });
}
