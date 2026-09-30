import assert from 'node:assert/strict';
import test from 'node:test';

import { CATEGORIAS } from '../../src/sections/mapa-rd/estadisticas-demograficas.mjs';
import { MAX_ZOOM, MIN_ZOOM, VISTA_INICIAL } from '../../src/sections/mapa-rd/gestos-mapa.mjs';

// Se coló `VISTA_INICIAL = { zoom: 10, x: 0, y: 0 }`: el mapa arrancaba a 10×
// anclado en la esquina de arriba a la izquierda y en Datos demográficos solo se
// veía mar. La proyección ya centra el país; la vista inicial no debe moverlo.
test('el mapa arranca sin zoom ni desplazamiento, con el país centrado', () => {
  assert.deepEqual(VISTA_INICIAL, { zoom: 1, x: 0, y: 0 });
  assert.ok(VISTA_INICIAL.zoom >= MIN_ZOOM && VISTA_INICIAL.zoom <= MAX_ZOOM);
});

// Las categorías se pintan con la paleta del tema (`${color}.main`); un hex
// suelto dejaba la pantalla fuera de los colores de la casa y del modo oscuro.
test('cada categoría usa una clave de la paleta, no un hex', () => {
  const paleta = ['primary', 'secondary', 'info', 'success', 'warning', 'error'];
  for (const c of CATEGORIAS) assert.ok(paleta.includes(c.color), `${c.id}: ${c.color}`);
});
