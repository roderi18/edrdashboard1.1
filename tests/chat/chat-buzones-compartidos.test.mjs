import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// BUZONES COMPARTIDOS DEL CHAT: TIENDA VIRTUAL Y OFICINA NACIONAL.
//
// La Tienda Virtual era el unico buzon compartido, escrito a mano. Oficina
// Nacional necesitaba lo mismo, y copiar la Tienda habria dejado dos
// implementaciones que se separan. Ahora un buzon es una entrada de
// `src/utils/chat-buzones.mjs` y todo lo demas se construye de ella.
//
// Lo que vigila esta suite:
//   - que cada buzon lo atiendan SOLO sus cargos, y el Administrador Global todos;
//   - que una misma persona con los dos cargos atienda los dos buzones;
//   - que tener acceso a uno no abra el otro, ni con el token de un buzon;
//   - que ninguna persona pueda usar el numero de un buzon;
//   - que el cargo del buzon cuente en CUALQUIER posicion (el cuarto, el quinto...);
//   - que las reglas cubran a los dos, tambien fuera del cargo principal;
//   - que la foto del buzon la cambie solo el Administrador Global y no admita
//     direcciones de otra web.
// ----------------------------------------------------------------------

const {
  BUZON_TIENDA,
  BUZON_OFICINA_NACIONAL,
  BUZONES_COMPARTIDOS,
  buzonPorClave,
  buzonPorIdMiembros,
  esIdReservadoDeBuzon,
  puedeAtenderBuzon,
  contactoDeBuzon,
  idConversacionConBuzon,
  avatarDeBuzonValido,
} = await import('src/utils/chat-buzones.mjs');
const { crearAutenticadorDeBuzon } = await import('src/server/chat-buzones-core.mjs');
const { resolveAuthenticatedMember } = await import('src/server/chat-auth-core.mjs');
const { listaDeRolesQueEjerce } = await import('src/utils/lista-roles-que-ejerce.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const perfil = (collection, datos) => ({ collection, id: 'uid', ...datos });

const peticionCon = (token) => ({
  headers: { get: (nombre) => (nombre.toLowerCase() === 'authorization' ? `Bearer ${token}` : '') },
});

// ----------------------------------------------------------------------
// LA LISTA
// ----------------------------------------------------------------------

test('Oficina Nacional es el 20002, con su identidad y su coleccion de respuestas', () => {
  assert.equal(BUZON_OFICINA_NACIONAL.idMiembros, 20002);
  assert.equal(BUZON_OFICINA_NACIONAL.uid, 'oficina-nacional');
  assert.equal(BUZON_OFICINA_NACIONAL.codigo, 'EDR-20002');
  assert.equal(BUZON_OFICINA_NACIONAL.coleccionRespuestas, 'respuestas_oficina');
  assert.equal(buzonPorClave('oficina'), BUZON_OFICINA_NACIONAL);
  assert.equal(buzonPorIdMiembros('20001'), BUZON_TIENDA);
  assert.equal(buzonPorIdMiembros(147), null);
});

test('los buzones no comparten numero, identidad, bandeja ni respuestas', () => {
  ['idMiembros', 'uid', 'codigo', 'clave', 'coleccionRespuestas'].forEach((campo) => {
    const valores = BUZONES_COMPARTIDOS.map((buzon) => buzon[campo]);

    assert.equal(new Set(valores).size, valores.length, `se repite ${campo}`);
  });
});

test('la conversacion con la Oficina es la individual de siempre', () => {
  assert.equal(idConversacionConBuzon(BUZON_OFICINA_NACIONAL, 147), 'individual_147_20002');
  assert.equal(contactoDeBuzon(BUZON_OFICINA_NACIONAL).name, 'Oficina Nacional');
});

test('ninguna persona inicia sesion con el numero de un buzon', () => {
  assert.equal(esIdReservadoDeBuzon(20001), true);
  assert.equal(esIdReservadoDeBuzon(20002), true);
  assert.equal(esIdReservadoDeBuzon(147), false);

  assert.throws(() =>
    resolveAuthenticatedMember({ decodedToken: { uid: 'persona', idMiembros: 20002 } })
  );
});

// ----------------------------------------------------------------------
// QUIEN ATIENDE CADA BUZON
// ----------------------------------------------------------------------

test('el Administrador Global atiende TODOS los buzones', () => {
  const perfiles = [perfil('usuarios_roles', { rolId: 'administrador_global' })];

  BUZONES_COMPARTIDOS.forEach((buzon) => {
    assert.equal(puedeAtenderBuzon(buzon, { perfiles }), true, buzon.nombre);
  });
  // Tambien las cuentas antiguas.
  assert.equal(
    puedeAtenderBuzon(BUZON_OFICINA_NACIONAL, { perfiles: [perfil('admins', {})] }),
    true
  );
});

test('la Oficina Nacional atiende su buzon y no el de la Tienda', () => {
  const perfiles = [perfil('usuarios_roles', { rolId: 'oficina_nacional' })];

  assert.equal(puedeAtenderBuzon(BUZON_OFICINA_NACIONAL, { perfiles }), true);
  assert.equal(puedeAtenderBuzon(BUZON_TIENDA, { perfiles }), false);
});

test('una misma persona con los dos cargos atiende los dos buzones', () => {
  const perfiles = [
    perfil('usuarios_roles', {
      rolId: 'administrador_tienda',
      cargos: [{ rol: 'oficina_nacional' }],
    }),
  ];

  assert.equal(puedeAtenderBuzon(BUZON_TIENDA, { perfiles }), true);
  assert.equal(puedeAtenderBuzon(BUZON_OFICINA_NACIONAL, { perfiles }), true);
});

test('el cargo del buzon cuenta en cualquier posicion: el cuarto, el quinto...', () => {
  // Cuatro cargos de directiva delante y la Oficina Nacional en quinto lugar.
  const cargos = [
    { rol: 'usuario_seccion' },
    { rol: 'capellan_seccional' },
    { rol: 'lider_grupo' },
    { rol: 'oficina_nacional' },
  ];
  const perfiles = [perfil('usuarios_roles', { rolId: 'usuario_destacamento', cargos })];

  assert.equal(puedeAtenderBuzon(BUZON_OFICINA_NACIONAL, { perfiles }), true);
  assert.equal(puedeAtenderBuzon(BUZON_TIENDA, { perfiles }), false);

  // Y la lista que leen las reglas y los avisos los lleva todos.
  const lista = listaDeRolesQueEjerce({ rolId: 'usuario_destacamento', cargos });

  assert.equal(lista.length, 5);
  assert.ok(lista.includes('oficina_nacional'));
});

test('un miembro sin cargo y users/<uid> no abren ningun buzon', () => {
  BUZONES_COMPARTIDOS.forEach((buzon) => {
    assert.equal(
      puedeAtenderBuzon(buzon, {
        perfiles: [perfil('usuarios_roles', { rolId: 'usuario_comun' })],
      }),
      false
    );
    assert.equal(
      puedeAtenderBuzon(buzon, { perfiles: [perfil('users', { rolId: 'administrador_global' })] }),
      false
    );
  });
});

// ----------------------------------------------------------------------
// EL SERVIDOR
// ----------------------------------------------------------------------

const autenticadorDe = (buzon, { perfiles = [], claims = {} } = {}) =>
  crearAutenticadorDeBuzon({
    buzon,
    verifyIdToken: async (token) => ({ uid: token, ...claims }),
    cargarPerfiles: async () => perfiles,
    obtenerTokenDeBuzon: async () => `token-de-${buzon.clave}`,
  });

test('con el cargo, la peticion actua como Oficina Nacional y guarda quien contesto', async () => {
  const actor = await autenticadorDe(BUZON_OFICINA_NACIONAL, {
    perfiles: [
      perfil('usuarios_roles', { rolId: 'oficina_nacional', nombre: 'Ana', idMiembros: 90 }),
    ],
  })(peticionCon('uid-ana'));

  assert.equal(actor.uid, 'oficina-nacional');
  assert.equal(actor.idMiembros, 20002);
  assert.equal(actor.buzon, 'oficina');
  assert.equal(actor.esBuzonCompartido, true);
  assert.equal(actor.esTiendaVirtual, false);
  assert.equal(actor.token, 'token-de-oficina');
  assert.equal(actor.responsable.uid, 'uid-ana');
  assert.equal(actor.responsable.nombre, 'Ana');
  assert.equal(actor.responsable.idMiembros, 90);
  // La Oficina Nacional no es Administrador Global: no vera quien contesto.
  assert.equal(actor.responsable.esAdministradorGlobal, false);
});

// ----------------------------------------------------------------------
// LA AUDITORIA: QUIEN CONTESTA COMO EL BUZON
// ----------------------------------------------------------------------

test('se guarda el nombre y el USUARIO de quien contesta, no solo el nombre', async () => {
  const actor = await autenticadorDe(BUZON_TIENDA, {
    perfiles: [
      perfil('usuarios_roles', {
        rolId: 'administrador_global',
        nombre: 'Roderi Pena',
        codigoMiembro: 'EDR-10002',
        correo: 'roderi@test.do',
        idMiembros: 2,
      }),
    ],
    claims: { email: 'roderi@test.do' },
  })(peticionCon('uid-roderi'));

  assert.equal(actor.responsable.nombre, 'Roderi Pena');
  assert.equal(actor.responsable.usuario, 'EDR-10002');
  assert.equal(actor.responsable.correo, 'roderi@test.do');
  assert.equal(actor.responsable.esAdministradorGlobal, true);
});

test('sin codigo de miembro, el usuario es su correo', async () => {
  const actor = await autenticadorDe(BUZON_OFICINA_NACIONAL, {
    perfiles: [perfil('admins', { nombre: 'Admin' })],
    claims: { email: 'admin@test.do' },
  })(peticionCon('uid-admin'));

  assert.equal(actor.responsable.usuario, 'admin@test.do');
});

test('quien contesto SOLO lo ve el Administrador Global, y queda en Historial', () => {
  const ruta = leer('src/app/api/chat/route.js');
  const cableado = leer('src/server/chat-buzones.js');
  const mensaje = leer('src/sections/chat/chat-message-item.jsx');

  // El resto de quienes atienden el buzon —y el miembro— no reciben el dato.
  assert.ok(
    ruta.includes('chatActor?.esBuzonCompartido && chatActor?.responsable?.esAdministradorGlobal')
  );
  assert.ok(ruta.includes('respondidoPorUsuario: respuesta.usuario'));
  assert.ok(mensaje.includes('message.respondidoPorUsuario'));
  // Aparte del mensaje y en Historial, con usuario y conversacion.
  assert.ok(cableado.includes('usuario: responsable.usuario'));
  assert.ok(cableado.includes('.collection(COLECCION_AUDITORIA_SISTEMA)'));
  assert.ok(cableado.includes("accion: 'respuesta_buzon_compartido'"));
});

// ----------------------------------------------------------------------
// LOS AVISOS, EN TIEMPO REAL
// ----------------------------------------------------------------------

test('el aviso de un buzon llega a quien lo atiende aunque entre como miembro', () => {
  const servicio = leer('src/services/notification-service.js');
  const ruta = leer('src/app/api/chat/route.js');

  // Antes se guardaba como 'admin' y la campana lo tiraba a las sesiones de miembro.
  assert.ok(ruta.includes('...(profile.buzon && { buzon: profile.buzon.clave })'));
  assert.ok(
    servicio.indexOf('if (notificacion.metadatos?.buzon) return true;') <
      servicio.indexOf("if (rolDestinatario === 'admin') return usuarioEsAdmin;")
  );
});

test('recibe el aviso quien tiene el cargo del buzon en cualquier posicion', () => {
  assert.ok(
    leer('src/server/chat-buzones.js').includes(
      ".where('rolesQueEjerce', 'array-contains-any', [...buzon.cargos])"
    )
  );
});

test('la campana y el contador de chats de los buzones se mueven en tiempo real', () => {
  const layout = leer('src/layouts/dashboard/layout.jsx');

  // La escucha sigue viva; ahora ademas suena la campana en el mismo aviso, sin
  // esperar a que la lista se recargue.
  assert.match(layout, /escucharNotificacionesDelUsuario\(user\?\.uid, \(cambio\) => \{/);
  assert.ok(layout.includes('cargarNotificaciones();'));
  assert.ok(layout.includes('useBuzonesEnVivo(buzonesQueAtiendo'));
  assert.ok(layout.includes('Object.keys(pendientesDeBuzones)'));
});

test('quien atiende la Tienda no entra en la Oficina: 403', async () => {
  await assert.rejects(
    autenticadorDe(BUZON_OFICINA_NACIONAL, {
      perfiles: [perfil('usuarios_roles', { rolId: 'administrador_tienda' })],
    })(peticionCon('uid-tienda')),
    (error) => error.status === 403
  );
});

test('el token de un buzon no abre ningun buzon, tampoco el otro', async () => {
  const perfiles = [perfil('usuarios_roles', { rolId: 'administrador_global' })];

  await assert.rejects(
    autenticadorDe(BUZON_OFICINA_NACIONAL, { perfiles })(peticionCon('tienda-virtual')),
    (error) => error.status === 401
  );
  await assert.rejects(
    autenticadorDe(BUZON_TIENDA, { perfiles, claims: { idMiembros: 20002 } })(
      peticionCon('otra-cuenta')
    ),
    (error) => error.status === 401
  );
});

test('la ruta del chat reparte la autenticacion por buzon y avisa a los de cada uno', () => {
  const ruta = leer('src/app/api/chat/route.js');

  assert.match(ruta, /buzon \? autenticarBuzon\(buzon, req\) : authenticateChatRequest\(req\)/);
  assert.match(ruta, /perfilesDelBuzon\(buzon\)/);
  assert.match(ruta, /bandeja=\$\{profile\.buzon\.clave\}/);
  // Los contactos llevan a todos los buzones, con su foto actual.
  assert.match(ruta, /\.\.\.\(await contactosDeBuzones\(\)\)/);
  assert.doesNotMatch(ruta, /esTiendaVirtual|ID_TIENDA_VIRTUAL/);
});

// ----------------------------------------------------------------------
// LA PANTALLA
// ----------------------------------------------------------------------

test('las bandejas salen de los permisos y la pantalla usa el componente', () => {
  const vista = leer('src/sections/chat/view/chat-view.jsx');
  const util = leer('src/sections/chat/utils/buzones-del-chat.js');

  assert.match(vista, /<ChatBandejas buzones=\{buzones\} bandeja=\{bandeja\}/);
  assert.doesNotMatch(vista, /Chats de la Tienda/);
  // Quien atiende se decide con TODOS los cargos, y el Administrador Global entra.
  assert.match(util, /rolesQueEjerce\(user\)\.some/);
  assert.match(util, /isAdminGlobal\(user\)/);
});

test('cambiar la foto esta debajo de "Perfil" y solo para el Administrador Global', () => {
  const cuenta = leer('src/sections/chat/chat-nav-account.jsx');
  const avatar = leer('src/sections/chat/chat-avatar-de-buzon.jsx');

  assert.ok(cuenta.indexOf('Perfil') < cuenta.indexOf('Cambiar foto de'));
  assert.match(cuenta, /puedeCambiar &&\s*BUZONES_COMPARTIDOS\.map/);
  assert.match(avatar, /const puedeCambiar = isAdminGlobal\(user\);/);
});

test('la foto de un buzon solo admite https o una ruta de la aplicacion', () => {
  assert.equal(
    avatarDeBuzonValido('https://firebasestorage.googleapis.com/x.webp').startsWith('https'),
    true
  );
  assert.equal(avatarDeBuzonValido('/logo/logo-single.png'), '/logo/logo-single.png');
  assert.equal(avatarDeBuzonValido('//otro-sitio.test/x.png'), '');
  assert.equal(avatarDeBuzonValido('javascript:alert(1)'), '');
  assert.equal(avatarDeBuzonValido('http://inseguro.test/x.png'), '');
});

// ----------------------------------------------------------------------
// LAS REGLAS
// ----------------------------------------------------------------------

test('las reglas: nadie usurpa el 20002, la Oficina solo lee y sus respuestas son del servidor', () => {
  const reglas = leer('firestore.rules');
  const almacen = leer('storage.rules');

  assert.match(
    reglas,
    /request\.auth\.token\.idMiembros != 20002\s*\|\| request\.auth\.uid == 'oficina-nacional'/
  );
  assert.match(reglas, /function atiendeBuzonDeOficina\(datosConversacion\)/);
  assert.match(
    reglas,
    /match \/respuestas_oficina\/\{idMensaje\} \{\s*allow read, write: if false;/
  );
  assert.doesNotMatch(reglas, /allow (create|update)[^;]*atiende(BuzonDeOficina|UnBuzon)/);
  assert.match(almacen, /idMiembroChat\(\) != 20002 \|\| request\.auth\.uid == 'oficina-nacional'/);
});

test('las reglas cuentan cualquier cargo, y el servidor escribe la lista que leen', () => {
  const reglas = leer('firestore.rules');

  assert.match(reglas, /function ejerceRol\(codigo\)/);
  assert.match(reglas, /rolesQueEjerce\.hasAny\(\[codigo\]\)/);
  assert.match(reglas, /esAdministradorGlobal\(\) \|\| ejerceRol\('oficina_nacional'\)/);
  assert.match(
    leer('src/server/rol-por-cargo.js'),
    /rolesQueEjerce: listaDeRolesQueEjerce\(acceso\)/
  );
  assert.match(
    leer('src/app/api/admin/asignar-rol-administracion/route.js'),
    /rolesQueEjerce: listaDeRolesQueEjerce\(/
  );

  assert.deepEqual(
    listaDeRolesQueEjerce({
      rolId: 'Administrador_Tienda',
      cargos: [{ rol: 'oficina_nacional' }, 'oficina_nacional', { rolId: '' }],
    }),
    ['administrador_tienda', 'oficina_nacional']
  );
});

test('la foto del buzon la escribe solo el Administrador Global, y el comodin no la abre', () => {
  const reglas = leer('firestore.rules');
  const almacen = leer('storage.rules');

  assert.match(
    reglas,
    /match \/buzones_chat\/\{claveBuzon\} \{[\s\S]*?allow create, update: if esAdministradorGlobal\(\)/
  );
  assert.match(reglas, /&& coleccion != 'buzones_chat'/);
  assert.match(
    almacen,
    /match \/chat-buzones\/\{claveBuzon\}\/\{archivo\} \{[\s\S]*?esAdministradorGlobal\(\)/
  );
});
