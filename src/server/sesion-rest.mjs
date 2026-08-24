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
export const exigirSesionRest = async (req) => {
  if (!claveApi()) {
    return Response.json(
      { error: 'El servidor no puede comprobar la sesión ahora mismo.' },
      { status: 503 }
    );
  }

  const quien = await identificarPorRest(req);

  if (!quien) {
    return Response.json(
      { error: 'Inicia sesión para consultar esta información.' },
      { status: 401 }
    );
  }

  // Quien todavia no ha elegido contraseña no pasa de "Crea tu contraseña".
  if (quien.claims?.debeCambiarClave === true) {
    return Response.json({ error: 'Crea tu contraseña antes de continuar.' }, { status: 403 });
  }

  return null;
};
