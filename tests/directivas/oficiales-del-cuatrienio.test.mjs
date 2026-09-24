// ----------------------------------------------------------------------
// LOS OFICIALES DE LA NACIONAL DE UN CUATRIENIO SALEN EN SU TARJETA DE GRUPO.
//
// Qué se rompía: en 2022-2026 once Oficiales de la Nacional estaban guardados
// como grupo, sin casilla, y el árbol no los mostraba en ninguna parte. La
// tarjeta "Oficiales Especiales" los reúne; esta regla decide quiénes son y
// con qué forma llegan (la de un ocupante, con la foto congelada).
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { oficialesDelCuatrienio } = await import('src/utils/directiva-cuatrienios.mjs');

const filas = [
  {
    grupo: 'oficiales',
    idMiembros: 48,
    nombres: 'Bernardo',
    apellidos: 'Lorenzo',
    fotoUrl: 'b.webp',
    cargoNombre: 'Oficial de la Nacional',
  },
  {
    grupo: 'directiva',
    idMiembros: 42,
    nombres: 'Bismal',
    apellidos: 'Canela',
    cargoNombre: 'Secretario Nacional',
  },
  { grupo: 'oficiales', idMiembros: 49, nombres: 'Eliezer', apellidos: 'García' },
  { grupo: 'ex_comandantes', idMiembros: 59, nombres: 'Amós', apellidos: 'Encarnación' },
  { grupo: 'oficiales', idMiembros: 57, nombres: 'Alba', apellidos: 'Marte' },
];

test('solo entran los del grupo de oficiales, ordenados por nombre', () => {
  assert.deepEqual(
    oficialesDelCuatrienio(filas).map((persona) => persona.name),
    ['Alba Marte', 'Bernardo Lorenzo', 'Eliezer García']
  );
});

test('llegan con la forma de un ocupante y la foto congelada', () => {
  const [, bernardo] = oficialesDelCuatrienio(filas);

  assert.equal(bernardo.id, '48');
  assert.equal(bernardo.avatarUrl, 'b.webp');
  assert.equal(bernardo.cargo, 'Oficial de la Nacional');
  assert.equal(bernardo.historico, true);
});

test('sin cargo guardado se nombran "Oficial de la Nacional"; sin filas, lista vacía', () => {
  assert.equal(oficialesDelCuatrienio(filas)[0].cargo, 'Oficial de la Nacional');
  assert.deepEqual(oficialesDelCuatrienio(undefined), []);
});
