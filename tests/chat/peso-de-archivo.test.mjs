import assert from 'node:assert/strict';
import test from 'node:test';

import { pesoDeArchivo } from '../../src/sections/chat/utils/peso-de-archivo.mjs';

test('bytes, kilobytes y megabytes', () => {
  assert.equal(pesoDeArchivo(512), '512 B');
  assert.equal(pesoDeArchivo(2048), '2.0 KB');
  assert.equal(pesoDeArchivo(5 * 1024 * 1024), '5.0 MB');
});

test('sin dato no se inventa un cero', () => {
  // Un "0 B" al lado del nombre parece un archivo roto; lo que pasa es que el
  // adjunto viejo no guardaba el tamaño.
  assert.equal(pesoDeArchivo(undefined), '');
  assert.equal(pesoDeArchivo(0), '');
  assert.equal(pesoDeArchivo('no es un numero'), '');
});
