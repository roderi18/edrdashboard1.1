import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// LA CERTIFICACION CI NO SE LLEVA DESDE LA CUENTA PROPIA.
//
// Los cuatro campos —instructor certificado, vigencia y las dos fechas— son de
// la ficha del miembro. En /user/account salian medio en gris, sin poder
// tocarse, ocupando media rejilla.

const cuenta = fs.readFileSync(
  path.join(process.cwd(), 'src/sections/user-account/user-account-general.jsx'),
  'utf8'
);

test('los cuatro campos de CI no se pintan en la cuenta propia', () => {
  ['instructorCertificadoCi', 'estatusVigenciaCi', 'fechaInicioCertificado', 'fechaFinCertificado']
    .forEach((campo) => {
      assert.doesNotMatch(cuenta, new RegExp(`name="${campo}"`), `${campo} sigue pintandose`);
    });
});

test('lo guardado es lo que ya tenia la ficha, no lo del formulario', () => {
  assert.match(cuenta, /instructorCertificadoCi: member\.instructorCertificadoCi \?\? false,/);
  assert.match(cuenta, /estatusVigenciaCi: member\.estatusVigenciaCi \?\? null,/);
  assert.match(cuenta, /fechaInicioCertificado: member\.fechaInicioCertificado \?\? null,/);
  assert.match(cuenta, /fechaFinCertificado: member\.fechaFinCertificado \?\? null,/);
  // Ya no queda ninguna rama que lea el dato del formulario.
  assert.doesNotMatch(cuenta, /data\.instructorCertificadoCi/);
  assert.doesNotMatch(cuenta, /data\.fechaFinCertificado/);
});
