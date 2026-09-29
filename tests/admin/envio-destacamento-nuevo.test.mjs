// Qué se rompía: los envíos "destacamento nuevo" se saltaban siempre al cargar,
// aunque el destacamento existiera ("leones de Sion 275" es el 275 del padrón).
// Crear uno nuevo solo se permite si ninguno coincide por número o nombre.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  puedeCrearseComoNuevo,
  coincideConNumeroEnviado,
  candidatosParaEnvioNuevo,
} from '../../src/utils/envio-destacamento-nuevo.mjs';

const padron = [
  { idDestacamento: 361, nombre: 'Desconocido', numero: '275' },
  { idDestacamento: 10, nombre: 'Águilas del Norte', numero: '12' },
  { idDestacamento: 1, nombre: 'Provisional', numero: '' },
];

test('un envío con el número de uno existente lo propone y no deja crear', () => {
  const fila = { nombreDestacamento: 'leones de Sion', numeroDestacamento: '275' };
  const c = candidatosParaEnvioNuevo(fila, padron);
  assert.equal(c[0].destacamento.idDestacamento, 361);
  assert.equal(c[0].motivo, 'numero');
  assert.equal(coincideConNumeroEnviado(fila, c[0].destacamento), true);
  assert.equal(puedeCrearseComoNuevo(fila, padron), false);
});

test('coincide también por nombre, sin tildes ni mayúsculas', () => {
  const fila = { nombreDestacamento: 'aguilas del norte', numeroDestacamento: '' };
  assert.equal(candidatosParaEnvioNuevo(fila, padron)[0].motivo, 'nombre');
  assert.equal(coincideConNumeroEnviado(fila, padron[1]), false);
});

test('para actualizar, el destacamento debe tener el mismo número enviado', () => {
  const fila = { nombreDestacamento: 'Águilas del Norte', numeroDestacamento: '275' };
  const candidatos = candidatosParaEnvioNuevo(fila, padron);
  assert.equal(candidatos.length, 2);
  assert.equal(coincideConNumeroEnviado(fila, padron[0]), true);
  assert.equal(coincideConNumeroEnviado(fila, padron[1]), false);
});

test('sin coincidencias sí se puede crear; "Desconocido" y Provisional no emparejan', () => {
  assert.equal(
    puedeCrearseComoNuevo({ nombreDestacamento: 'Impacto del Espíritu Santo' }, padron),
    true
  );
  assert.equal(puedeCrearseComoNuevo({ nombreDestacamento: 'Desconocido' }, padron), true);
  assert.equal(puedeCrearseComoNuevo({ nombreDestacamento: 'Provisional' }, padron), true);
});
