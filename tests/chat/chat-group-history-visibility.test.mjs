import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const [roomSource, actionSource, viewSource, routeSource, realtimeSource, rulesSource] =
  await Promise.all([
    read('src/sections/chat/chat-room-group.jsx'),
    read('src/actions/chat.js'),
    read('src/sections/chat/view/chat-view.jsx'),
    read('src/app/api/chat/route.js'),
    read('src/sections/chat/hooks/use-chat-realtime-sync.js'),
    read('firestore.rules'),
  ]);

test('al agregar a un grupo se ofrecen las tres opciones de historial', () => {
  assert.match(roomSource, /¿Qué mensajes podrán ver\?/);
  assert.match(roomSource, /value="none"/);
  assert.match(roomSource, /value="last_hour"/);
  assert.match(roomSource, /value="all"/);
  assert.match(roomSource, /Ningún mensaje anterior/);
  assert.match(roomSource, /Mensajes de la última hora/);
  assert.match(roomSource, /Todo el historial/);
});

test('la elección viaja desde la interfaz hasta la actualización del servidor', () => {
  assert.match(viewSource, /newParticipants, historyVisibility/);
  assert.match(actionSource, /historyVisibility,/);
  assert.match(routeSource, /historyVisibility: body\.historyVisibility/);
  assert.match(routeSource, /applyAddedParticipantHistoryVisibility/);
});

test('la API, el tiempo real y las reglas respetan el límite del participante', () => {
  assert.match(routeSource, /visibleAfter: visibilityCutoff/);
  assert.match(routeSource, /sentAtMs > visibilityCutoffMs/);
  assert.match(realtimeSource, /where\('enviadoEn', '>', visibilityCutoff\)/);
  assert.match(rulesSource, /function mensajeVisibleParaMi/);
  assert.match(rulesSource, /datosMensaje\.enviadoEn >/);
});
