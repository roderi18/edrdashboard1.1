import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { crearContorno } from '../../src/sections/mapa-rd/geometria-mapa.mjs';
import {
  acercarEnPunto,
  medirDedos,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../../src/sections/mapa-rd/gestos-mapa.mjs';

// El zoom debe conservar el punto geográfico bajo los dedos incluso al moverlos.
test('el pellizco amplía y sigue el centro móvil de ambos dedos', () => {
  const inicial = { zoom: 2, x: -60, y: 20 };
  const antes = medirDedos([
    { x: 100, y: 150 },
    { x: 200, y: 150 },
  ]);
  const despues = medirDedos([
    { x: 80, y: 170 },
    { x: 280, y: 170 },
  ]);
  const final = acercarEnPunto(
    inicial,
    (inicial.zoom * despues.distancia) / antes.distancia,
    antes.centro,
    despues.centro
  );
  assert.equal(final.zoom, 4);
  assert.equal(
    (antes.centro.x - inicial.x) / inicial.zoom,
    (despues.centro.x - final.x) / final.zoom
  );
  assert.equal(
    (antes.centro.y - inicial.y) / inicial.zoom,
    (despues.centro.y - final.y) / final.zoom
  );
});

test('acercar y alejar alrededor del mismo punto recupera el encuadre', () => {
  const inicial = { zoom: 1, x: 0, y: 0 };
  const centro = { x: 320, y: 200 };
  assert.deepEqual(acercarEnPunto(acercarEnPunto(inicial, 3, centro), 1, centro), inicial);
});

test('los límites de zoom conservan el anclaje', () => {
  const inicial = { zoom: 1, x: 0, y: 0 };
  const centro = { x: 400, y: 300 };
  for (const [escala, limite] of [
    [100, MAX_ZOOM],
    [0.01, MIN_ZOOM],
  ]) {
    const resultado = acercarEnPunto(inicial, escala, centro);
    assert.equal(resultado.zoom, limite);
    assert.equal((centro.x - resultado.x) / resultado.zoom, centro.x);
  }
});

test('al quedar un dedo, el arrastre continúa sin cambiar la escala', () => {
  const inicial = { zoom: 3, x: -500, y: -200 };
  const dedo = medirDedos([{ x: 220, y: 120 }]);
  assert.equal(dedo.distancia, 0);
  const final = acercarEnPunto(inicial, inicial.zoom, dedo.centro, { x: 230, y: 140 });
  assert.deepEqual(final, { zoom: 3, x: -490, y: -180 });
});

test('una provincia comparte la proyección del país y no se amplía por separado', () => {
  const pais = {
    type: 'Polygon',
    coordinates: [
      [
        [-72, 18],
        [-68, 18],
        [-68, 20],
        [-72, 20],
        [-72, 18],
      ],
    ],
  };
  const provincia = {
    type: 'Polygon',
    coordinates: [
      [
        [-72, 18],
        [-71, 18],
        [-71, 19],
        [-72, 18],
      ],
    ],
  };
  assert.equal(crearContorno(pais).split(' ')[0], crearContorno(provincia, pais).split(' ')[0]);
});

test('las 31 provincias y el Distrito Nacional generan contornos válidos', () => {
  const cargar = (archivo) =>
    JSON.parse(
      readFileSync(new URL(`../../src/sections/mapa-rd/${archivo}`, import.meta.url), 'utf8')
    );
  const pais = cargar('republica-dominicana.geo.json');
  const provincias = cargar('provincias.geo.json');
  assert.equal(provincias.features.length, 32);
  assert.equal(new Set(provincias.features.map((f) => f.properties.iso)).size, 32);
  assert(provincias.features.some((f) => f.properties.iso === 'DO-01'));
  for (const provincia of provincias.features) {
    const path = crearContorno(provincia.geometry, pais.geometry);
    assert(path.startsWith('M'));
    assert(path.endsWith('Z'));
    assert(!/NaN|Infinity/.test(path));
  }
});
