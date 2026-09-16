// ----------------------------------------------------------------------
// LO QUE LE ESCRIBEN A UN BUZON Y NADIE CONTESTA.
//
// Lo que se rompia: un mensaje a la Tienda o a la Oficina podia quedarse sin
// respuesta y nadie se enteraba. El unico rastro era el contador de la bandeja,
// que solo ve quien entra a mirarlo, y como el buzon lo atienden varios, cada
// uno podia dar por hecho que contestaba el otro.
//
// Lo que se mide aqui: cuando toca avisar (una hora, y otra vez a las 24 con
// señal de advertencia), desde cuando se cuenta —el primer mensaje sin
// contestar, no el ultimo— y que contestar para el reloj.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AVISO_PRIMERO,
  AVISO_SEGUNDO,
  relojSinResponder,
  SENAL_DE_ADVERTENCIA,
  avisoPendienteDeBuzon,
  idDeAvisoSinResponder,
  textoDeAvisoSinResponder,
} from '../../src/server/chat-buzon-sin-responder.mjs';
import { BUZON_TIENDA, esBuzonCompartido } from '../../src/utils/chat-buzones.mjs';

const MIEMBRO = 137;
const AHORA = Date.parse('2026-09-15T12:00:00.000Z');
const haceMinutos = (minutos) => new Date(AHORA - minutos * 60_000).toISOString();

const conversacionDeLaTienda = ({ de = MIEMBRO, enviadoEn, sinResponderDesde = '' } = {}) => ({
  idConversacion: 'conv-tienda',
  participantesIds: [MIEMBRO, BUZON_TIENDA.idMiembros],
  sinResponderDesde,
  eliminada: false,
  ultimoMensaje: { idMensaje: 'msg-1', remitenteIdMiembros: de, enviadoEn },
});

const avisoDe = (conversacion) =>
  avisoPendienteDeBuzon({
    conversacion,
    idMiembrosBuzon: BUZON_TIENDA.idMiembros,
    ahora: AHORA,
  });

test('antes de la hora no se avisa de nada', () => {
  assert.equal(avisoDe(conversacionDeLaTienda({ enviadoEn: haceMinutos(59) })), null);
});

test('pasada la hora sin respuesta, primer aviso', () => {
  assert.equal(avisoDe(conversacionDeLaTienda({ enviadoEn: haceMinutos(61) })), AVISO_PRIMERO);
});

test('pasadas 24 horas, el segundo aviso y solo el segundo', () => {
  assert.equal(
    avisoDe(conversacionDeLaTienda({ enviadoEn: haceMinutos(25 * 60) })),
    AVISO_SEGUNDO,
    'soltar los dos de golpe seria ruido para decir una sola cosa'
  );
});

test('si contesto el buzon, no hay nada pendiente', () => {
  assert.equal(
    avisoDe(
      conversacionDeLaTienda({ de: BUZON_TIENDA.idMiembros, enviadoEn: haceMinutos(48 * 60) })
    ),
    null
  );
});

test('el reloj corre desde el PRIMER mensaje sin contestar', () => {
  // Escribio hace tres horas y volvio a escribir hace un minuto: si contara el
  // ultimo mensaje, insistir retrasaria el aviso para siempre.
  assert.equal(
    avisoDe(
      conversacionDeLaTienda({
        enviadoEn: haceMinutos(1),
        sinResponderDesde: haceMinutos(3 * 60),
      })
    ),
    AVISO_PRIMERO
  );
});

test('una conversacion borrada no avisa', () => {
  assert.equal(
    avisoDe({ ...conversacionDeLaTienda({ enviadoEn: haceMinutos(90) }), eliminada: true }),
    null
  );
});

test('sin mensajes todavia no hay reloj', () => {
  assert.equal(avisoDe({ idConversacion: 'conv-vacia', ultimoMensaje: null }), null);
});

// ----------------------------------------------------------------------
// EL RELOJ, AL ESCRIBIR
// ----------------------------------------------------------------------

test('el primer mensaje al buzon arranca el reloj', () => {
  assert.deepEqual(
    relojSinResponder({
      participantesIds: [MIEMBRO, BUZON_TIENDA.idMiembros],
      remitenteIdMiembros: MIEMBRO,
      enviadoEn: haceMinutos(0),
      esBuzon: esBuzonCompartido,
    }),
    { sinResponderDesde: haceMinutos(0) }
  );
});

test('el segundo mensaje de quien insiste no reinicia el reloj', () => {
  assert.equal(
    relojSinResponder({
      participantesIds: [MIEMBRO, BUZON_TIENDA.idMiembros],
      sinResponderDesde: haceMinutos(90),
      remitenteIdMiembros: MIEMBRO,
      enviadoEn: haceMinutos(0),
      esBuzon: esBuzonCompartido,
    }),
    null
  );
});

test('cuando contesta el buzon, el reloj se para', () => {
  assert.deepEqual(
    relojSinResponder({
      participantesIds: [MIEMBRO, BUZON_TIENDA.idMiembros],
      sinResponderDesde: haceMinutos(90),
      remitenteIdMiembros: BUZON_TIENDA.idMiembros,
      enviadoEn: haceMinutos(0),
      esBuzon: esBuzonCompartido,
    }),
    { sinResponderDesde: '' }
  );
});

test('una conversacion entre personas no lleva reloj', () => {
  assert.equal(
    relojSinResponder({
      participantesIds: [MIEMBRO, 999],
      remitenteIdMiembros: MIEMBRO,
      enviadoEn: haceMinutos(0),
      esBuzon: esBuzonCompartido,
    }),
    null
  );
});

// ----------------------------------------------------------------------
// EL TEXTO Y EL IDENTIFICADOR
// ----------------------------------------------------------------------

test('el segundo aviso termina con la señal de advertencia', () => {
  const texto = textoDeAvisoSinResponder({
    buzon: BUZON_TIENDA,
    paso: AVISO_SEGUNDO,
    nombreDeQuienEscribio: 'Roderi Peña',
  });

  assert.equal(texto.endsWith(SENAL_DE_ADVERTENCIA), true);
  assert.match(texto, /24 horas/);
});

test('el primer aviso no lleva señal', () => {
  const texto = textoDeAvisoSinResponder({
    buzon: BUZON_TIENDA,
    paso: AVISO_PRIMERO,
    nombreDeQuienEscribio: 'Roderi Peña',
  });

  assert.equal(texto.includes(SENAL_DE_ADVERTENCIA), false);
  assert.match(texto, /Tienda Virtual/);
});

test('cada paso y cada destinatario tienen su propio aviso', () => {
  const de = (paso, uid) =>
    idDeAvisoSinResponder({ buzon: BUZON_TIENDA, idConversacion: 'conv-1', paso, uid });

  assert.notEqual(de(AVISO_PRIMERO, 'uid-1'), de(AVISO_SEGUNDO, 'uid-1'));
  assert.notEqual(de(AVISO_PRIMERO, 'uid-1'), de(AVISO_PRIMERO, 'uid-2'));
  // El mismo caso dos veces da el mismo identificador: el aviso no se repite
  // cada vez que alguien abre la aplicacion.
  assert.equal(de(AVISO_PRIMERO, 'uid-1'), de(AVISO_PRIMERO, 'uid-1'));
});

test('el resumen de buzones se vuelve a consultar aunque no llegue otro mensaje', () => {
  const acciones = fs.readFileSync(path.resolve('src/actions/chat.js'), 'utf8');
  const ruta = fs.readFileSync(path.resolve('src/app/api/chat/route.js'), 'utf8');

  assert.match(acciones, /CHAT_SHARED_MAILBOX_REMINDER_REFRESH_INTERVAL = 60_000/);
  assert.match(
    acciones,
    /refreshInterval: CHAT_SHARED_MAILBOX_REMINDER_REFRESH_INTERVAL[\s\S]*?refreshWhenHidden: true/
  );
  assert.match(ruta, /const CADA_CUANTO_SE_REVISA_MS = 60_000/);
  assert.match(ruta, /FieldValue\.serverTimestamp\(\) : serverTimestamp\(\)/);
  assert.match(ruta, /avatarActualDeBuzon\(buzon\)/);
  assert.match(ruta, /actorFotoURL: avatarDelBuzon/);
  assert.match(ruta, /imagenURL: avatarDelBuzon/);
  assert.match(ruta, /miniaturaURL: avatarDelBuzon/);
  assert.doesNotMatch(
    ruta,
    /creadoEnServidor: serverTimestamp\(\)|actualizadoEnServidor: serverTimestamp\(\)/
  );
});

// ----------------------------------------------------------------------
// EL CABLEADO
// ----------------------------------------------------------------------

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('el aviso se revisa cuando el buzon pide su contador, y una sola vez', () => {
  const ruta = leer('src/app/api/chat/route.js');

  // No hay tareas programadas: el momento de mirarlo es cuando quien atiende el
  // buzon tiene la aplicacion abierta.
  assert.match(ruta, /avisarDeLoQueNadieContesta\(buzonDelResumen, conversations\)/);
  // Volver a escribir el aviso lo devolveria a "no leida" en cada revision.
  assert.match(ruta, /if \(await existeNotificacion\(id\)/);
  // A quien ejerce el cargo del buzon y al Administrador Global.
  assert.match(ruta, /perfilesDelBuzon\(buzon\)/);
});

test('el reloj de la conversacion cabe en las reglas', () => {
  const reglas = leer('firestore.rules');

  // Sin esto, enviar un mensaje a un buzon lo rechazaria Firestore entero: el
  // campo nuevo no estaria en la lista de los que se pueden tocar.
  assert.match(reglas, /'sinResponderDesde',\s+'activa'/);
  assert.equal(reglas.split('sinResponderDesde').length - 1, 4);
});

// Iba dentro de la escritura del ultimo mensaje. Con unas reglas publicadas que
// no conocian el campo, Firestore rechazaba la escritura entera: el mensaje
// quedaba guardado pero la conversacion no se actualizaba, y a quien escribia
// como la Tienda le salia "No tienes permiso para realizar esta acción".
test('el reloj se apunta aparte y un fallo suyo no tumba el mensaje', () => {
  const ruta = leer('src/app/api/chat/route.js');

  assert.doesNotMatch(ruta, /\.\.\.\(relojDelBuzon \?\? \{\}\)/);
  assert.match(ruta, /await apuntarRelojDelBuzon\(chatStore, conversationPath, relojDelBuzon\)/);

  const apuntar = ruta.slice(ruta.indexOf('async function apuntarRelojDelBuzon'));

  assert.match(apuntar, /setDocument\(conversationPath, reloj, \{ merge: true \}\)\.catch\(/);
});
