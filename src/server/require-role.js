import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { verificarTokenDeSesion } from 'src/server/verificar-token';
import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';
import { ACCIONES_DE_SEGURIDAD, registrarEventoDeSeguridad } from 'src/server/auditoria-seguridad';

// ----------------------------------------------------------------------
// Guardia de rol para las rutas /api que escriben en el backend .NET.
//
// Estos proxys reenviaban POST y DELETE sin comprobar nada: cualquiera que
// conociera la URL podia asignar o retirar cargos SIN tener cuenta.
//
// El rol sale de los custom claims del ID token, que solo emite el Admin SDK, Y
// SI NO, del perfil en Firestore. Los claims se ponen a mano —cuando alguien
// llama a `/api/admin/set-user-claims`— asi que se quedan viejos con facilidad:
// al Administrador Global le figuraban los de "oficina nacional, solo lectura" y
// estas rutas le contestaban 403 mientras el resto de la aplicacion le trataba
// como administrador. Dos caminos para la misma pregunta y respuestas distintas.
//
// `usuarios_roles` solo lo escribe el servidor (`allow write: if false` en las
// reglas), asi que como segunda fuente es tan de fiar como el claim.
// ----------------------------------------------------------------------

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const normalizarRol = (valor) => String(valor ?? '').trim().toLowerCase();

/**
 * Su rol: el de su perfil, y si no tiene, el del token.
 *
 * En ese orden y no al reves, que es la parte que importa: el claim viejo NO
 * puede ganarle al perfil. Al Administrador Global le figuraba un claim de
 * "oficina nacional, solo lectura" de vaya usted a saber cuando, y mientras ese
 * claim mandara, aqui seguia siendo oficina nacional por mucho que su perfil
 * dijera otra cosa.
 *
 * Es el mismo orden que usa `identificarSolicitante`, que es de lo que se
 * trata: una sola respuesta a "¿quien es este?".
 */
const rolDelUsuario = async (decodificado) => {
  const documento = await getAdminDb()
    .collection(COLECCIONES.usuariosRoles)
    .doc(String(decodificado.uid))
    .get()
    .catch(() => null);
  const datos = documento?.exists ? documento.data() : null;

  return (
    normalizarRol(datos?.rolId ?? datos?.roleId ?? datos?.rol ?? datos?.role) ||
    normalizarRol(decodificado?.rol)
  );
};

// QUE QUEDE CONSTANCIA DE LO QUE SE NIEGA. Antes un 403 o una sesion revocada
// devolvian su respuesta y nada mas: no habia forma de saber que alguien probaba
// rutas que su cargo no abre. Una vez cada diez minutos por persona y ruta, para
// que una pantalla que reintenta no llene el registro.
const DIEZ_MINUTOS = 10 * 60 * 1000;

const rutaDe = (req) => {
  try {
    return new URL(req.url).pathname;
  } catch {
    return '';
  }
};

const registrarDenegado = (req, uid, detalle) =>
  registrarEventoDeSeguridad(
    req,
    {
      accion: ACCIONES_DE_SEGURIDAD.accesoDenegado,
      resultado: 'denegado',
      actor: { uid },
      detalle,
    },
    { unaVezCada: { clave: `denegado:${uid}:${rutaDe(req)}:${detalle?.motivo}`, ms: DIEZ_MINUTOS } }
  );

/** Si el token se rechazo por estar revocado, lo registra (a quien era). */
export const registrarSiRevocado = (req, error) => {
  if (error?.code !== 'auth/id-token-revoked') return null;

  return registrarEventoDeSeguridad(
    req,
    {
      accion: ACCIONES_DE_SEGURIDAD.sesionRevocadaUsada,
      resultado: 'denegado',
      actor: { uid: error.uid },
    },
    { unaVezCada: { clave: `revocada:${error.uid}:${rutaDe(req)}`, ms: DIEZ_MINUTOS } }
  );
};

// Devuelve null si la peticion esta autorizada, o una Response con el error.
export async function requireRole(req, rolesPermitidos = []) {
  if (!isAdminConfigured()) {
    return Response.json(
      { Success: false, Message: 'El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.' },
      { status: 503 }
    );
  }

  const token = getBearerToken(req);

  if (!token) {
    return Response.json(
      { Success: false, Message: 'Inicia sesión para realizar esta acción.' },
      { status: 401 }
    );
  }

  try {
    const decoded = await verificarTokenDeSesion(token);

    // Mismo encierro que `exigirSesion`: quien entró con un código del
    // Coordinador o la clave inicial solo puede elegir su contraseña. Aquí no se
    // miraba, así que ese token llegaba a las rutas de escritura de su cargo.
    if (decoded?.debeCambiarClave === true) {
      await registrarDenegado(req, decoded.uid, { motivo: 'debe_cambiar_clave' });

      return Response.json(
        { Success: false, Message: 'Crea tu contraseña antes de continuar.' },
        { status: 403 }
      );
    }

    const rol = await rolDelUsuario(decoded);

    if (rolesPermitidos.length && !rolesPermitidos.includes(rol)) {
      await registrarDenegado(req, decoded.uid, {
        motivo: 'rol_no_permitido',
        rol,
        rolesPermitidos,
      });

      return Response.json(
        { Success: false, Message: 'Tu rol no puede realizar esta acción.' },
        { status: 403 }
      );
    }

    return null;
  } catch (error) {
    await registrarSiRevocado(req, error);

    return Response.json(
      { Success: false, Message: 'La sesión no es válida o expiró.' },
      { status: 401 }
    );
  }
}

/**
 * Solo hace falta tener sesion, sea del rol que sea.
 *
 * Para las rutas que devuelven datos de la organizacion: no deciden nada, pero
 * tampoco son publicas. Devuelve null si puede pasar, o la Response del error.
 */
export async function exigirSesion(req) {
  if (!isAdminConfigured()) {
    return Response.json(
      { error: 'El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.' },
      { status: 503 }
    );
  }

  const token = getBearerToken(req);

  if (!token) {
    return Response.json({ error: 'Inicia sesión para consultar esta información.' }, { status: 401 });
  }

  try {
    const decodificado = await verificarTokenDeSesion(token);

    // Quien entro con la clave inicial o con un codigo del Coordinador tiene un
    // token valido pero todavia no ha elegido contraseña. La pantalla ya le
    // encierra en "Crea tu contraseña"; esto lo hace de verdad, porque ese
    // guarda es de navegador y con el token se llegaba a cualquier ruta.
    if (decodificado?.debeCambiarClave === true) {
      await registrarDenegado(req, decodificado.uid, { motivo: 'debe_cambiar_clave' });

      return Response.json(
        { error: 'Crea tu contraseña antes de continuar.' },
        { status: 403 }
      );
    }

    return null;
  } catch (error) {
    await registrarSiRevocado(req, error);

    return Response.json({ error: 'La sesión no es válida o expiró.' }, { status: 401 });
  }
}

export const ROLES_ADMINISTRACION_CARGOS = ['administrador_global'];
