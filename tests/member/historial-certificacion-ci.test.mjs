// ----------------------------------------------------------------------
// EL HISTORIAL NO APUNTA LA CERTIFICACIÓN CI SI NADIE LA TOCÓ.
//
// Qué se rompía: al guardar la ficha de un miembro (por ejemplo, solo el
// apellido), /history apuntaba también "Instructor certificado CI 0 → No" y
// "Estatus vigencia CI 0 → Sin dato". El padrón devuelve `0`/`1` y la ficha
// guarda booleanos, con el estatus en blanco si no es instructor; el "antes" y
// el "después" no hablaban el mismo idioma. Ahora los dos pasan por
// `certificacionCi` y un guardado sin tocar la certificación no la registra.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { certificacionCi } = await import('src/utils/certificacion-ci.mjs');

test('el 0 del padrón y lo que manda el guardado son lo mismo', () => {
  // Antes: lo que devuelve el padrón. Después: lo que manda el formulario sin
  // tocar nada (no instructor → estatus "no aplica").
  const antes = certificacionCi({ instructor: 0, estatus: 0 });
  const despues = certificacionCi({ instructor: 0, estatus: 'na' });

  assert.deepEqual(antes, { instructorCertificadoCi: false, estatusVigenciaCi: null });
  assert.deepEqual(despues, antes);
});

test('un instructor conserva su estatus, venga como número o como booleano', () => {
  assert.deepEqual(certificacionCi({ instructor: 1, estatus: 1 }), {
    instructorCertificadoCi: true,
    estatusVigenciaCi: true,
  });
  assert.deepEqual(
    certificacionCi({ instructor: true, estatus: false }),
    certificacionCi({ instructor: 1, estatus: 0 })
  );
});

test('un cambio de verdad sigue viéndose', () => {
  assert.notDeepEqual(
    certificacionCi({ instructor: 0, estatus: 0 }),
    certificacionCi({ instructor: 1, estatus: 1 })
  );
});

test('un menor nunca es instructor y sin dato no se inventa un valor', () => {
  assert.deepEqual(certificacionCi({ instructor: 1, estatus: 1, esMenor: true }), {
    instructorCertificadoCi: false,
    estatusVigenciaCi: null,
  });
  assert.deepEqual(certificacionCi({}), {
    instructorCertificadoCi: null,
    estatusVigenciaCi: null,
  });
});
