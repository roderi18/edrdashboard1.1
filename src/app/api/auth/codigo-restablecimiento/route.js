import 'server-only';

import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';
import { leerSecretos, guardarSecretos } from 'src/server/secretos-acceso';
import { resolverRolesPorAsignaciones } from 'src/catalogs/directiva-roles';
import { puedeGestionarAMiembro } from 'src/server/alcance-gestion-miembros';
import {
  nombreDeUsuario,
  marcarSolicitudesRecuperacionAtendidas,
} from 'src/server/notificaciones-recuperacion';
import {
  codigoVigente,
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
// codigo. Vence en un dia y muere al usarse.
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

    if (!cuenta) {
      return Response.json(
        { error: 'Ese miembro todavía no tiene cuenta de acceso.' },
        { status: 404 }
      );
    }

    // El permiso no basta: hay que mirar A QUIEN. Un codigo abre la cuenta del
    // otro con SUS permisos, asi que sin esta comprobacion cualquier Lider de
    // Grupo podia entrar en la cuenta de un cargo nacional.
    const { permitido, motivo } = await puedeGestionarAMiembro({
      solicitante,
      idMiembros: idMiembros ?? perfil?.data()?.idMiembros,
      uidObjetivo: cuenta.uid,
      resolverRoles: resolverRolesPorAsignaciones,
    });

    if (!permitido) {
      // El motivo se queda aqui: a quien lo intenta se le contesta siempre lo
      // mismo, que distinguir "no es de los tuyos" de "manda mas que tu" es
      // dibujarle el organigrama a quien esta tanteando.
      console.warn('[codigo-restablecimiento] intento fuera de alcance', {
        solicitante: solicitante.uid,
        motivo,
      });

      return Response.json(
        { error: 'Tu rol no puede restablecer la contraseña de ese miembro.' },
        { status: 403 }
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

    // En el perfil queda solo por donde encontrarlo; la huella del codigo va a
    // `secretos_acceso`, cerrada al cliente.
    await Promise.all([
      referencia.set(
        {
          uid: cuenta.uid,
          [CAMPO_BUSQUEDA_NUMERO]: numeroDeCodigoMiembro(codigoMiembro),
        },
        { merge: true }
      ),
      guardarSecretos(referencia.id, { codigoRestablecimiento: registro }),
    ]);

    // Quien pidio ayuda ya la tiene: se cierra la solicitud para el OTRO
    // coordinador, que si no la ve abierta genera un segundo codigo y tumba
    // este, muchas veces ya dictado por telefono.
    const nombreAtendio = await nombreDeUsuario(solicitante.uid);

    await marcarSolicitudesRecuperacionAtendidas({
      idMiembros,
      atendidaPor: solicitante.uid,
      nombreAtendio,
      motivo: 'codigo_generado',
    }).catch((error) => console.error('[codigo-restablecimiento] no se pudo cerrar la solicitud', error));

    return Response.json({ codigo, expiraEn, largo: LARGO_CODIGO_UN_USO, minutos: MINUTOS_CODIGO_UN_USO });
  } catch (error) {
    console.error('[codigo-restablecimiento] no se pudo generar', error);

    return Response.json({ error: 'No pudimos generar el código.' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------
// ¿Ya hay un codigo vivo para este miembro?
//
// La ficha lo pregunta antes de ofrecer el boton: si el otro coordinador acaba
// de generar uno, generar otro lo tumbaria —y puede que ya se lo hubiera
// dictado al miembro—.
// ----------------------------------------------------------------------

export async function PUT(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ vigente: false });

    const solicitante = await identificarSolicitante(req);

    if (!solicitante?.puedeGestionarOtros) return Response.json({ vigente: false });

    const { idMiembros, codigoMiembro, correo } = await req.json();
    const { perfil } = await buscarAccesoMiembro({ idMiembros, codigoMiembro, correo });
    const { codigoRestablecimiento: registro } = perfil
      ? await leerSecretos(perfil.id, perfil)
      : {};

    if (!codigoVigente(registro)) return Response.json({ vigente: false });

    return Response.json({
      vigente: true,
      creadoEn: registro.creadoEn ?? null,
      expiraEn: registro.expiraEn ?? null,
      generadoPorMi: String(registro.generadoPor || '') === String(solicitante.uid),
      generadoPorNombre: await nombreDeUsuario(registro.generadoPor),
    });
  } catch (error) {
    console.error('[codigo-restablecimiento] no se pudo consultar', error);

    return Response.json({ vigente: false });
  }
}
