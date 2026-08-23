import 'server-only';

import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';
import {
  crearCodigoUnUso,
  buscarAccesoMiembro,
  LARGO_CODIGO_UN_USO,
  numeroDeCodigoMiembro,
  CAMPO_BUSQUEDA_NUMERO,
  MINUTOS_CODIGO_UN_USO,
  identificarSolicitante,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// El coordinador le da a un miembro un codigo para que se ponga contraseña.
//
// El codigo NO cambia la contraseña que el miembro tenga: mientras no lo use,
// sigue entrando con la suya de siempre. El codigo se escribe en el campo de
// CONTRASEÑA del inicio de sesion normal: con el se entra una vez y solo a
// "Crea tu contraseña", y deja de valer en cuanto elige una.
//
// Se devuelve UNA vez, para que el coordinador se lo dicte. Guardado queda solo
// su huella, con la que se comprueba pero desde la que no se puede volver al
// codigo. Vence en una hora y muere al usarse.
// ----------------------------------------------------------------------

const COLECCION = 'usuarios_roles';

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede generar códigos ahora mismo.' },
        { status: 503 }
      );
    }

    const { idMiembros, codigoMiembro, correo } = await req.json();

    if (!idMiembros && !codigoMiembro) {
      return Response.json({ error: 'Falta identificar al miembro.' }, { status: 400 });
    }

    if (!numeroDeCodigoMiembro(codigoMiembro)) {
      return Response.json(
        { error: 'Ese miembro no tiene código de usuario, así que no podría escribirlo.' },
        { status: 400 }
      );
    }

    // Quien pide y a quien se le genera, a la vez: son dos busquedas que no se
    // necesitan entre si y en serie sumaban casi un segundo de espera. Nada se
    // ESCRIBE hasta despues de comprobar el permiso, unas lineas mas abajo.
    const [solicitante, { cuenta, perfil }] = await Promise.all([
      identificarSolicitante(req),
      buscarAccesoMiembro({ idMiembros, codigoMiembro, correo }),
    ]);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    if (!solicitante.puedeGestionarOtros) {
      return Response.json(
        { error: 'Tu rol no puede restablecer la contraseña de otros miembros.' },
        { status: 403 }
      );
    }

    if (!cuenta) {
      return Response.json(
        { error: 'Ese miembro todavía no tiene cuenta de acceso.' },
        { status: 404 }
      );
    }

    const { codigo, expiraEn, registro } = crearCodigoUnUso({
      uid: cuenta.uid,
      generadoPor: solicitante.uid,
    });

    // El perfil ya viene de la busqueda anterior: volver a pedirlo era otro
    // viaje a Firestore para traer lo mismo.
    const referencia =
      perfil?.ref ?? getAdminDb().collection(COLECCION).doc(String(idMiembros || cuenta.uid));

    await referencia.set(
      {
        uid: cuenta.uid,
        [CAMPO_BUSQUEDA_NUMERO]: numeroDeCodigoMiembro(codigoMiembro),
        codigoRestablecimiento: registro,
      },
      { merge: true }
    );

    return Response.json({ codigo, expiraEn, largo: LARGO_CODIGO_UN_USO, minutos: MINUTOS_CODIGO_UN_USO });
  } catch (error) {
    console.error('[codigo-restablecimiento] no se pudo generar', error);

    return Response.json({ error: 'No pudimos generar el código.' }, { status: 500 });
  }
}
