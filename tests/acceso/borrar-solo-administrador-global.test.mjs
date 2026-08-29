import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'clave-de-prueba';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'proyecto-de-prueba';

const { exigirAdministradorGlobalRest } = await import('../../src/server/sesion-rest.mjs');

// ----------------------------------------------------------------------
// Eliminar una region, una seccion, un destacamento o un miembro.
//
// Estas rutas no comprobaban NADA: con la URL y un `id`, cualquiera —sin cuenta
// siquiera— dejaba la organizacion sin una rama entera. Ahora el servidor exige
// Administrador Global, que es la misma regla que la pantalla lleva diciendo
// desde siempre.
//
// Se prueba el codigo real inyectandole el `fetch`: asi se ve lo que responde a
// cada caso sin hablar con Firebase.
// ----------------------------------------------------------------------

const peticion = (token) => ({
  headers: {
    get: (nombre) =>
      nombre.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null,
  },
});

// Un Firebase de mentira: quien es el token, y que dice su documento de acceso.
const fetchFalso = ({ uid = 'uid-1', claims = {}, rolDelDocumento = null } = {}) =>
  async (url) => {
    if (String(url).includes('identitytoolkit')) {
      return {
        ok: true,
        json: async () => ({
          users: [{ localId: uid, email: 'quien@ejemplo.com', customAttributes: JSON.stringify(claims) }],
        }),
      };
    }

    if (String(url).includes('firestore.googleapis.com')) {
      if (!rolDelDocumento) return { ok: false, json: async () => ({}) };

      return { ok: true, json: async () => ({ fields: { rolId: { stringValue: rolDelDocumento } } }) };
    }

    return { ok: false, json: async () => ({}) };
  };

test('sin token no se borra nada', async () => {
  const respuesta = await exigirAdministradorGlobalRest(peticion(''), fetchFalso());

  assert.equal(respuesta.status, 401);
});

test('con sesión válida pero otro rol, tampoco', async () => {
  const respuesta = await exigirAdministradorGlobalRest(
    peticion('token'),
    fetchFalso({ rolDelDocumento: 'usuario_seccion' })
  );

  assert.equal(respuesta.status, 403);
});

test('el Coordinador de Destacamento tampoco, aunque su token sea bueno', async () => {
  const respuesta = await exigirAdministradorGlobalRest(
    peticion('token'),
    fetchFalso({ rolDelDocumento: 'usuario_destacamento' })
  );

  assert.equal(respuesta.status, 403);
});

test('el Administrador Global pasa', async () => {
  const respuesta = await exigirAdministradorGlobalRest(
    peticion('token'),
    fetchFalso({ rolDelDocumento: 'administrador_global' })
  );

  assert.equal(respuesta, null);
});

// El claim se pone a mano y se queda viejo; el documento lo escribe el servidor.
// Por eso manda el documento, y el claim solo entra cuando no hay documento.
test('sin documento vale el claim del token', async () => {
  const respuesta = await exigirAdministradorGlobalRest(
    peticion('token'),
    fetchFalso({ claims: { rol: 'administrador_global' } })
  );

  assert.equal(respuesta, null);
});

test('el documento manda sobre un claim viejo', async () => {
  const respuesta = await exigirAdministradorGlobalRest(
    peticion('token'),
    fetchFalso({ claims: { rol: 'administrador_global' }, rolDelDocumento: 'oficina_nacional' })
  );

  assert.equal(respuesta.status, 403);
});

// Quien entro con la clave inicial no ha elegido contraseña todavia: su token
// vale, pero no pasa de esa pantalla.
test('quien debe cambiar su clave no borra', async () => {
  const respuesta = await exigirAdministradorGlobalRest(
    peticion('token'),
    fetchFalso({ claims: { rol: 'administrador_global', debeCambiarClave: true } })
  );

  assert.equal(respuesta.status, 403);
});
