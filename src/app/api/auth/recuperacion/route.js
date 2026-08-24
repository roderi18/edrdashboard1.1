import 'server-only';

import { limiteSuperado } from 'src/server/limite-intentos';
import { isAdminConfigured } from 'src/server/firebase-admin';
import { pedirAyudaAlCoordinador } from 'src/server/coordinadores-recuperacion';
import { esCorreoInterno, buscarCuentaMiembro } from 'src/server/claves-miembro';
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

// El mismo mensaje para "no existe ese numero" y "existe pero no tiene correo
// propio": distinguirlos es confirmarle a un desconocido quien esta dado de alta.
const SIN_CORREO =
  'No podemos enviarte un enlace: tu cuenta no tiene un correo propio verificado. Usa el botón de abajo para pedirle ayuda a tu Coordinador.';

const normalizarCorreo = (correo) =>
  String(correo ?? '')
    .trim()
    .toLowerCase();

// ----------------------------------------------------------------------
// ¿Le puede llegar el enlace, y a que direccion?
//
// El enlace de Firebase cambia la clave de LA CUENTA QUE TENGA ESE CORREO. El de
// la ficha casi nunca es el de la cuenta —la cuenta usa
// `<codigo>@exploradores.app`—, y mandarlo a ciegas le cambiaba la clave A OTRA
// PERSONA. Le paso al administrador: pidio recuperar la de un miembro y termino
// cambiando la suya.
// ----------------------------------------------------------------------
const resolverEnlace = async (numeroUsuario) => {
  const ficha = await buscarMiembroPorNumero(numeroUsuario);

  if (!ficha) return { puedeEnviar: false, error: SIN_CORREO };

  const datos = datosMinimosDeMiembro(ficha);
  const cuenta = await buscarCuentaMiembro({
    idMiembros: datos.idMiembros,
    codigoMiembro: datos.codigoMiembro,
    correo: datos.correo,
  });
  const correoCuenta = normalizarCorreo(cuenta?.email);

  if (!correoCuenta || esCorreoInterno(correoCuenta)) {
    return { puedeEnviar: false, error: SIN_CORREO };
  }

  // El correo de la ficha y el de la cuenta pueden haberse separado: manda el de
  // la cuenta, que es al que Firebase enviara el enlace de verdad.
  if (correoCuenta !== datos.correo) {
    return {
      puedeEnviar: false,
      error:
        'El correo de tu ficha no es el de tu cuenta de acceso, así que el enlace no te llegaría. Pídele la recuperación a tu Coordinador con el botón de abajo.',
    };
  }

  return { puedeEnviar: true, correo: correoCuenta };
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
