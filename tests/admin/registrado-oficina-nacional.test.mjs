// Qué se rompía: destacamentos con número salían con "Registrado en Oficina
// Nacional" apagado. El número lo da la Oficina Nacional: con número, encendido.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  registradoEnOficinaNacional,
  tieneNumeroDeDestacamento,
} from '../../src/utils/registrado-oficina-nacional.mjs';

test('con número de destacamento está registrado aunque se guardara apagado', () => {
  assert.equal(registradoEnOficinaNacional('46', false), true);
  assert.equal(registradoEnOficinaNacional(46, null), true);
});

test('sin número manda lo guardado, y sin nada guardado sigue encendido como antes', () => {
  assert.equal(registradoEnOficinaNacional('', true), true);
  assert.equal(registradoEnOficinaNacional('  ', false), false);
  assert.equal(registradoEnOficinaNacional(null, undefined), true);
});

test('un número hecho solo de espacios no cuenta', () => {
  assert.equal(tieneNumeroDeDestacamento('   '), false);
});
