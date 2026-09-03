import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const leer = (ruta) =>
  fs.readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('el teléfono de Padres bloquea el selector de país en modo de solo lectura', () => {
  const formulario = leer('src/sections/member/parents/member-edit-parents-form.jsx');
  const telefono = leer('src/components/phone-input/phone-input.jsx');

  assert.match(formulario, /disableCountrySelect=\{readOnly\}/);
  assert.match(telefono, /const isCountrySelectDisabled = isCountryLocked \|\| disableCountrySelect/);
  assert.match(telefono, /disabled=\{isCountrySelectDisabled\}/);
});
