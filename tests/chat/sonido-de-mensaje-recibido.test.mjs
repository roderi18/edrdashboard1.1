// ----------------------------------------------------------------------
// QUE SUENA CUANDO LLEGA UN MENSAJE.
//
// Se rompian dos cosas a la vez:
//
// 1. Una conversacion que la escucha no habia visto nunca NO sonaba. Como el
//    "nunca vista" era la misma señal que "acabo de suscribirme", quien te
//    escribia por primera vez llegaba en silencio.
// 2. Lo que le escribian a un buzon compartido (Tienda, Oficina) no sonaba
//    fuera del chat: subia el contador y ya.
//
// Y al arreglarlas hay que no romper lo de antes: la lista entera que llega al
// suscribirse no puede soltar una campanada por conversacion, y el mismo mensaje
// no puede sonar dos veces por estar escuchado desde dos sitios.
// ----------------------------------------------------------------------

import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import {
  debeSonarPorMensajeNuevo,
  olvidarMensajesQueSonaron,
} from '../../src/sections/chat/utils/sonido-de-mensaje.mjs';

const YO = 101;
const OTRO = 202;

const conversacion = ({
  id = 'conv-1',
  idMensaje = 'msg-1',
  de = OTRO,
  sinLeer = 1,
  silenciada = false,
} = {}) => ({
  idConversacion: id,
  ultimoMensaje: { idMensaje, remitenteIdMiembros: de },
  noLeidosPorIdMiembros: { [String(YO)]: sinLeer },
  silenciadoPorIdMiembros: silenciada ? { [String(YO)]: true } : {},
});

beforeEach(() => olvidarMensajesQueSonaron());

test('la lista que llega al suscribirse no suena', () => {
  assert.equal(
    debeSonarPorMensajeNuevo(conversacion(), YO, { primeraFoto: true }),
    false,
    'entrar a una pantalla soltaria una campanada por conversacion'
  );
});

test('un mensaje nuevo de otra persona suena', () => {
  debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-1' }), YO, { primeraFoto: true });

  assert.equal(debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-2' }), YO), true);
});

test('quien te escribe por primera vez tambien suena', () => {
  debeSonarPorMensajeNuevo(conversacion({ id: 'conv-vieja' }), YO, { primeraFoto: true });

  assert.equal(
    debeSonarPorMensajeNuevo(conversacion({ id: 'conv-nueva', idMensaje: 'msg-9' }), YO),
    true,
    'una conversacion que aparece despues de la primera foto es un mensaje que acaba de llegar'
  );
});

test('el mismo mensaje no suena dos veces aunque lo vean dos escuchas', () => {
  debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-1' }), YO, { primeraFoto: true });

  assert.equal(debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-2' }), YO), true);
  assert.equal(
    debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-2' }), YO),
    false,
    'el marco del panel y la pantalla del chat comparten la memoria'
  );
});

test('lo que envio yo no me suena', () => {
  debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-1' }), YO, { primeraFoto: true });

  assert.equal(
    debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-2', de: YO, sinLeer: 0 }), YO),
    false
  );
});

test('una conversacion silenciada no suena', () => {
  debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-1' }), YO, { primeraFoto: true });

  assert.equal(
    debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-2', silenciada: true }), YO),
    false
  );
});

test('sin mensajes por leer no suena: ya se leyo en otra pestaña', () => {
  debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-1' }), YO, { primeraFoto: true });

  assert.equal(
    debeSonarPorMensajeNuevo(conversacion({ idMensaje: 'msg-2', sinLeer: 0 }), YO),
    false
  );
});

test('el buzon compartido suena por su propia identidad', () => {
  const BUZON_TIENDA = 20001;
  const paraLaTienda = (idMensaje) => ({
    idConversacion: 'conv-tienda',
    ultimoMensaje: { idMensaje, remitenteIdMiembros: OTRO },
    noLeidosPorIdMiembros: { [String(BUZON_TIENDA)]: 1 },
    silenciadoPorIdMiembros: {},
  });

  debeSonarPorMensajeNuevo(paraLaTienda('msg-1'), BUZON_TIENDA, { primeraFoto: true });

  assert.equal(debeSonarPorMensajeNuevo(paraLaTienda('msg-2'), BUZON_TIENDA), true);
});

test('una conversacion sin mensajes todavia no suena', () => {
  assert.equal(debeSonarPorMensajeNuevo({ idConversacion: 'conv-1' }, YO), false);
});
