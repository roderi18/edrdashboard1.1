// COPIAR, PEGAR E IMANTAR EN LOS LIENZOS ONERRD.
//
// Qué protege:
// - La copia de un texto es siempre un texto FIJO con lo que se leía. Un dato
//   del registro ("Facturar a", el número…) copiado con otro id leía un dato
//   que no existe y la copia salía vacía.
// - Con varios elegidos (Ctrl + clic) se copian todos, y cada pegado cae un
//   poco más allá que el anterior (no encima), con id nuevo, nunca de fábrica.
// - El imán alinea un texto con su VECINO cuando un borde o el centro queda
//   cerca; antes se pegaba al centro de la hoja desde lejos y no se podía
//   dejar un texto donde se quería.

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  copiarOnerrd,
  copiaDeFormaOnerrd,
  copiaDeCampoOnerrd,
  recordarPegadoOnerrd,
  leerPortapapelesOnerrd,
} = await import('../../src/sections/certificates/onerrd/portapapeles-onerrd.js');
const { imantarTextoOnerrd, IMAN_X } = await import('../../src/utils/iman-onerrd.mjs');

test('copiar un dato del registro pega un texto fijo con lo que se leía', () => {
  const facturaA = {
    id: 'facturaA',
    tipo: 'texto',
    etiqueta: 'Facturar a',
    prefijo: 'FACTURAR A: ',
    sufijo: '',
    contenido: '',
    deFabrica: true,
    visible: true,
    x: 30,
    y: 20,
  };
  const copia = copiaDeCampoOnerrd(facturaA, 'FACTURAR A: Ana Ruiz -Dest. 7', [facturaA]);
  assert.equal(copia.tipo, 'fijo');
  assert.equal(copia.contenido, 'FACTURAR A: Ana Ruiz -Dest. 7');
  assert.equal(copia.prefijo, ''); // ya va dentro de lo leído
  assert.equal(copia.deFabrica, false);
  assert.notEqual(copia.id, 'facturaA');
  assert.deepEqual([copia.x, copia.y], [32, 22]);

  // Un texto fijo conserva lo escrito y lo que lo rodea.
  const fijo = { ...facturaA, id: 'texto3', tipo: 'fijo', contenido: 'Hola', prefijo: '«' };
  const otra = copiaDeCampoOnerrd(fijo, '«Hola', [facturaA, fijo, copia]);
  assert.equal(otra.contenido, 'Hola');
  assert.equal(otra.prefijo, '«');
  assert.ok(![facturaA.id, fijo.id, copia.id].includes(otra.id));
});

test('varios copiados: cada pegado cae al lado del anterior', () => {
  const forma = { id: 'barraPie', etiqueta: 'Barra del pie', x: 50, y: 90, visible: false };
  const texto = { id: 'texto1', tipo: 'fijo', etiqueta: 'Texto', x: 10, y: 10 };
  copiarOnerrd([
    { tipo: 'formas', elemento: forma },
    { tipo: 'campo', elemento: texto, texto: 'Hola' },
  ]);
  // Lo copiado es una copia: cambiar el original no cambia lo que se pega.
  forma.x = 1;
  const [deForma, deTexto] = leerPortapapelesOnerrd();
  assert.equal(deTexto.texto, 'Hola');
  const primera = copiaDeFormaOnerrd(deForma.elemento, 'forma9');
  assert.deepEqual([primera.id, primera.x, primera.y, primera.visible], ['forma9', 52, 92, true]);
  recordarPegadoOnerrd([{ tipo: 'formas', elemento: primera }]);
  const segunda = copiaDeFormaOnerrd(leerPortapapelesOnerrd()[0].elemento, 'forma10');
  assert.deepEqual([segunda.x, segunda.y], [54, 94]);
  assert.equal(segunda.etiqueta, 'Barra del pie (copia)');
});

test('el imán alinea un texto con su vecino de cerca, y solo de cerca', () => {
  const arriba = { id: 'a', visible: true, x: 30, y: 40, ancho: 20 }; // de 20 a 40
  const moviendo = { id: 'b', visible: true, x: 0, y: 0, ancho: 10 };

  // Su borde izquierdo (x - 5) cae a 0,5 del de arriba (20): se pega a 20.
  const pegado = imantarTextoOnerrd(moviendo, 25.5, 45, [arriba, moviendo]);
  assert.deepEqual(pegado, { x: 25, guia: 20 });

  // Sus centros, a 0,3: se pega al centro.
  assert.deepEqual(imantarTextoOnerrd(moviendo, 30.3, 45, [arriba]), { x: 30, guia: 30 });

  // Lejos en horizontal (más que IMAN_X) o en vertical: libre.
  assert.equal(imantarTextoOnerrd(moviendo, 25 + IMAN_X + 0.5, 45, [arriba]), null);
  assert.equal(imantarTextoOnerrd(moviendo, 25.5, 80, [arriba]), null);
  // Un texto oculto no imanta.
  assert.equal(imantarTextoOnerrd(moviendo, 25.5, 45, [{ ...arriba, visible: false }]), null);
});
