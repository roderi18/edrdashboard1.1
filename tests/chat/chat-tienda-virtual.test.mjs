import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// TIENDA VIRTUAL: EL BUZON COMPARTIDO DE LA TIENDA EN EL CHAT.
//
// Cualquier miembro puede escribirle a la Tienda. Quien ejerce el cargo de
// Administrador de Gestion de Tienda o de Administrador Global ve esas
// conversaciones y contesta EN NOMBRE de la Tienda; el miembro solo ve "Tienda
// Virtual".
//
// Lo que se rompia antes: la Tienda participaba con `idMiembros` -900001 y los
// normalizadores del chat solo aceptan positivos, asi que se caia de sus propias
// conversaciones. Nadie podia abrirlas ni contestarle, y el aviso de "pedido
// aprobado" se escribia desde el navegador de quien evaluaba, que no es
// participante, y las reglas lo rechazaban.
//
// Lo que vigila esta suite: quien PUEDE atender el buzon, que una persona nunca
// pueda ser la Tienda, que el servidor emita la identidad de la Tienda solo tras
// comprobar el cargo, y que el nombre de quien contesto no le llegue al miembro.
// ----------------------------------------------------------------------

const {
  ID_TIENDA_VIRTUAL,
  UID_TIENDA_VIRTUAL,
  CODIGO_TIENDA_VIRTUAL,
  esTiendaVirtual,
  idConversacionConTienda,
  puedeAtenderBuzonDeTienda,
} = await import('src/utils/chat-tienda-virtual.mjs');
const { resolveAuthenticatedMember, CHAT_AUTH_CODES } =
  await import('src/server/chat-auth-core.mjs');
const { assertConversationParticipant } = await import('src/server/chat-authorization-core.mjs');
const { createChatMessageDocument } = await import('src/server/chat-message-model.mjs');
const { toPublicChatContact } = await import('src/server/chat-contact-core.mjs');
const {
  crearEmisorDeTokenDeTienda,
  crearProveedorDeTokenDeTienda,
  crearAutenticadorDeBuzonDeTienda,
} = await import('src/server/chat-tienda-core.mjs');
const { sesionPuedeAtenderBuzonDeTienda, identidadEnElChat } =
  await import('src/sections/chat/utils/buzon-de-tienda.js');
const { rutaDelChat } = await import('src/sections/chat/utils/ruta-del-chat.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const peticionCon = (token) => ({
  headers: { get: (nombre) => (nombre.toLowerCase() === 'authorization' ? `Bearer ${token}` : '') },
});

// ----------------------------------------------------------------------
// LA IDENTIDAD
// ----------------------------------------------------------------------

test('la Tienda Virtual es el 20001, con el codigo EDR-20001', () => {
  assert.equal(ID_TIENDA_VIRTUAL, 20001);
  assert.equal(CODIGO_TIENDA_VIRTUAL, 'EDR-20001');
  assert.equal(esTiendaVirtual(20001), true);
  assert.equal(esTiendaVirtual('20001'), true);
  assert.equal(esTiendaVirtual(-900001), false);
  assert.equal(esTiendaVirtual(null), false);
  assert.equal(esTiendaVirtual(''), false);
});

test('la conversacion de un miembro con la Tienda es la individual de siempre', () => {
  assert.equal(idConversacionConTienda(147), 'individual_147_20001');
});

test('la Tienda no se cae de sus conversaciones: es un participante valido', () => {
  const conversacion = { participantesIds: [147, ID_TIENDA_VIRTUAL] };

  assert.equal(
    assertConversationParticipant(conversacion, { idMiembros: ID_TIENDA_VIRTUAL }),
    ID_TIENDA_VIRTUAL
  );
  assert.equal(toPublicChatContact({ idMiembros: ID_TIENDA_VIRTUAL }).id, '20001');

  const mensaje = createChatMessageDocument({
    message: { body: 'Tu pedido fue aprobado.', senderId: ID_TIENDA_VIRTUAL },
    conversationId: 'individual_147_20001',
    randomUUID: () => 'pedido_1',
  });

  assert.equal(mensaje.remitenteIdMiembros, ID_TIENDA_VIRTUAL);
});

test('una PERSONA nunca inicia sesion como la Tienda, aunque el padron le de su numero', () => {
  const esperaConflicto = (entrada) =>
    assert.throws(
      () => resolveAuthenticatedMember(entrada),
      (error) => error.status === 403 && error.code === CHAT_AUTH_CODES.MEMBER_ID_CONFLICT
    );

  esperaConflicto({ decodedToken: { idMiembros: ID_TIENDA_VIRTUAL } });
  esperaConflicto({ decodedToken: {}, profiles: [{ idMiembros: ID_TIENDA_VIRTUAL }] });
  // Un miembro normal sigue entrando.
  assert.equal(resolveAuthenticatedMember({ decodedToken: { idMiembros: 147 } }).idMiembros, 147);
});

// ----------------------------------------------------------------------
// QUIEN ATIENDE EL BUZON
// ----------------------------------------------------------------------

const perfil = (collection, datos) => ({ collection, ...datos });

test('atienden el buzon el Administrador de Tienda y el Administrador Global', () => {
  assert.equal(
    puedeAtenderBuzonDeTienda({
      perfiles: [perfil('usuarios_roles', { rolId: 'administrador_tienda', rol: 'miembro' })],
    }),
    true
  );
  assert.equal(
    puedeAtenderBuzonDeTienda({
      perfiles: [perfil('usuarios_roles', { rolId: 'administrador_global' })],
    }),
    true
  );
  assert.equal(puedeAtenderBuzonDeTienda({ claims: { rol: 'administrador_tienda' } }), true);
});

test('cuentan las cuentas de antes del catalogo y las de la coleccion admins', () => {
  assert.equal(
    puedeAtenderBuzonDeTienda({ perfiles: [perfil('usuarios_roles', { rol: 'administrador' })] }),
    true
  );
  assert.equal(puedeAtenderBuzonDeTienda({ perfiles: [perfil('admins', { rol: 'admin' })] }), true);
});

test('se pregunta por TODOS los cargos, no solo por el principal', () => {
  assert.equal(
    puedeAtenderBuzonDeTienda({
      perfiles: [
        perfil('usuarios_roles', {
          rolId: 'usuario_seccion',
          cargos: [{ rol: 'usuario_seccion' }, { rol: 'administrador_tienda' }],
        }),
      ],
    }),
    true
  );
});

test('no atienden el buzon los demas cargos ni un miembro sin cargo', () => {
  assert.equal(
    puedeAtenderBuzonDeTienda({
      perfiles: [perfil('usuarios_roles', { rolId: 'usuario_destacamento' })],
    }),
    false
  );
  assert.equal(
    puedeAtenderBuzonDeTienda({
      perfiles: [perfil('usuarios_roles', { rolId: 'oficina_nacional' })],
    }),
    false
  );
  assert.equal(puedeAtenderBuzonDeTienda({}), false);
});

test('no se fia de users/<uid>: ese documento lo escribe el propio navegador', () => {
  assert.equal(
    puedeAtenderBuzonDeTienda({
      perfiles: [perfil('users', { rol: 'administrador', rolId: 'administrador_global' })],
    }),
    false
  );
});

test('en el navegador, el selector solo se enseña a quien atiende el buzon', () => {
  assert.equal(sesionPuedeAtenderBuzonDeTienda({ rolId: 'administrador_tienda' }), true);
  assert.equal(sesionPuedeAtenderBuzonDeTienda({ rolId: 'administrador_global' }), true);
  assert.equal(
    sesionPuedeAtenderBuzonDeTienda({
      rolId: 'usuario_seccion',
      cargos: [{ rol: 'administrador_tienda' }],
    }),
    true
  );
  assert.equal(sesionPuedeAtenderBuzonDeTienda({ rolId: 'usuario_destacamento' }), false);
  assert.equal(sesionPuedeAtenderBuzonDeTienda(null), false);
});

test('en el buzon se escribe como la Tienda; fuera, como uno mismo', () => {
  const yo = { id: '134', idMiembros: 134, name: 'Roderi Pena' };

  assert.equal(identidadEnElChat(yo, false), yo);
  assert.equal(identidadEnElChat(yo, true).idMiembros, ID_TIENDA_VIRTUAL);
  assert.equal(identidadEnElChat(yo, true).name, 'Tienda Virtual');
});

test('navegar dentro del buzon no lo abandona', () => {
  assert.equal(
    rutaDelChat({ id: 'individual_147_20001', enBuzon: true }),
    '/dashboard/chat?id=individual_147_20001&bandeja=tienda'
  );
  assert.equal(rutaDelChat({ id: 'individual_1_2' }), '/dashboard/chat?id=individual_1_2');
  assert.equal(rutaDelChat({ enBuzon: true }), '/dashboard/chat?bandeja=tienda');
});

// ----------------------------------------------------------------------
// EL SERVIDOR ACTUA COMO LA TIENDA SOLO TRAS COMPROBAR EL CARGO
// ----------------------------------------------------------------------

const autenticador = ({ perfiles = [], claims = {} } = {}) =>
  crearAutenticadorDeBuzonDeTienda({
    verifyIdToken: async (token) => ({ uid: token, ...claims }),
    cargarPerfiles: async () => perfiles,
    obtenerTokenDeTienda: async () => 'token-de-la-tienda',
  });

test('con el cargo, la peticion actua como la Tienda y guarda quien contesto', async () => {
  const actor = await autenticador({
    perfiles: [
      perfil('usuarios_roles', {
        rolId: 'administrador_tienda',
        nombre: 'Encargada de Tienda',
        idMiembros: 134,
      }),
    ],
  })(peticionCon('uid-encargada'));

  assert.equal(actor.uid, UID_TIENDA_VIRTUAL);
  assert.equal(actor.idMiembros, ID_TIENDA_VIRTUAL);
  assert.equal(actor.token, 'token-de-la-tienda');
  assert.equal(actor.esTiendaVirtual, true);
  assert.deepEqual(actor.responsable, {
    uid: 'uid-encargada',
    nombre: 'Encargada de Tienda',
    idMiembros: 134,
  });
});

test('sin el cargo, pedir el buzon de la Tienda se rechaza con 403', async () => {
  await assert.rejects(
    autenticador({ perfiles: [perfil('usuarios_roles', { rolId: 'usuario_destacamento' })] })(
      peticionCon('uid-coordinador')
    ),
    (error) => error.status === 403
  );
});

test('sin token, o con el token de la propia Tienda, no se entra', async () => {
  await assert.rejects(
    autenticador({ perfiles: [perfil('usuarios_roles', { rolId: 'administrador_global' })] })({
      headers: { get: () => '' },
    }),
    (error) => error.status === 401
  );
  await assert.rejects(
    autenticador({ perfiles: [perfil('usuarios_roles', { rolId: 'administrador_global' })] })(
      peticionCon(UID_TIENDA_VIRTUAL)
    ),
    (error) => error.status === 401
  );
});

test('el token de la Tienda lleva su idMiembros y se canjea en Firebase Auth', async () => {
  let firmado = null;
  let pedido = null;
  const emitir = crearEmisorDeTokenDeTienda({
    apiKey: 'clave',
    crearTokenPropio: async (uid, claims) => {
      firmado = { uid, claims };
      return 'token-propio';
    },
    fetchImpl: async (url, init) => {
      pedido = { url, body: JSON.parse(init.body) };
      return { ok: true, json: async () => ({ idToken: 'id-token', expiresIn: '3600' }) };
    },
  });

  assert.deepEqual(await emitir(), { token: 'id-token', expiraEnSegundos: 3600 });
  assert.deepEqual(firmado, { uid: UID_TIENDA_VIRTUAL, claims: { idMiembros: ID_TIENDA_VIRTUAL } });
  assert.match(pedido.url, /accounts:signInWithCustomToken\?key=clave/);
  assert.equal(pedido.body.token, 'token-propio');
});

test('el token de la Tienda se reutiliza mientras dura y se renueva antes de caducar', async () => {
  let ahora = 0;
  let emitidos = 0;
  const obtener = crearProveedorDeTokenDeTienda({
    now: () => ahora,
    emitirToken: async () => {
      emitidos += 1;
      return { token: `t${emitidos}`, expiraEnSegundos: 3600 };
    },
  });

  const [a, b] = await Promise.all([obtener(), obtener()]);
  assert.equal(a, 't1');
  assert.equal(b, 't1');
  assert.equal(emitidos, 1);

  ahora = 50 * 60_000;
  assert.equal(await obtener(), 't1');

  ahora = 56 * 60_000;
  assert.equal(await obtener(), 't2');
});

// ----------------------------------------------------------------------
// LO QUE VE CADA QUIEN, Y LAS REGLAS
// ----------------------------------------------------------------------

test('quien contesto como la Tienda solo se añade al mirar el propio buzon', () => {
  const ruta = leer('src/app/api/chat/route.js');

  assert.match(ruta, /!chatActor\?\.esTiendaVirtual \|\|/);
  // Se guarda aparte del mensaje, que el miembro puede leer entero.
  assert.match(leer('src/server/chat-tienda.js'), /collection\(COLECCION_RESPUESTAS\)/);
});

test('las reglas: nadie usurpa el 20001, el buzon solo lee, y respuestas_tienda es del servidor', () => {
  const reglas = leer('firestore.rules');

  assert.match(
    reglas,
    /request\.auth\.token\.idMiembros != 20001\s*\|\| request\.auth\.uid == 'tienda-virtual'/
  );
  assert.match(reglas, /function atiendeBuzonDeTienda\(datosConversacion\)/);
  assert.match(reglas, /\|\| atiendeBuzonDeTienda\(resource\.data\);/);
  assert.match(
    reglas,
    /match \/respuestas_tienda\/\{idMensaje\} \{\s*allow read, write: if false;/
  );
  // El buzon no gana escritura: create y update siguen como estaban.
  assert.doesNotMatch(reglas, /allow (create|update)[^;]*atiendeBuzonDeTienda/);

  const almacen = leer('storage.rules');
  assert.match(almacen, /idMiembroChat\(\) != 20001 \|\| request\.auth\.uid == 'tienda-virtual'/);
});

test('el aviso del pedido va por el servidor como la Tienda, no directo a Firestore', () => {
  const ordenes = leer('src/services/order-service.js');

  assert.doesNotMatch(ordenes, /-900001/);
  assert.doesNotMatch(ordenes, /COLECCION_CONVERSACIONES_CHAT/);
  assert.match(ordenes, /createConversation\(/);
  assert.match(ordenes, /ID_TIENDA_VIRTUAL\s*\)/);
});
