import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { requiereRevisionDeAdministradorGlobal, puedeAplicarDirectamenteCambioDeOrganizacion } =
  await import('../../src/utils/org-level-access.js');

const oficinaCon = (rolLocal) => ({
  uid: `oficina-${rolLocal}`,
  rolId: 'oficina_nacional',
  cargos: [
    { rol: 'oficina_nacional', nivel: 'nacional' },
    { rol: rolLocal, nivel: 'destacamento', idEntidad: '231' },
  ],
  alcance: { destacamentos: ['231'] },
});

for (const rolLocal of ['usuario_destacamento', 'usuario_destacamento_asistente']) {
  test(`${rolLocal} + Oficina Nacional escala el cambio del destacamento al Administrador Global`, () => {
    const usuario = oficinaCon(rolLocal);

    assert.equal(requiereRevisionDeAdministradorGlobal(usuario, 'destacamento'), true);
    assert.equal(puedeAplicarDirectamenteCambioDeOrganizacion(usuario, 'destacamento'), false);
  });

  test(`${rolLocal} + Oficina Nacional tambien escala la foto del destacamento`, () => {
    const usuario = oficinaCon(rolLocal);

    assert.equal(requiereRevisionDeAdministradorGlobal(usuario, 'foto_destacamento'), true);
    assert.equal(puedeAplicarDirectamenteCambioDeOrganizacion(usuario, 'foto_destacamento'), false);
  });
}

test('Oficina Nacional sin cargo local conserva su facultad de aplicar', () => {
  const usuario = { uid: 'oficina', rolId: 'oficina_nacional', cargos: [] };

  assert.equal(requiereRevisionDeAdministradorGlobal(usuario, 'destacamento'), false);
  assert.equal(puedeAplicarDirectamenteCambioDeOrganizacion(usuario, 'destacamento'), true);
});

test('la escalacion local no cambia los otros ambitos de Oficina Nacional', () => {
  const usuario = oficinaCon('usuario_destacamento');

  assert.equal(requiereRevisionDeAdministradorGlobal(usuario, 'seccion'), false);
  assert.equal(puedeAplicarDirectamenteCambioDeOrganizacion(usuario, 'seccion'), true);
});
