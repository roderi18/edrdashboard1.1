import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL NOMBRE ES EL DE SU FICHA, NO UNA COPIA VIEJA.
//
// `displayName` es una foto del nombre tomada el dia que se creo la cuenta. Como
// mandaba sobre todo lo demas, una errata de aquel dia se quedaba para siempre:
// corregir la ficha no cambiaba el nombre con el que la persona firma sus
// notificaciones y sus registros.

const { buildAdminDisplayName } = await import('../../src/utils/admin-profile.js');

test('manda el nombre de la ficha, no el guardado el dia del alta', () => {
  const nombre = buildAdminDisplayName(
    { nombres: 'Roderi', apellidos: 'Peña', displayName: 'Rodery Peña' },
    { displayName: 'Rodery Peña', email: 'roderi@ejemplo.com' }
  );

  assert.equal(nombre, 'Roderi Peña');
});

test('sin ficha detras se conserva el nombre guardado', () => {
  assert.equal(
    buildAdminDisplayName({ displayName: 'Soporte ERRD' }, { email: 'soporte@ejemplo.com' }),
    'Soporte ERRD'
  );

  assert.equal(
    buildAdminDisplayName({}, { displayName: 'Cuenta de Firebase', email: 'x@ejemplo.com' }),
    'Cuenta de Firebase'
  );

  assert.equal(buildAdminDisplayName({}, { email: 'x@ejemplo.com' }), 'x@ejemplo.com');
});

test('un apellido que faltaba entra en cuanto se corrige la ficha', () => {
  assert.equal(
    buildAdminDisplayName({ nombres: 'Ana', apellidos: '', displayName: 'Ana' }, {}),
    'Ana'
  );

  assert.equal(
    buildAdminDisplayName({ nombres: 'Ana', apellidos: 'Martínez', displayName: 'Ana' }, {}),
    'Ana Martínez'
  );
});
