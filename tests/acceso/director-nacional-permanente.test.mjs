// ----------------------------------------------------------------------
// QUIEN ES O FUE DIRECTOR NACIONAL CONSERVA SUS PERMISOS.
//
// La Directiva por cuatrienio es memoria y no da permisos: cada persona entra con
// los cargos que tiene HOY. La única excepción la pidió la organización: quien
// es o fue Director Nacional —o Comandante Nacional, su nombre antiguo— sigue
// teniendo todos los permisos de Director Nacional aunque ya no ocupe la casilla.
//
// Qué se rompería sin esto: al terminar su cuatrienio, el Director Nacional
// saliente volvía a ser un miembro sin cargo; y un ex comandante que figuraba en
// el Consejo Ejecutivo no podía ver lo que ve el Consejo Ejecutivo.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { permanenciaDe, conCargosPermanentes, posicionDelCargo } =
  await import('../../src/utils/directiva-cuatrienios.mjs');
const { resolverRolesPorAsignaciones } = await import('../../src/catalogs/directiva-roles.js');

const HOY = '2026-09-18';
const director = (cuatrienio) => ({
  cuatrienio,
  nivel: 'nacional',
  grupo: 'directiva',
  cargo: 'director',
});

const rolesDe = (asignaciones) => resolverRolesPorAsignaciones(asignaciones).map((c) => c.rol);

test('el Director Nacional de un cuatrienio cerrado es ex comandante y conserva los permisos', () => {
  const permanencia = permanenciaDe([director('2022-2026')], HOY);

  assert.deepEqual(permanencia, {
    directorNacional: true,
    exComandante: true,
    permisosDirectorNacional: true,
  });
});

test('el Director Nacional del cuatrienio vigente todavía no es ex comandante', () => {
  const permanencia = permanenciaDe([director('2026-2030')], HOY);

  assert.equal(permanencia.exComandante, false);
  assert.equal(permanencia.permisosDirectorNacional, true);
});

test('los ex comandantes del listado conservan los permisos de Director Nacional', () => {
  const permanencia = permanenciaDe(
    [
      {
        cuatrienio: '2022-2026',
        nivel: 'nacional',
        grupo: 'ex_comandantes',
        cargo: 'ex_comandante',
      },
    ],
    HOY
  );

  assert.equal(permanencia.exComandante, true);
  assert.equal(permanencia.permisosDirectorNacional, true);
});

test('ningún otro cargo de la historia da permisos', () => {
  const historia = [
    { cuatrienio: '2022-2026', nivel: 'regional', grupo: 'directiva', cargo: 'director' },
    { cuatrienio: '2022-2026', nivel: 'nacional', grupo: 'directiva', cargo: 'subdirector' },
    { cuatrienio: '2022-2026', nivel: 'nacional', grupo: 'oficiales', cargo: 'oficial' },
  ];

  assert.equal(permanenciaDe(historia, HOY).permisosDirectorNacional, false);
  assert.deepEqual(conCargosPermanentes([], permanenciaDe(historia, HOY)), []);
});

test('el servidor le suma la casilla de Director Nacional a sus cargos de hoy', () => {
  const deHoy = [
    {
      nivel: 'destacamento',
      idEntidad: '52',
      idPosicionDirectiva: 'destacamento-coordinador-destacamento',
      activo: true,
    },
  ];
  const asignaciones = conCargosPermanentes(deHoy, { permisosDirectorNacional: true });
  const roles = rolesDe(asignaciones);

  assert.ok(roles.includes('director_nacional'));
  // Lo de hoy sigue ahí: la historia suma, no quita.
  assert.ok(roles.includes('usuario_destacamento'));
  // Manda la nacional, como con cualquier Director Nacional.
  assert.equal(roles[0], 'director_nacional');
});

test('a quien ya es Director Nacional hoy no se le duplica la casilla', () => {
  const idDirector = posicionDelCargo('nacional', 'director');
  const deHoy = [{ nivel: 'nacional', idEntidad: 'nacional', idPosicionDirectiva: idDirector }];

  assert.equal(conCargosPermanentes(deHoy, { permisosDirectorNacional: true }).length, 1);
});
