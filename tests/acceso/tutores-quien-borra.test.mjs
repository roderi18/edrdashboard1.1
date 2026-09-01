import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { canEditMemberTutors, canDeleteMemberTutors } = await import(
  '../../src/utils/member-access.js'
);

// ----------------------------------------------------------------------
// Quien puede BORRAR un tutor, y quien solo apuntarlo.
//
// Apuntar a un tutor o corregirle el telefono es trabajo de campo: lo hace quien
// esta con la gente. Equivocarse ahi se arregla escribiendo encima.
//
// Borrarlo no. Un telefono que desaparece no deja rastro de que existio, y el
// dia que haya que llamar no habra a quien. Por eso el borrado queda en el
// Coordinador de Destacamento y su Asistente.
// ----------------------------------------------------------------------

const cargo = (rol) => ({
  rol,
  cargos: [{ rol, nivel: 'destacamento', idEntidad: '231', orden: 1 }],
  permisos: { padres: { ver: true, editar: true } },
});

test('el Administrador Global agrega, corrige y borra tutores', () => {
  const usuario = {
    role: 'admin',
    rolId: 'administrador_global',
    alcance: { tipo: 'global', modo: 'global' },
  };

  assert.equal(canEditMemberTutors(usuario), true);
  assert.equal(canDeleteMemberTutors(usuario), true);
});

test('el Coordinador de Destacamento borra', () => {
  const usuario = cargo('usuario_destacamento');

  assert.equal(canEditMemberTutors(usuario), true);
  assert.equal(canDeleteMemberTutors(usuario), true);
});

test('y su Asistente tambien: comparten la ficha', () => {
  const usuario = cargo('usuario_destacamento_asistente');

  assert.equal(canEditMemberTutors(usuario), true);
  assert.equal(canDeleteMemberTutors(usuario), true);
});

// Estos cinco SI apuntan y corrigen: son los que estan con la gente.
for (const rol of [
  'pastor_destacamento',
  'consejo_destacamento',
  'capellan_destacamento',
  'lider_grupo',
  'lider_asistente_grupo',
]) {
  test(`${rol} agrega y corrige, pero NO borra`, () => {
    const usuario = cargo(rol);

    assert.equal(canDeleteMemberTutors(usuario), false, `${rol} no deberia poder borrar`);
  });
}

// Sin cargo de destacamento no se toca, aunque el permiso venga en el token: los
// tutores los lleva quien acompaña a esa persona.
test('un cargo de seccion no agrega ni borra', () => {
  const usuario = {
    rol: 'usuario_seccion',
    cargos: [{ rol: 'usuario_seccion', nivel: 'seccion', idEntidad: '1', orden: 1 }],
    permisos: { padres: { ver: true, editar: true } },
  };

  assert.equal(canEditMemberTutors(usuario), false);
  assert.equal(canDeleteMemberTutors(usuario), false);
});

// El permiso manda por encima del cargo: si en "Administrar permisos" le quitan
// `padres.editar` al Coordinador, deja de tocar los tutores aunque siga siendo
// Coordinador.
test('sin el permiso de padres no se toca nada, se tenga el cargo que se tenga', () => {
  const usuario = {
    ...cargo('usuario_destacamento'),
    permisosExcluidos: ['padres.editar'],
  };

  assert.equal(canEditMemberTutors(usuario), false);
  assert.equal(canDeleteMemberTutors(usuario), false);
});
