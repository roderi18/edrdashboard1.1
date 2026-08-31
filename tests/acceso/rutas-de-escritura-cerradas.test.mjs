import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'clave-de-prueba';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'proyecto-de-prueba';

const { exigirPermisoDeCargoRest } = await import('../../src/server/sesion-rest.mjs');

// ----------------------------------------------------------------------
// Las rutas /api que ESCRIBEN en la organizacion.
//
// Crear y editar destacamentos, secciones, regiones, iglesias y miembros no
// comprobaba nada: ni sesion. Con la URL y un JSON, cualquiera —sin cuenta— daba
// de alta un destacamento o editaba la ficha de cualquier miembro.
//
// Estas pruebas cubren las dos mitades: que el guarda decida bien, y que no se
// quede ninguna ruta de escritura sin guarda.
// ----------------------------------------------------------------------

const peticion = (token) => ({
  headers: {
    get: (nombre) =>
      nombre.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null,
  },
});

const fetchFalso = ({ uid = 'uid-1', claims = {}, rol = null, permisos = null } = {}) =>
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
      if (!rol && !permisos) return { ok: false, json: async () => ({}) };

      return {
        ok: true,
        json: async () => ({
          fields: {
            ...(rol ? { rolId: { stringValue: rol } } : {}),
            ...(permisos
              ? { permisos: { arrayValue: { values: permisos.map((p) => ({ stringValue: p })) } } }
              : {}),
          },
        }),
      };
    }

    return { ok: false, json: async () => ({}) };
  };

test('sin token no se escribe', async () => {
  const r = await exigirPermisoDeCargoRest(peticion(''), ['miembros.editar'], fetchFalso());

  assert.equal(r.status, 401);
});

test('con sesión pero sin el permiso del cargo, 403', async () => {
  const r = await exigirPermisoDeCargoRest(
    peticion('token'),
    ['miembros.editar'],
    fetchFalso({ rol: 'usuario_comun', permisos: ['miembros.ver'] })
  );

  assert.equal(r.status, 403);
});

test('con el permiso en su documento de acceso, pasa', async () => {
  const r = await exigirPermisoDeCargoRest(
    peticion('token'),
    ['miembros.editar'],
    fetchFalso({ rol: 'lider_grupo', permisos: ['miembros.ver', 'miembros.editar'] })
  );

  assert.equal(r, null);
});

// Sus permisos no salen de un cargo, asi que su documento puede no traer lista.
test('el Administrador Global pasa aunque no tenga lista de permisos', async () => {
  const r = await exigirPermisoDeCargoRest(
    peticion('token'),
    ['miembros.crear'],
    fetchFalso({ rol: 'administrador_global' })
  );

  assert.equal(r, null);
});

test('sin documento de acceso no se escribe', async () => {
  const r = await exigirPermisoDeCargoRest(peticion('token'), ['miembros.crear'], fetchFalso());

  assert.equal(r.status, 403);
});

test('quien todavia debe crear su contraseña no escribe', async () => {
  const r = await exigirPermisoDeCargoRest(
    peticion('token'),
    ['miembros.editar'],
    fetchFalso({ claims: { debeCambiarClave: true }, rol: 'administrador_global' })
  );

  assert.equal(r.status, 403);
});

// ----------------------------------------------------------------------
// Y que no se cuele una ruta nueva sin guarda.
// ----------------------------------------------------------------------

const RUTAS_ORGANIZACION = [
  'notifications/birthdays', 'notifications/seed',
  'members', 'members/post', 'members/put',
  'dest', 'dest/post', 'dest/put',
  'sectional', 'sectional/post', 'sectional/put',
  'regional', 'regional/post', 'regional/put',
  'churches', 'churches/post', 'churches/put',
  'cargos', 'cargos-miembros',
];

const GUARDAS = [
  'exigirSesionRest',
  'exigirPermisoDeCargoRest',
  'exigirAdministradorGlobalRest',
  'requireRole',
  'exigirSesion(',
  'identificarSolicitante',
];

for (const ruta of RUTAS_ORGANIZACION) {
  const fichero = path.join(process.cwd(), 'src/app/api', ruta, 'route.js');

  if (!fs.existsSync(fichero)) continue;

  const codigo = fs.readFileSync(fichero, 'utf8');
  const escribe = /export async function (POST|PUT|DELETE|PATCH)/.test(codigo);

  if (!escribe) continue;

  test(`/api/${ruta} no escribe sin comprobar quien llama`, () => {
    assert.ok(
      GUARDAS.some((guarda) => codigo.includes(guarda)),
      `/api/${ruta} escribe y no llama a ningun guarda`
    );
  });
}
