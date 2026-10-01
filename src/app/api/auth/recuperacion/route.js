import 'server-only';

import { correoDelEnlace, SIN_CORREO_PROPIO } from 'src/utils/enlace-de-recuperacion.mjs';

import { limiteSuperado } from 'src/server/limite-intentos';
import { isAdminConfigured } from 'src/server/firebase-admin';
import { buscarCuentaMiembro } from 'src/server/claves-miembro';
import { pedirAyudaAlCoordinador } from 'src/server/coordinadores-recuperacion';
import { datosMinimosDeMiembro, buscarMiembroPorNumero } from 'src/server/miembros-directorio';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// "Olvidé mi contraseña", del lado del servidor.
//
// La pantalla hacia las dos cosas por su cuenta y SIN SESION: se descargaba el
// padron entero para encontrar al miembro y su correo, y leia el organigrama y
// `usuarios_roles` para escribirles a los coordinadores. Eso obligaba a tener
// abierto a cualquiera justo lo que mas hay que cerrar.
//
// Ahora la pantalla solo dice su numero. Aqui se resuelve todo y de vuelta va lo
// justo: si se le puede mandar el enlace y a donde, o a quien se le pidio ayuda.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// ¿Le puede llegar el enlace, y a que direccion? Al correo de SU CUENTA, nunca al
// de la ficha: la regla y lo que se rompia, en `enlace-de-recuperacion.mjs`.
// ----------------------------------------------------------------------
const resolverEnlace = async (numeroUsuario) => {
  const ficha = await buscarMiembroPorNumero(numeroUsuario);

  if (!ficha) return { puedeEnviar: false, error: SIN_CORREO_PROPIO };

  const datos = datosMinimosDeMiembro(ficha);
  const cuenta = await buscarCuentaMiembro({
    idMiembros: datos.idMiembros,
    codigoMiembro: datos.codigoMiembro,
    correo: datos.correo,
  });

  return correoDelEnlace(cuenta?.email);
};

const AVISOS = {
  sin_miembro: 'No pudimos identificar tu destacamento. Contacta a tu Coordinador directamente.',
  sin_destacamento: 'No pudimos identificar tu destacamento. Contacta a tu Coordinador directamente.',
  sin_coordinador: 'Tu destacamento aún no tiene coordinador asignado en la directiva.',
};

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede atender recuperaciones ahora mismo.' },
        { status: 503 }
      );
    }

    const { accion, numeroUsuario } = await req.json();
    const numero = String(numeroUsuario ?? '').replace(/\D/g, '');

    if (!numero) {
      return Response.json({ error: 'Falta tu código de usuario.' }, { status: 400 });
    }

    // Dos limites: por IP contra el barrido, y por numero para que nadie pueda
    // llenarle el panel de avisos a los coordinadores de un destacamento.
    const frenado =
      limiteSuperado(req, { grupo: 'recuperacion-ip', maximo: 10, ventanaMs: 60 * 1000 }) ??
      limiteSuperado(req, {
        grupo: 'recuperacion-miembro',
        identificador: numero,
        porOrigen: false,
        maximo: 5,
        ventanaMs: 60 * 60 * 1000,
      });

    if (frenado) return frenado;

    if (accion === 'coordinador') {
      const { motivo, enviadas, coordinadores } = await pedirAyudaAlCoordinador({
        numeroUsuario: numero,
      });

      return Response.json({
        enviadas,
        coordinadores,
        aviso: AVISOS[motivo] ?? '',
      });
    }

    return Response.json(await resolverEnlace(numero));
  } catch (error) {
    console.error('[recuperacion] no se pudo atender', error);

    return Response.json({ error: 'No pudimos atender la solicitud.' }, { status: 500 });
  }
}
