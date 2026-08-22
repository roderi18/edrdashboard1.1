import 'server-only';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  esCorreoInterno,
  correoInternoDe,
  buscarCuentaMiembro,
  buscarPerfilMiembro,
  identificarSolicitante,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// El correo de la ficha pasa a ser el de la cuenta.
//
// La cuenta de un miembro nace con un correo interno
// (`edr-10002@exploradores.app`) que no existe como buzon: mientras lo tenga, no
// se le puede enviar el enlace de recuperacion. En cuanto se le guarda un correo
// de verdad, la cuenta pasa a usarlo, y desde ese momento puede entrar y
// recuperar la clave con el. El acceso por numero sigue funcionando: la pantalla
// prueba los dos correos.
// ----------------------------------------------------------------------

const normalizarCorreo = (correo) =>
  String(correo ?? '')
    .trim()
    .toLowerCase();

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede actualizar cuentas ahora mismo.' },
        { status: 503 }
      );
    }

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    const { idMiembros, codigoMiembro, correo } = await req.json();
    const correoNuevo = normalizarCorreo(correo);

    if (!idMiembros && !codigoMiembro) {
      return Response.json({ error: 'Falta identificar al miembro.' }, { status: 400 });
    }

    if (!correoNuevo || esCorreoInterno(correoNuevo)) {
      return Response.json({ error: 'Ese correo no sirve para iniciar sesión.' }, { status: 400 });
    }

    const cuenta = await buscarCuentaMiembro({ idMiembros, codigoMiembro });

    if (!cuenta) {
      return Response.json(
        { error: 'Ese miembro todavía no tiene cuenta de acceso.' },
        { status: 404 }
      );
    }

    // Cada quien puede cambiar el suyo; para el de otro hace falta el permiso de
    // editar miembros.
    if (cuenta.uid !== solicitante.uid && !solicitante.puedeGestionarOtros) {
      return Response.json(
        { error: 'Tu rol no puede cambiar el correo de acceso de otros miembros.' },
        { status: 403 }
      );
    }

    if (normalizarCorreo(cuenta.email) === correoNuevo) {
      return Response.json({ ok: true, sinCambios: true });
    }

    try {
      await getAdminAuth().updateUser(cuenta.uid, { email: correoNuevo, emailVerified: false });
    } catch (error) {
      if (error?.code === 'auth/email-already-exists') {
        return Response.json(
          { error: 'Ese correo ya lo usa otra cuenta de la aplicación.' },
          { status: 409 }
        );
      }

      throw error;
    }

    const db = getAdminDb();
    const perfil = await buscarPerfilMiembro({ idMiembros, uid: cuenta.uid });
    const referencia =
      perfil?.ref ?? db.collection('usuarios_roles').doc(String(idMiembros || cuenta.uid));

    const datosPerfil = perfil?.data() ?? {};

    await Promise.all([
      referencia.set({ correo: correoNuevo, correoPersonal: correoNuevo }, { merge: true }),
      db.collection('users').doc(cuenta.uid).set({ email: correoNuevo }, { merge: true }),
      // Tambien bajo el uid: al dejar de ser un correo `@exploradores.app`, la
      // sesion ya no puede reconocerlo como miembro por el correo y lo busca por
      // el uid. Sin este documento entraria sin su perfil.
      db
        .collection('usuarios_roles')
        .doc(cuenta.uid)
        .set(
          {
            ...datosPerfil,
            uid: cuenta.uid,
            idMiembros: Number(idMiembros ?? datosPerfil.idMiembros) || datosPerfil.idMiembros || null,
            codigoMiembro: codigoMiembro || datosPerfil.codigoMiembro || '',
            correo: correoNuevo,
            correoPersonal: correoNuevo,
          },
          { merge: true }
        ),
    ]);

    return Response.json({
      ok: true,
      // Con que correo entraba antes, para poder decirselo a quien lo cambio.
      correoAnterior: esCorreoInterno(cuenta.email)
        ? correoInternoDe(codigoMiembro || '')
        : normalizarCorreo(cuenta.email),
    });
  } catch (error) {
    console.error('[correo-cuenta-miembro] no se pudo actualizar', error);

    return Response.json({ error: 'No pudimos actualizar el correo de acceso.' }, { status: 500 });
  }
}
