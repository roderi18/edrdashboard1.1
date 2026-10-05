// ----------------------------------------------------------------------
// TODO MIEMBRO TIENE CUENTA DE ACCESO.
//
// Qué se rompía: la cuenta solo nacía al dar de alta al miembro desde la ficha
// o la importación. EDR-10049 llegó al padrón por otro camino y, al pulsar
// "Restablecer contraseña", su coordinador recibía "Ese miembro todavía no
// tiene cuenta de acceso". Ahora, si falta, se crea en ese momento; con sus
// datos del padrón y solo si quien lo pide puede gestionar a ese miembro.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('restablecer contraseña y cambiar el correo crean la cuenta si falta', () => {
  for (const ruta of [
    'src/app/api/auth/codigo-restablecimiento/route.js',
    'src/app/api/auth/correo-cuenta-miembro/route.js',
  ]) {
    const codigo = leer(ruta);
    assert.match(
      codigo,
      /crearCuentaSiFalta\(\{ solicitante, idMiembros, codigoMiembro \}\)/,
      ruta
    );
    // Primero se intenta crear; el 404 queda solo si ni así hay cuenta.
    assert.ok(
      codigo.indexOf('crearCuentaSiFalta({') < codigo.indexOf('todavía no tiene cuenta'),
      ruta
    );
  }
});

test('la cuenta que falta se crea con permiso y con los datos del padrón', () => {
  const pieza = leer('src/server/cuenta-de-miembro.js');
  const cuerpo = pieza.slice(pieza.indexOf('export async function crearCuentaSiFalta'));

  // El permiso va antes que todo lo demás.
  assert.ok(cuerpo.indexOf('puedeGestionarAMiembro') < cuerpo.indexOf('crearCuentaDeMiembro('));
  // El destacamento (que fija el alcance) sale del padrón, no del navegador.
  assert.match(cuerpo, /buscarMiembroPorId\(idMiembros\)/);
  assert.match(cuerpo, /destId: miembro\.idDestacamento/);
});

test('el alta y la recuperación usan la misma pieza (contraseña aleatoria, sin devolverla)', () => {
  assert.match(leer('src/app/api/auth/crear-cuenta-miembro/route.js'), /crearCuentaDeMiembro\(/);
  const pieza = leer('src/server/cuenta-de-miembro.js');
  assert.match(pieza, /randomBytes\(32\)/);
  assert.doesNotMatch(pieza, /return \{[^}]*password/);
});
