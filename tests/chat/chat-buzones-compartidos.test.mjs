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

test('la campana sigue en tiempo real y el contador usa un resumen combinado', () => {
  const layout = leer('src/layouts/dashboard/layout.jsx');
  const summary = leer('src/actions/chat-summary.js');

  // La campana conserva su escucha. El contador deja de abrir una suscripcion
  // por buzon en todas las pantallas y los agrupa en una sola peticion.
  assert.match(layout, /escucharNotificacionesDelUsuario\(user\?\.uid, \(cambio\) => \{/);
  assert.ok(layout.includes('cargarNotificaciones();'));
  assert.match(layout, /useGetDashboardChatSummary\(\{/);
  assert.match(summary, /sessionMemberIds: identityKey/);
  assert.match(summary, /SUMMARY_REFRESH_INTERVAL = 60_000/);
  assert.doesNotMatch(layout, /useBuzonesEnVivo|usePresenceHeartbeat|useChatRealtimeSync/);
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

// UN BUZON TAMBIEN ENTRA EN UN GRUPO. Al agregarlo, la ruta buscaba el numero
// 20001 en el padron —donde no esta, porque un buzon se añade aparte—, no
// encontraba a nadie y le preguntaba el numero a ese `null`: la peticion entera
// se caia con "No se pudo actualizar el chat".
test('agregar un buzon a un grupo lo busca donde vive, y un desconocido no tumba nada', () => {
  const ruta = leer('src/app/api/chat/route.js');
  const agregar = ruta.slice(ruta.indexOf("if (action === 'add-participants')"));

  assert.match(agregar, /await conLosBuzones\(getAllContacts\(/);
  assert.match(agregar, /member\?\.idMiembros &&/);
});

test('las bandejas salen de los permisos y se cambian desde la lista', () => {
  const vista = leer('src/sections/chat/view/chat-view.jsx');
  const lista = leer('src/sections/chat/chat-nav.jsx');
  const util = leer('src/sections/chat/utils/buzones-del-chat.js');

  // LAS BANDEJAS VIVEN EN LA LISTA, NO ENCIMA DEL CHAT. Eran pestañas con su
  // propia fila —titulo "Mensajes" incluido— y se llevaban unos 80px de alto de
  // una pantalla que lo que enseña son mensajes. Ahora son las fotos que hay al
  // lado de la del buzon abierto, y la vista solo reparte los datos.
  assert.match(vista, /buzones=\{buzones\}/);
  assert.match(vista, /onCambiarBandeja=\{handleCambiarBandeja\}/);
  // Ni el titulo ni las pestañas: se mira el JSX, no los comentarios que
  // cuentan por que se fueron.
  assert.doesNotMatch(vista, /<Typography variant="h4">/);
  assert.doesNotMatch(vista, /<ChatBandejas[\s>]/);
  assert.match(lista, /<ChatBandejasAvatares/);
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

// ----------------------------------------------------------------------
// LO QUE ABRE UNO, LO HAN VISTO TODOS
// ----------------------------------------------------------------------

// El contador de un buzon ya era uno solo, pero el aviso de campana es uno por
// persona: si abria el mensaje quien atiende la Tienda, los demas seguian con su
// aviso "no leido" de algo que ya estaba atendido.
test('abrir un mensaje del buzon marca leido el aviso de todos los que lo atienden', () => {
  const ruta = leer('src/app/api/chat/route.js');
  const marcar = ruta.slice(ruta.indexOf('async function markAsSeen'));

  assert.match(marcar, /if \(hadUnreadMessages && chatActor\?\.esBuzonCompartido\)/);

  const limpiar = ruta.slice(ruta.indexOf('async function marcarAvisosDelBuzonComoLeidos'));

  // Solo los de "mensaje recibido" de esa conversacion y de ese buzon: abrir no
  // es contestar, y los de "sin responder" siguen.
  assert.match(limpiar, /'metadatos\.idConversacion', '==', String\(conversationId\)/);
  assert.match(limpiar, /'tipoNotificacion', '==', 'mensaje_recibido'/);
  assert.match(limpiar, /aviso\.metadatos\?\.buzon !== buzon\.clave/);
});

test('el circulo de un buzon se repasa solo, y quien abre ve su contador al momento', () => {
  const acciones = leer('src/actions/chat.js');

  assert.match(
    acciones,
    /refreshInterval: esBuzonCompartido\(idMiembros\)\s*\?\s*CHAT_SHARED_MAILBOX_REMINDER_REFRESH_INTERVAL/
  );

  const abrir = acciones.slice(acciones.indexOf('export async function clickConversation'));

  assert.match(
    abrir,
    /endpoint: 'mark-as-seen'[\s\S]*?mutate\(\(key\) => isChatUnreadSummaryKey\(key\)\)/
  );
});
