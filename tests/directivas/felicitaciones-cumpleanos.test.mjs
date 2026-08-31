import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IDS_FELICITACIONES,
  elegirFelicitacion,
  redactarFelicitacion,
  FELICITACIONES_CUMPLEANOS,
} from '../../src/catalogs/felicitaciones-cumpleanos.mjs';

// ----------------------------------------------------------------------
// Los mensajes de felicitacion.
//
// Quien pulsa no escribe nada: sale uno al azar. Y no se repite hasta que la
// lista se agota, para que dos personas que feliciten al mismo cumpleañero no le
// manden lo mismo.
// ----------------------------------------------------------------------

test('cada mensaje tiene un id, y no hay dos iguales', () => {
  assert.equal(new Set(IDS_FELICITACIONES).size, FELICITACIONES_CUMPLEANOS.length);
  assert.equal(
    FELICITACIONES_CUMPLEANOS.every(({ id, texto }) => Boolean(id) && Boolean(texto)),
    true
  );
});

test('ninguno se quedo sin felicitar', () => {
  assert.equal(
    FELICITACIONES_CUMPLEANOS.every(({ texto }) => /felicidades|feliz cumplea/i.test(texto)),
    true
  );
});

// El mensaje llega como mensaje, no como carta.
test('todos son cortos', () => {
  const largos = FELICITACIONES_CUMPLEANOS.filter(({ texto }) => texto.length > 110);

  assert.deepEqual(largos, []);
});

test('el nombre se pone donde toca', () => {
  assert.equal(
    redactarFelicitacion('¡Feliz cumpleaños, {nombre}! Que cumplas muchos más.', 'Adrián'),
    '¡Feliz cumpleaños, Adrián! Que cumplas muchos más.'
  );
});

// Sin nombre la frase tiene que sostenerse: nada de "¡Feliz cumpleaños, !".
test('sin nombre no queda un hueco ni una coma colgando', () => {
  const redactado = redactarFelicitacion('¡Feliz cumpleaños, {nombre}! Que cumplas muchos más.', '');

  assert.equal(redactado, '¡Feliz cumpleaños! Que cumplas muchos más.');
  assert.equal(redactado.includes('{nombre}'), false);
});

test('todos se sostienen sin nombre', () => {
  FELICITACIONES_CUMPLEANOS.forEach(({ id, texto }) => {
    const redactado = redactarFelicitacion(texto, '');

    assert.equal(redactado.includes('{nombre}'), false, `${id} deja el hueco`);
    assert.equal(/,\s*!/.test(redactado), false, `${id} deja una coma colgando`);
  });
});

// --- La rotacion ---

test('no repite hasta que la lista se agota', () => {
  let usados = [];
  const salidos = [];

  for (let i = 0; i < FELICITACIONES_CUMPLEANOS.length; i += 1) {
    const elegida = elegirFelicitacion({ usados });

    salidos.push(elegida.id);
    usados = elegida.usados;
  }

  assert.equal(new Set(salidos).size, FELICITACIONES_CUMPLEANOS.length);
});

test('cuando se agota, vuelve a empezar', () => {
  const elegida = elegirFelicitacion({ usados: IDS_FELICITACIONES });

  assert.equal(elegida.vueltaAEmpezar, true);
  assert.deepEqual(elegida.usados, [elegida.id]);
});

test('la eleccion es al azar, no por orden de lista', () => {
  const primera = elegirFelicitacion({ usados: [], azar: () => 0 });
  const ultima = elegirFelicitacion({ usados: [], azar: () => 0.999 });

  assert.notEqual(primera.id, ultima.id);
  assert.equal(primera.id, FELICITACIONES_CUMPLEANOS[0].id);
  assert.equal(ultima.id, FELICITACIONES_CUMPLEANOS.at(-1).id);
});

test('con un id desconocido en la memoria no se rompe', () => {
  const elegida = elegirFelicitacion({ usados: ['mensaje-que-ya-no-existe'] });

  assert.ok(IDS_FELICITACIONES.includes(elegida.id));
});
