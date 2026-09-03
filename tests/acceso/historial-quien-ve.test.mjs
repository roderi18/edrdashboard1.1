import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { canViewMemberHistoryTab } = await import('../../src/utils/member-access.js');

const usuarioDeDestacamento = (rol, idDestacamento = '231') => ({
  rol,
  cargos: [{ rol, nivel: 'destacamento', idEntidad: idDestacamento, orden: 1 }],
  alcance: { tipo: 'destacamento', destacamentos: [idDestacamento] },
});

test('el Pastor puede leer el historial de miembros de su destacamento', () => {
  const pastor = usuarioDeDestacamento('pastor_destacamento');

  assert.equal(canViewMemberHistoryTab(pastor, { idDestacamento: '231' }), true);
});

test('el Pastor no puede leer el historial de otro destacamento', () => {
  const pastor = usuarioDeDestacamento('pastor_destacamento');

  assert.equal(canViewMemberHistoryTab(pastor, { idDestacamento: '999' }), false);
});

test('agregar al Pastor no abre el historial al resto de cargos de destacamento', () => {
  for (const rol of [
    'consejo_destacamento',
    'capellan_destacamento',
    'lider_asistente_grupo',
  ]) {
    assert.equal(
      canViewMemberHistoryTab(usuarioDeDestacamento(rol), { idDestacamento: '231' }),
      false,
      `${rol} no debe ver el historial`
    );
  }
});
