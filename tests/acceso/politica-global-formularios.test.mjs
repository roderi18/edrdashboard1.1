import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (ruta) => fs.readFileSync(path.join(process.cwd(), ruta), 'utf8');

test('Form protege globalmente los cambios sin guardar', () => {
  const form = leer('src/components/hook-form/form-provider.jsx');
  const guardia = leer('src/components/hook-form/use-unsaved-changes-guard.js');

  assert.match(form, /protegerSalida = true/);
  assert.match(form, /useUnsavedChangesGuard\(methods, protegerSalida\)/);
  assert.match(guardia, /beforeunload/);
  assert.match(guardia, /navigation\?\.addEventListener\?\.\('navigate', alNavegar\)/);
  assert.match(guardia, /Tienes cambios sin guardar/);
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
