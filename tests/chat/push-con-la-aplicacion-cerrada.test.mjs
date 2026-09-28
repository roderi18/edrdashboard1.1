// LOS PUSH TIENEN QUE LLEGAR CON LA APLICACIÓN CERRADA.
//
// Se enviaban con urgencia "normal" y una hora de vida: con el teléfono en
// reposo, el servicio push los retenía hasta que el aparato despertaba, y en la
// práctica llegaban al abrir la aplicación. Además, el push del chat se lanzaba
// sin esperarlo y la función del servidor terminaba antes de enviarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { OPCIONES_ENVIO_PUSH } from '../../src/utils/web-push-opciones.mjs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('los push salen con urgencia alta y un día de vida', () => {
  assert.equal(OPCIONES_ENVIO_PUSH.urgency, 'high');
  assert.ok(OPCIONES_ENVIO_PUSH.TTL >= 24 * 60 * 60);
});

test('todo envío push usa esas opciones, nunca unas propias', () => {
  for (const ruta of [
    'src/server/web-push.js',
    'netlify/functions/cumpleanos-diarios.mjs',
    'netlify/functions/resumen-actualizaciones-diario.mjs',
  ]) {
    const codigo = leer(ruta);
    assert.match(codigo, /sendNotification\([^)]*OPCIONES_ENVIO_PUSH\)/, ruta);
    assert.doesNotMatch(codigo, /sendNotification\([^)]*\{\s*TTL/, ruta);
  }
});

test('el chat espera al push antes de responder', () => {
  assert.match(leer('src/app/api/chat/route.js'), /await enviarPushAUsuarios\(/);
});

test('un servidor sin claves push no marca el aviso como intentado', () => {
  const ruta = leer('src/app/api/push/notificacion/route.js');
  const comprobacion = ruta.indexOf('webPushConfigurado()');
  const marca = ruta.indexOf('pushIntentadoPor');
  assert.ok(comprobacion > 0, 'la ruta comprueba las claves');
  assert.ok(comprobacion < marca, 'y lo hace antes de marcar el aviso');
});
