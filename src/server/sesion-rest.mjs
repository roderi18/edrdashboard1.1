// Comprobar la sesion SIN el Admin SDK.
//
// POR QUE: en Netlify, toda ruta que importa `firebase-admin` devuelve 500 antes
// de ejecutar una linea del handler —el paquete no sobrevive al empaquetado de la
// funcion—. Da igual que el handler no llegue a usarlo: basta con importarlo.
//
// Para las rutas que solo necesitan saber "¿esta es una sesion valida?" no hace
// falta el Admin SDK: Firebase responde a eso por su API REST, con la misma clave
// publica que usa el navegador. Es lo que ya hacia el modulo de chat.
//
// Esto NO sustituye al Admin SDK donde de verdad hace falta —crear cuentas,
// poner claims, escribir en Firestore con privilegios—: esas rutas siguen
// necesitando que se arregle la carga de `firebase-admin`.

const BEARER = /^Bearer\s+(.+)$/i;

const leerToken = (req) => {
  const cabecera = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const coincidencia = cabecera.match(BEARER);

  return coincidencia ? coincidencia[1].trim() : '';
};

const claveApi = () =>
  String(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').trim();

/**
 * Quien llama, o null.
 *
 * `accounts:lookup` rechaza los tokens invalidos y los vencidos, asi que si
 * devuelve un usuario es que la sesion vale.
 */
export const identificarPorRest = async (req, fetchImpl = fetch) => {
  const token = leerToken(req);
  const clave = claveApi();

  if (!token || !clave) return null;

  const respuesta = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(clave)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    }
  ).catch(() => null);

  if (!respuesta?.ok) return null;

  const cuerpo = await respuesta.json().catch(() => null);
  const usuario = cuerpo?.users?.[0];

  if (!usuario?.localId) return null;

  let claims = {};

  try {
    claims = usuario.customAttributes ? JSON.parse(usuario.customAttributes) : {};
  } catch {
    claims = {};
  }

  return { uid: usuario.localId, correo: usuario.email ?? '', claims };
};

/**
 * Guardia de sesion. Devuelve null si puede pasar, o la Response del error.
 *
 * Misma respuesta que `exigirSesion` del Admin SDK, para que las rutas no noten
 * por cual de los dos caminos se les comprobo.
 */
/**
 * La sesion Y quien es, en una sola consulta.
 *
 * Identificar a alguien cuesta una llamada a Firebase. Las rutas que ademas
 * necesitan saber QUIEN es —para acotar lo que devuelven— la hacian dos veces:
 * una para el guarda y otra para los claims. En la ruta del padron, que es la
 * que espera el inicio de sesion, eso se nota.
 *
 * Devuelve `{ error }` con la Response si no puede pasar, o `{ quien }`.
 */
export const identificarConSesionRest = async (req, fetchImpl = fetch) => {
  if (!claveApi()) {
    return {
      error: Response.json(
        { error: 'El servidor no puede comprobar la sesión ahora mismo.' },
        { status: 503 }
      ),
    };
  }

  const quien = await identificarPorRest(req, fetchImpl);

  if (!quien) {
    return {
      error: Response.json(
        { error: 'Inicia sesión para consultar esta información.' },
        { status: 401 }
      ),
    };
  }

  // Quien todavia no ha elegido contraseña no pasa de "Crea tu contraseña".
  if (quien.claims?.debeCambiarClave === true) {
    return {
      error: Response.json({ error: 'Crea tu contraseña antes de continuar.' }, { status: 403 }),
    };
  }

  return { quien };
};

export const exigirSesionRest = async (req, fetchImpl = fetch) => {
  const { error } = await identificarConSesionRest(req, fetchImpl);

  return error ?? null;
};

// ----------------------------------------------------------------------
// ELIMINAR es cosa del Administrador Global, y lo dice el SERVIDOR.
//
// Borrar una region, una seccion, un destacamento o un miembro estaba abierto:
// las rutas ni miraban si habia sesion. Con la URL y un `id` cualquiera dejaba
// la organizacion sin una rama entera, y de ahi no se vuelve deshaciendo un
// cambio, se vuelve restaurando la base de datos.
//
// Se comprueba por REST y no con el Admin SDK a proposito: estas rutas sirven
// tambien los GET de las listas, y en Netlify basta con IMPORTAR `firebase-admin`
// para que la ruta entera devuelva 500 (ver la cabecera de este fichero). El
// candado no puede tumbar la pantalla que protege.
// ----------------------------------------------------------------------

const ADMINISTRADOR_GLOBAL = 'administrador_global';

const normalizarRol = (valor) => String(valor ?? '').trim().toLowerCase();

/**
 * Su rol segun el DOCUMENTO de acceso, leido por la API REST de Firestore con
 * su propio token.
 *
 * El documento manda sobre el claim y no al reves —es el mismo orden que usa
 * `require-role`—: los claims se ponen a mano y se quedan viejos, y a un
 * Administrador Global le puede figurar en el token un rol de hace meses.
 * `usuarios_roles` es de solo lectura para el cliente (`allow write: if false`),
 * asi que fiarse de el es fiarse del Admin SDK, que es quien lo escribe.
 */
const rolDelDocumento = async (uid, token, fetchImpl = fetch) => {
  const proyecto = String(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
  ).trim();

  if (!proyecto || !uid || !token) return '';

  const leer = async (coleccion) => {
    const respuesta = await fetchImpl(
      `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/${coleccion}/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    ).catch(() => null);

    if (!respuesta?.ok) return '';

    const cuerpo = await respuesta.json().catch(() => null);
    const campos = cuerpo?.fields ?? {};

    return normalizarRol(
      campos.rolId?.stringValue ?? campos.roleId?.stringValue ?? campos.rol?.stringValue
    );
  };

  // Su documento de acceso y, si ahi no hay nada, el de administradores: un
  // administrador nombrado a mano puede vivir solo en `admins`.
  return (await leer('usuarios_roles')) || (await leer('admins'));
};

/**
 * Su documento de acceso completo: el rol y la lista de permisos de TODOS sus
 * cargos, que escribe el Admin SDK al sincronizar. Se lee por REST con su propio
 * token, por lo mismo que arriba: importar `firebase-admin` aqui tumbaria estas
 * rutas enteras en Netlify, y son las que sirven las listas.
 */
const accesoDelSolicitante = async (uid, token, fetchImpl = fetch) => {
  const proyecto = String(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
  ).trim();

  if (!proyecto || !uid || !token) return { rol: '', permisos: [] };

  const leer = async (coleccion) => {
    const respuesta = await fetchImpl(
      `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/${coleccion}/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    ).catch(() => null);

    if (!respuesta?.ok) return null;

    const cuerpo = await respuesta.json().catch(() => null);
    const campos = cuerpo?.fields ?? {};

    return {
      rol: normalizarRol(
        campos.rolId?.stringValue ?? campos.roleId?.stringValue ?? campos.rol?.stringValue
      ),
      permisos: (campos.permisos?.arrayValue?.values ?? [])
        .map((valor) => String(valor?.stringValue ?? '').trim())
        .filter(Boolean),
    };
  };

  const propio = await leer('usuarios_roles');

  if (propio?.rol || propio?.permisos?.length) return propio;

  return (await leer('admins')) ?? { rol: '', permisos: [] };
};

/**
 * Guarda por PERMISO de cargo. Devuelve null si puede pasar, o la Response del
 * error.
 *
 * Es la misma pregunta que hacen las reglas de Firestore —`tienePermisoDeCargo`—
 * llevada a las rutas que escriben en la API .NET, donde no hay reglas que
 * valgan: hasta ahora no comprobaban ni que hubiera sesion.
 *
 * El Administrador Global pasa siempre: sus permisos no salen de un cargo.
 */
export const exigirPermisoDeCargoRest = async (req, permisos = [], fetchImpl = fetch) => {
  const sinSesion = await exigirSesionRest(req, fetchImpl);

  if (sinSesion) return sinSesion;

  const quien = await identificarPorRest(req, fetchImpl);
  const token = leerToken(req);
  const acceso = await accesoDelSolicitante(quien?.uid, token, fetchImpl);
  const rol = acceso.rol || normalizarRol(quien?.claims?.rol);

  if (rol === ADMINISTRADOR_GLOBAL) return null;

  const requeridos = Array.isArray(permisos) ? permisos : [permisos];

  if (requeridos.some((permiso) => acceso.permisos.includes(permiso))) return null;

  return Response.json({ error: 'Tu cargo no puede realizar esta acción.' }, { status: 403 });
};

// Coordinador de Destacamento y su Asistente. Se nombran los dos codigos aunque
// el asistente se normalice al titular: quien lea esto tiene que ver A QUIEN se
// le esta dando el permiso, sin ir a buscar la normalizacion a otro fichero.
const COORDINACION_DE_DESTACAMENTO = ['usuario_destacamento', 'usuario_destacamento_asistente'];

/**
 * Guarda para lo que solo pueden hacer el Coordinador de Destacamento y su
 * Asistente. Devuelve null si puede pasar, o la Response del error.
 *
 * Se comprueba en el SERVIDOR y no solo en la pantalla: esconder un boton evita
 * el error de quien no queria hacerlo, no el intento de quien si.
 */
export const exigirCoordinadorDeDestacamentoRest = async (req, fetchImpl = fetch) => {
  const sinSesion = await exigirSesionRest(req, fetchImpl);

  if (sinSesion) return sinSesion;

  const quien = await identificarPorRest(req, fetchImpl);
  const token = leerToken(req);
  const acceso = await accesoDelSolicitante(quien?.uid, token, fetchImpl);
  const rol = acceso.rol || normalizarRol(quien?.claims?.rol);

  if (rol === ADMINISTRADOR_GLOBAL) return null;
  if (COORDINACION_DE_DESTACAMENTO.includes(rol)) return null;

  return Response.json(
    { error: 'Solo el Coordinador de Destacamento y su Asistente pueden hacer esto.' },
    { status: 403 }
  );
};

/**
 * Guarda de borrado. Devuelve null si puede pasar, o la Response del error.
 *
 * Es la misma regla que aplica la pantalla —`isAdminGlobal`, y nadie mas borra
 * niveles ni miembros—, pero dicha donde no se puede rodear con la consola
 * abierta.
 */
export const exigirAdministradorGlobalRest = async (req, fetchImpl = fetch) => {
  if (!claveApi()) {
    return Response.json(
      { error: 'El servidor no puede comprobar la sesión ahora mismo.' },
      { status: 503 }
    );
  }

  const quien = await identificarPorRest(req, fetchImpl);

  if (!quien) {
    return Response.json({ error: 'Inicia sesión para realizar esta acción.' }, { status: 401 });
  }

  if (quien.claims?.debeCambiarClave === true) {
    return Response.json({ error: 'Crea tu contraseña antes de continuar.' }, { status: 403 });
  }

  const token = leerToken(req);
  const rol = (await rolDelDocumento(quien.uid, token, fetchImpl)) || normalizarRol(quien.claims?.rol);

  if (rol !== ADMINISTRADOR_GLOBAL) {
    return Response.json(
      { error: 'Solo el Administrador Global puede eliminar.' },
      { status: 403 }
    );
  }

  return null;
};
