// ----------------------------------------------------------------------
// REESCRIBIR LOS CLAIMS POR EL CARGO NO QUITA "DEBE CAMBIAR SU CONTRASEÑA".
//
// Qué se rompía: EDR-10049 (Coordinador de Destacamento) entró con el código de
// un solo uso y la sincronización del cargo reescribió sus claims con rol,
// alcance e id, sin `debeCambiarClave`. La pantalla de "Crea tu contraseña",
// que miraba solo el token, le dejó pasar al panel sin elegir ninguna.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { claimsConservandoClave } from '../../src/server/claims-con-marca-de-clave-core.mjs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('con la marca puesta, los claims del cargo la conservan', () => {
  assert.deepEqual(
    claimsConservandoClave(
      { debeCambiarClave: true, rol: 'miembro' },
      { rol: 'usuario_destacamento', idMiembros: 383 }
    ),
    { rol: 'usuario_destacamento', idMiembros: 383, debeCambiarClave: true }
  );
});

test('sin marca, no se inventa ninguna', () => {
  assert.deepEqual(claimsConservandoClave({ rol: 'x' }, { rol: 'y' }), { rol: 'y' });
  assert.deepEqual(claimsConservandoClave(undefined, { rol: 'y' }), { rol: 'y' });
});

test('quien reescribe claims por el cargo pasa por la pieza que conserva la marca', () => {
  for (const ruta of [
    'src/server/rol-por-cargo.js',
    'src/app/api/admin/set-user-claims/route.js',
    'src/app/api/admin/asignar-rol-administracion/route.js',
  ]) {
    const codigo = leer(ruta);
    assert.match(codigo, /fijarClaimsConservandoClave\(/, ruta);
    assert.doesNotMatch(codigo, /auth\s*\.setCustomUserClaims\(/, ruta);
  }
});

test('la pantalla de primer acceso atiende a la marca del token O del perfil', () => {
  const vista = leer('src/auth/view/firebase/firebase-primer-acceso-view.jsx');
  assert.match(vista, /marcaDelToken === true \|\| user\?\.debeCambiarClave === true/);
});
