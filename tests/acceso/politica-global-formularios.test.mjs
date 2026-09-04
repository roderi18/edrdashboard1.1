import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (ruta) => fs.readFileSync(path.join(process.cwd(), ruta), 'utf8');

// EL AVISO DE CAMBIOS SIN GUARDAR SE RETIRO: salir de un formulario ya no
// pregunta nada. Lo que se comprueba ahora es justo lo contrario que antes —que
// no queda ni el mensaje ni el `beforeunload` que lo disparaba—, y que el
// cableado sigue en su sitio por si algun dia se quiere volver a poner.
test('salir de un formulario no pregunta por los cambios sin guardar', () => {
  const form = leer('src/components/hook-form/form-provider.jsx');
  const guardia = leer('src/components/hook-form/use-unsaved-changes-guard.js');

  assert.match(form, /useUnsavedChangesGuard\(methods, protegerSalida\)/);
  assert.doesNotMatch(guardia, /Tienes cambios sin guardar/);
  assert.doesNotMatch(guardia, /beforeunload/);
  assert.doesNotMatch(guardia, /addEventListener/);
});

test('las confirmaciones bloquean dobles ejecuciones mientras guardan', () => {
  const dialogo = leer('src/components/custom-dialog/confirm-dialog.jsx');

  assert.match(dialogo, /const \[processing, setProcessing\]/);
  assert.match(dialogo, /await action\.props\.onClick/);
  assert.match(dialogo, /disabled=\{processing\}/);
});

test('calendario y publicaciones conservan borradores recuperables', () => {
  const calendario = leer('src/sections/calendar/calendar-form.jsx');
  const publicaciones = leer('src/sections/blog/post-create-edit-form.jsx');

  assert.match(calendario, /borrador=\{`calendario:/);
  assert.match(publicaciones, /borrador=\{`publicacion:/);
});
