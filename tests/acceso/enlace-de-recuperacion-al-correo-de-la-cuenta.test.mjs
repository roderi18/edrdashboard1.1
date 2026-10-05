// ----------------------------------------------------------------------
// EL ENLACE DE "OLVIDÉ MI CONTRASEÑA" SALE AL CORREO DE LA CUENTA.
//
// Qué se rompía: EDR-10049 tenía la ficha del padrón sin correo y una cuenta de
// acceso con su correo propio. El servidor exigía que los dos coincidieran y le
// respondía "El correo de tu ficha no es el de tu cuenta de acceso, así que el
// enlace no te llegaría": no había forma de recuperar la clave por correo. La
// ficha no decide nada; el enlace va al correo de la cuenta, y solo si es un
// buzón de verdad (no el interno `<codigo>@exploradores.app`).
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { correoDelEnlace, SIN_CORREO_PROPIO } =
  await import('../../src/utils/enlace-de-recuperacion.mjs');

test('una cuenta con correo propio recibe el enlace aunque la ficha no tenga correo', () => {
  assert.deepEqual(correoDelEnlace('  Oficina@Ejemplo.org '), {
    puedeEnviar: true,
    correo: 'oficina@ejemplo.org',
  });
});

test('sin cuenta o con el correo interno no se manda nada', () => {
  for (const correo of [
    undefined,
    null,
    '',
    'edr-10049@exploradores.app',
    'EDR-1@Exploradores.App',
  ]) {
    assert.deepEqual(correoDelEnlace(correo), { puedeEnviar: false, error: SIN_CORREO_PROPIO });
  }
});

test('la ruta ya no compara el correo de la cuenta con el de la ficha', async () => {
  const ruta = await readFile(
    new URL('../../src/app/api/auth/recuperacion/route.js', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(ruta, /no es el de tu cuenta de acceso/);
  assert.match(ruta, /correoDelEnlace\(cuenta\?\.email\)/);
});
