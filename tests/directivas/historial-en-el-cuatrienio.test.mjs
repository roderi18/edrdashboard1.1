// ----------------------------------------------------------------------
// EL HISTORIAL DENTRO DE UN CUATRIENIO (Consejo Nacional).
//
// Qué se rompía: la pestaña "Historia" del Consejo Nacional mezclaba a quien
// ocupa el cargo hoy con quienes salieron, de todos los tiempos, y salía
// también al mirar una directiva pasada. Ahora la directiva actual enseña en
// "Historia" solo a quienes salieron en el cuatrienio vigente, y una directiva
// pasada suma esas salidas a su propia lista: la misma posición puede salir
// varias veces, con "desde – hasta" solo cuando la ocupó más de una persona,
// y primero la más reciente.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { salidasDelCuatrienio, claveDePosicion, apuntesDelCuatrienio } =
  await import('../../src/utils/directiva-historial.mjs');

const CUATRIENIO = { id: '2026-2030', inicio: '2026-08-22', fin: '2030-08-22' };
const POSICION = 'seccional-coordinador-adiestramiento';

// Juan Pérez dejó Coordinador de Adiestramiento de la Sección Oriental I;
// María Gómez lo ocupó hasta el final del cuatrienio.
const salidaDeJuan = {
  id: 'a__2028-03-15',
  nivel: 'seccional',
  idEntidad: '7',
  idPosicionDirectiva: POSICION,
  idMiembro: '100',
  nombreMiembro: 'Juan Pérez',
  fechaInicio: '2026-08-22',
  fechaFin: '2028-03-15',
};

const mariaEnLaMemoria = {
  id: 'm1',
  nivel: 'seccional',
  seccionId: '7',
  idPosicionDirectiva: POSICION,
  idMiembros: '200',
  nombres: 'María',
  apellidos: 'Gómez',
};

const director = {
  id: 'm2',
  nivel: 'nacional',
  idPosicionDirectiva: 'nacional-director',
  idMiembros: '300',
};

test('solo cuentan las salidas que tocan el cuatrienio', () => {
  const antes = { ...salidaDeJuan, id: 'x', fechaInicio: '2023-01-01', fechaFin: '2025-01-01' };
  const despues = { ...salidaDeJuan, id: 'y', fechaInicio: '2031-01-01', fechaFin: '2032-01-01' };
  const cruzaElInicio = {
    ...salidaDeJuan,
    id: 'z',
    fechaInicio: '2025-01-01',
    fechaFin: '2027-01-01',
  };

  const ids = salidasDelCuatrienio([antes, despues, cruzaElInicio, salidaDeJuan], CUATRIENIO).map(
    (fila) => fila.id
  );

  assert.deepEqual(ids, ['z', 'a__2028-03-15']);
});

test('el Consejo Ejecutivo es una sola casilla, diga "nacional" o nada su entidad', () => {
  assert.equal(
    claveDePosicion({ nivel: 'nacional', idEntidad: 'nacional', idPosicionDirectiva: 'p' }),
    claveDePosicion({ nivel: 'nacional', idEntidad: '', idPosicionDirectiva: 'p' })
  );
});

test('una posición con dos personas sale dos veces, cada una con su desde – hasta', () => {
  const apuntes = apuntesDelCuatrienio({
    integrantes: [mariaEnLaMemoria, director],
    historial: [salidaDeJuan],
    cuatrienio: CUATRIENIO,
  });

  const maria = apuntes.find((apunte) => apunte.idMiembro === '200');
  const juan = apuntes.find((apunte) => apunte.idMiembro === '100');

  assert.equal(juan.tipo, 'salida');
  assert.deepEqual(juan.periodo, { desde: '2026-08-22', hasta: '2028-03-15' });
  // María llegó cuando se fue Juan y se quedó hasta el final del cuatrienio.
  assert.deepEqual(maria.periodo, { desde: '2028-03-15', hasta: '2030-08-22' });
  // Primero la más reciente.
  assert.ok(maria.ordenPeriodo > juan.ordenPeriodo);
});

test('una posición con una sola persona no lleva fechas', () => {
  const apuntes = apuntesDelCuatrienio({
    integrantes: [mariaEnLaMemoria, director],
    historial: [salidaDeJuan],
    cuatrienio: CUATRIENIO,
  });

  assert.equal(apuntes.find((apunte) => apunte.idMiembro === '300').periodo, null);
});

test('quien ya está en la memoria no se duplica: toma las fechas de su salida', () => {
  const juanEnLaMemoria = { ...mariaEnLaMemoria, id: 'm3', idMiembros: '100' };

  const apuntes = apuntesDelCuatrienio({
    integrantes: [juanEnLaMemoria, mariaEnLaMemoria],
    historial: [salidaDeJuan],
    cuatrienio: CUATRIENIO,
  });

  assert.equal(apuntes.length, 2);
  assert.deepEqual(apuntes.find((apunte) => apunte.idMiembro === '100').periodo, {
    desde: '2026-08-22',
    hasta: '2028-03-15',
  });
});

test('los integrantes sin casilla (oficiales, provisionales) nunca se cuentan como repetidos', () => {
  const oficial = { id: 'o1', nivel: 'nacional', grupo: 'oficiales', cargo: 'oficial' };

  const apuntes = apuntesDelCuatrienio({
    integrantes: [oficial, { ...oficial, id: 'o2' }],
    cuatrienio: CUATRIENIO,
  });

  assert.ok(apuntes.every((apunte) => apunte.periodo === null));
});
