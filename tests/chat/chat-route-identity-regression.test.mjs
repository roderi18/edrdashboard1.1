import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';


const routeUrl = new URL('../../src/app/api/chat/route.js', import.meta.url);
const routeSource = await readFile(routeUrl, 'utf8');
const axiosSource = await readFile(new URL('../../src/lib/axios.js', import.meta.url), 'utf8');

test('cada solicitud del cliente recupera el Bearer vigente de Firebase', () => {
  assert.match(axiosSource, /interceptors\.request\.use\(async/);
  assert.match(axiosSource, /authStateReady/);
  // El token sale de la cuenta viva de Firebase, no de ninguna copia guardada.
  assert.match(axiosSource, /AUTH\?\.currentUser/);
  assert.match(axiosSource, /getIdToken\?\.\(\)/);
  assert.match(axiosSource, /headers\.set\(['"]Authorization['"], `Bearer \$\{token\}`\)/);
});

// Las reglas de Firestore exigen `idMiembros` DENTRO del token; el servidor, en
// cambio, te identifica aunque no venga. Con un token viejo la peticion se
// montaba bien y la base de datos la rechazaba con un "permisos insuficientes"
// que no explicaba nada. Si esto se cae, vuelve ese fallo.
test('un token sin el numero de miembro se renueva antes de salir', () => {
  assert.match(axiosSource, /getIdTokenResult/);
  assert.match(axiosSource, /claims\?\.idMiembros == null/);
  assert.match(axiosSource, /getIdToken\(true\)/);
});

// LOS CUATRO METODOS AUTENTICAN, AHORA A TRAVES DE `autenticarActorDelChat`.
//
// Con el buzon de la Tienda Virtual hay dos formas de autenticar: la de siempre
// (una persona, su token) y la del buzon (una persona CON CARGO que actua como
// la Tienda). Las dos verifican el token. Lo que no puede volver es un metodo
// que se salte ambas.
test('los cuatro métodos autentican la solicitud', () => {
  const calls = routeSource.match(/autenticarActorDelChat\(\s*req\b/g) ?? [];

  assert.equal(calls.length, 4);
  // Y el selector solo reparte entre las dos autenticaciones verificadas.
  assert.match(
    routeSource,
    /esTiendaVirtual\(idMiembrosPedido\) \? autenticarBuzonDeTienda\(req\) : authenticateChatRequest\(req\)/
  );
});

// El `idMiembros` que manda el navegador NO dice quien eres: eso sale del token.
// Solo sirve para pedir el buzon de la Tienda, y aun asi el servidor comprueba el
// cargo. Por eso aparece unicamente como argumento del selector.
test('la ruta no deriva la identidad desde query idMiembros', () => {
  const lecturas = routeSource.match(/searchParams\.get\(['"]idMiembros['"]\)/g) ?? [];
  const comoSelector =
    routeSource.match(
      /autenticarActorDelChat\(\s*req,\s*searchParams\.get\(['"]idMiembros['"]\)/g
    ) ?? [];

  assert.equal(lecturas.length, comoSelector.length);
  assert.ok(lecturas.length <= 1);
});

test('la ruta no deriva la identidad desde body.idMiembros', () => {
  assert.doesNotMatch(routeSource, /body\.idMiembros/);

  const lecturas = routeSource.match(/body\?\.idMiembros/g) ?? [];
  const comoSelector = routeSource.match(/autenticarActorDelChat\(req, body\?\.idMiembros\)/g) ?? [];

  assert.equal(lecturas.length, comoSelector.length);
});

test('envío, creación y mutaciones usan la identidad autenticada', () => {
  assert.match(
    routeSource,
    /createConversation\(body\.conversationData,\s*chatActor,\s*chatStore\)/
  );
  assert.match(
    routeSource,
    /addMessage\(\s*body\.conversationId,\s*body\.messageData,\s*chatActor,\s*chatStore\s*\)/
  );
  assert.match(routeSource, /chatActor,/g);
});

test('las operaciones sensibles usan la autorización centralizada del servidor', () => {
  assert.match(routeSource, /assertChatPermission\(chatActor, CHAT_PERMISSIONS\.VIEW\)/);
  assert.match(routeSource, /assertConversationParticipant\(conversation, chatActor\)/g);
  assert.match(routeSource, /authorizeConversationOperation\(\{/g);
  assert.match(routeSource, /assertMessageAuthor\(messageData, chatActor\)/);
  assert.match(routeSource, /chatAuthorizationErrorResponse\(error\)/g);
});

test('contactos y participantes se proyectan al contrato público del chat', () => {
  assert.match(routeSource, /getPublicChatContacts\(/);
  assert.match(routeSource, /toPublicChatContact\(/g);
  assert.match(routeSource, /createChatMessageDocument\(\{ message, fallbackSender, conversationId \}\)/);
  assert.match(routeSource, /['"]Cache-Control['"]:\s*['"]private, no-store['"]/);
});

test('la vista espera el token y el sidebar usa el resumen global de no leidos', async () => {
  const chatViewSource = await readFile(
    new URL('../../src/sections/chat/view/chat-view.jsx', import.meta.url),
    'utf8'
  );
  const dashboardLayoutSource = await readFile(
    new URL('../../src/layouts/dashboard/layout.jsx', import.meta.url),
    'utf8'
  );

  // Los contactos esperan al token. El segundo argumento solo pide la lista a
  // nombre del buzon de la Tienda cuando se esta en el.
  assert.match(
    chatViewSource,
    /useGetContacts\(\s*Boolean\(user\?\.accessToken\),\s*enBuzon \? ID_TIENDA_VIRTUAL : null\s*\)/
  );
  assert.match(
    dashboardLayoutSource,
    /useGetChatUnreadSummary\(chatMemberId, chatSummaryEnabled\)/
  );
  assert.match(dashboardLayoutSource, /useChatRealtimeSync\(\{/);
  assert.match(dashboardLayoutSource, /usePresenceHeartbeat\(/);
  assert.doesNotMatch(dashboardLayoutSource, /useGetConversations/);
});

test('el resumen de no leidos no descarga mensajes de las conversaciones', () => {
  const start = routeSource.indexOf('async function getUnreadSummary');
  const end = routeSource.indexOf('async function createConversation', start);
  const summarySource = routeSource.slice(start, end);

  assert.ok(start >= 0);
  assert.match(routeSource, /endpoint === ['"]unread-summary['"]/);
  assert.match(summarySource, /noLeidosPorIdMiembros/);
  assert.doesNotMatch(summarySource, /getMessages\(/);
});

test('la entrega se confirma cuando el listener recibe una conversación', async () => {
  const realtimeSource = await readFile(
    new URL('../../src/sections/chat/hooks/use-chat-realtime-sync.js', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /['"]mark-delivered['"]:\s*CHAT_PERMISSIONS\.VIEW/);
  assert.match(realtimeSource, /snapshot\.docChanges\(\)/);
  // Con el id de quien mira: en el buzon, la entrega la confirma la Tienda.
  assert.match(realtimeSource, /markConversationDelivered\(change\.doc\.id, idMiembros\)/);
});
