// ----------------------------------------------------------------------
// UN SOLO DISEÑO DE ORGANIGRAMA PARA TODOS LOS CUATRIENIOS.
//
// Qué se rompía: el diseño de cada cuatrienio se guardaba aparte y los árboles
// se separaban; lo colocado en la directiva pasada no se veía en la actual. Es
// el mismo organigrama con otras personas: cualquier cambio de diseño, se haga
// desde la directiva de hoy o desde una anterior, va a la misma entidad y se ve
// en todas.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { entidadesDeDisenoDe } = await import('src/utils/directiva-cuatrienios.mjs');

test('la directiva de hoy guarda y lee su diseño en su entidad de siempre', () => {
  assert.deepEqual(entidadesDeDisenoDe({ idEntidad: '12' }), {
    idEntidad: '12',
    idEntidadRespaldo: '',
  });
});

test('una directiva anterior usa la MISMA entidad de diseño que la de hoy', () => {
  assert.deepEqual(
    entidadesDeDisenoDe({ idEntidad: '12', historico: { cuatrienio: '2022-2026' } }),
    entidadesDeDisenoDe({ idEntidad: '12' })
  );
  assert.deepEqual(
    entidadesDeDisenoDe({ idEntidad: '', historico: { cuatrienio: '2022-2026' } }),
    entidadesDeDisenoDe({ idEntidad: '' })
  );
});

test('dos cuatrienios de la misma entidad comparten diseño', () => {
  const a = entidadesDeDisenoDe({ idEntidad: '7', historico: { cuatrienio: '2022-2026' } });
  const b = entidadesDeDisenoDe({ idEntidad: '7', historico: { cuatrienio: '2026-2030' } });

  assert.equal(a.idEntidad, b.idEntidad);
});
