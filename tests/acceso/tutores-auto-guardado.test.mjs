import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const codigo = fs.readFileSync(
  path.join(process.cwd(), 'src/sections/member/parents/member-edit-parents-form.jsx'),
  'utf8'
);

test('confirmar Quitar guarda inmediatamente la lista sin el tutor', () => {
  assert.match(codigo, /const confirmarBorrado = async/);
  assert.match(codigo, /filter\(\(_, indice\) => indice !== porBorrar\)/);
  assert.match(codigo, /await guardarCambios\(datosSinTutor\)/);
  assert.match(codigo, /onClick=\{confirmarBorrado\}/);
});

test('el dialogo permanece abierto si el guardado falla', () => {
  assert.match(codigo, /if \(guardado\) setPorBorrar\(null\)/);
  assert.match(codigo, /loading=\{guardandoBorrado\}/);
});
