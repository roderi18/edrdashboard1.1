import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const asistencia = fs.readFileSync(
  path.join(process.cwd(), 'src/sections/attendance/view/attendance-quick-view.jsx'),
  'utf8'
);

// PASAR LISTA NO SACA DE LA PANTALLA.
//
// Hasta el 20/09/2026 la foto y el nombre de cada fila llevaban a la ficha del
// miembro. Se quitaron a propósito en el commit a78da36c (se borró el enlace y
// se renombró el componente). Estos tests vigilan que no vuelvan sin querer; a
// la ficha se llega desde Miembros. Si se decide recuperarlos, se cambia aquí.
test('en asistencia la foto y el nombre no son enlaces a la ficha', () => {
  assert.doesNotMatch(asistencia, /function AttendanceMemberProfileLink/);
  assert.doesNotMatch(asistencia, /paths\.dashboard\.level\.member\.edit\(/);
  assert.match(asistencia, /function AttendanceMemberName\(\{ name, sx \}\)/);
});

test('en el movil los recuadros del resumen ponen la palabra al lado del numero', () => {
  assert.match(asistencia, /direction=\{\{ xs: 'row', sm: 'column' \}\}/);
  // El texto largo no cabe al lado del numero: se queda en "Comparación" y sale
  // entero al señalarlo o pulsarlo.
  assert.match(asistencia, /const textoComparacion =/);
  assert.match(asistencia, /<Tooltip title=\{textoComparacion\} enterTouchDelay=\{0\}/);
  assert.match(asistencia, /Comparación/);
});

test('el nombre sale igual en la lista y en el resumen del dia, sin enlace', () => {
  const nombres = asistencia.match(/<AttendanceMemberName /g) || [];

  assert.equal(nombres.length, 2);
  assert.doesNotMatch(asistencia, /<AttendanceMemberProfileLink|<AttendanceMemberNameLink/);
});
