// ----------------------------------------------------------------------
// A QUIÉN LLEGA CADA CAMBIO DE ESTATUS, Y QUIÉN PUEDE PONER "FALLECIDO".
//
// El estatus cambiaba sin avisar a nadie: solo lo veía quien abriera la ficha.
// Un miembro que deja de venir es asunto de su destacamento; uno que se va o
// fallece, de toda la organización. Y "Fallecido" no lo puede poner cualquiera:
// avisa a media organización y la asistencia no lo revierte.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { ROLES } = await import('src/auth/permissions/roles');
const { ESTATUS_MIEMBRO } = await import('src/utils/estatus-miembro.mjs');
const {
  seAvisaElEstatus,
  resumirCambios,
  puedeMarcarFallecido,
  llegaALaOficinaNacional,
  CARGOS_DE_DESTACAMENTO,
  cargosDeDestacamentoQueSeAvisan,
} = await import('src/utils/estatus-miembro-avisos.mjs');

test('volver a activo no molesta a nadie; los otros tres sí se avisan', () => {
  assert.equal(seAvisaElEstatus(ESTATUS_MIEMBRO.ACTIVO), false);
  assert.equal(seAvisaElEstatus(ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO), true);
  assert.equal(seAvisaElEstatus(ESTATUS_MIEMBRO.INACTIVO), true);
  assert.equal(seAvisaElEstatus(ESTATUS_MIEMBRO.FALLECIDO), true);
});

test('el reclutamiento se queda en el destacamento, sin el Pastor', () => {
  const cargos = cargosDeDestacamentoQueSeAvisan(ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);

  assert.equal(cargos.length, CARGOS_DE_DESTACAMENTO.length - 1);
  assert.ok(!cargos.includes(ROLES.PASTOR_DESTACAMENTO));
  assert.ok(cargos.includes(ROLES.USUARIO_DESTACAMENTO));
  assert.ok(cargos.includes(ROLES.LIDER_GRUPO));
  assert.equal(llegaALaOficinaNacional(ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO), false);
});

test('inactivo y fallecido llegan al Pastor y a la nación', () => {
  [ESTATUS_MIEMBRO.INACTIVO, ESTATUS_MIEMBRO.FALLECIDO].forEach((estatus) => {
    assert.deepEqual(cargosDeDestacamentoQueSeAvisan(estatus), CARGOS_DE_DESTACAMENTO);
    assert.equal(llegaALaOficinaNacional(estatus), true, estatus);
  });
});

test('solo el Coordinador de Destacamento, su Asistente y el Administrador Global marcan "Fallecido"', () => {
  assert.equal(puedeMarcarFallecido([ROLES.USUARIO_DESTACAMENTO]), true);
  assert.equal(puedeMarcarFallecido([ROLES.USUARIO_DESTACAMENTO_ASISTENTE]), true);
  assert.equal(puedeMarcarFallecido([ROLES.ADMINISTRADOR_GLOBAL]), true);
  // Cargos del destacamento que NO son el coordinador ni su asistente.
  assert.equal(puedeMarcarFallecido([ROLES.LIDER_GRUPO]), false);
  assert.equal(puedeMarcarFallecido([ROLES.PASTOR_DESTACAMENTO]), false);
  assert.equal(puedeMarcarFallecido([ROLES.CONSEJO_DESTACAMENTO]), false);
  assert.equal(puedeMarcarFallecido([ROLES.OFICINA_NACIONAL]), false);
  assert.equal(puedeMarcarFallecido([]), false);
  // Con dos cargos basta que uno lo permita.
  assert.equal(puedeMarcarFallecido([ROLES.LIDER_GRUPO, ROLES.USUARIO_DESTACAMENTO]), true);
});

test('un solo aviso para todos los que cambiaron el mismo día', () => {
  assert.equal(resumirCambios([{ nombreMiembro: 'Juan Pérez' }]), 'Juan Pérez');
  assert.equal(
    resumirCambios([{ nombreMiembro: 'Juan Pérez' }, { nombreMiembro: 'Ana Gómez' }]),
    '2 miembros: Juan Pérez, Ana Gómez'
  );
  assert.equal(resumirCambios([]), '');
});
