import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const ruta = new URL('../../src/sections/member/history/member-history-log.jsx', import.meta.url);
const codigo = fs.readFileSync(ruta, 'utf8');

test('Módulo deja de ser una columna y aparece debajo de Qué se afectó', () => {
  const encabezados = codigo.slice(codigo.indexOf('const TABLE_HEAD'), codigo.indexOf('];') + 2);

  assert.doesNotMatch(encabezados, /id: 'modulo'/);
  assert.match(encabezados, /id: 'afectado', label: 'Qué se afectó'/);
  assert.match(codigo, /<Typography variant="body2">\{row\.afectado\}<\/Typography>/);
  assert.match(codigo, /color: 'text\.disabled'/);
  assert.match(codigo, /\{row\.modulo \|\| 'Historial'\}/);
});

test('la fila vacía ocupa las cinco columnas restantes', () => {
  assert.match(codigo, /<TableCell colSpan=\{5\}/);
});
