import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const componente = fs.readFileSync('src/components/upload/foto-de-miembro.jsx', 'utf8');

test('la foto termina el skeleton cuando carga o falla', () => {
  // Avatar pone las props normales en su div raiz, no en el <img>. Una precarga
  // propia permite cerrar el skeleton en ambos resultados sin depender de ese
  // detalle interno de MUI.
  assert.match(componente, /const imagen = new Image\(\);/);
  assert.match(componente, /imagen\.onload = terminarCarga;/);
  assert.match(componente, /imagen\.onerror = terminarCarga;/);
  assert.match(componente, /setImagenCargando\(false\);/);
  assert.doesNotMatch(componente, /<Avatar[\s\S]*?onLoad=/);
  assert.doesNotMatch(componente, /<Avatar[\s\S]*?onError=/);
});
