import test from 'node:test';
import assert from 'node:assert/strict';

import {
  crearElemento,
  normalizarMarco,
  normalizarEscena,
} from '../../src/sections/mapa-rd/composicion-mapa.mjs';

test('el texto nace editable y con tamaño de letra independiente', () => {
  const texto = crearElemento('texto', 0);

  assert.equal(texto.texto, 'Texto editable');
  assert.equal(texto.tamanoTexto, 24);
  assert.equal(texto.tipo, 'texto');
});

test('una entidad organizacional no representa a un miembro', () => {
  const entidad = crearElemento('entidad', 0);

  assert.equal(entidad.nivelEntidad, 'nacional');
  assert.equal(entidad.nombreEntidad, 'Consejo Nacional');
  assert.equal(entidad.mostrarNombre, true);
  assert.equal('idMiembro' in entidad, false);
});

test('los iconos decorativos están separados de las entidades', () => {
  const icono = crearElemento('icono', 0);

  assert.equal(icono.tipo, 'icono');
  assert.equal(icono.icono, 'solar:medal-star-circle-bold');
  assert.equal('entidadId' in icono, false);
});

test('los marcos guardados permanecen dentro del lienzo', () => {
  const marco = normalizarMarco({
    id: 'fuera',
    tipo: 'rectangulo',
    x: 98,
    y: -10,
    ancho: 50,
    alto: 150,
  });

  assert.equal(marco.x, 50);
  assert.equal(marco.y, 0);
  assert.equal(marco.ancho, 50);
  assert.equal(marco.alto, 100);
});

test('una composición inválida vuelve a una escena utilizable', () => {
  const escena = normalizarEscena({ mapa: { x: 500 }, elementos: 'no-es-lista' });

  assert.equal(escena.mapa.id, 'mapa');
  assert.deepEqual(escena.elementos, []);
});
