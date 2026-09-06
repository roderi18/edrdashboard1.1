import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const asistencia = fs.readFileSync(
  path.join(process.cwd(), 'src/sections/attendance/view/attendance-quick-view.jsx'),
  'utf8'
);

test('desde asistencia se llega a la ficha del miembro, y sin subrayado', () => {
  assert.match(asistencia, /function AttendanceMemberProfileLink/);
  assert.match(asistencia, /component=\{RouterLink\}/);
  assert.match(asistencia, /href=\{paths\.dashboard\.level\.member\.edit\(memberId\)\}/);
  assert.match(asistencia, /underline="none"/);
  assert.doesNotMatch(asistencia, /underline="always"/);
});

test('sin id no se envuelve en un enlace', () => {
  assert.match(asistencia, /if \(!memberId\) \{\s*\n\s*return children;/);
});

test('la foto y el nombre enlazan, en la lista y en el resumen del dia', () => {
  const enlacesAlPerfil = asistencia.match(/<AttendanceMemberProfileLink/g) || [];
  const enlacesDeNombre = asistencia.match(/<AttendanceMemberNameLink/g) || [];

  // Dos fotos (lista y resumen) mas los dos nombres, que reusan el mismo enlace.
  assert.equal(enlacesAlPerfil.length, 3);
  assert.equal(enlacesDeNombre.length, 2);

  assert.match(asistencia, /memberId=\{miembro\.id\}[\s\S]{0,400}?<Avatar/);
  assert.match(asistencia, /memberId=\{memberId\}[\s\S]{0,400}?<Avatar/);
});
