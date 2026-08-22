import test from 'node:test';
import assert from 'node:assert/strict';

import {
  nombreDeMiembro,
  buscarMiembroConCorreo,
} from '../../src/utils/member-correo-duplicado.js';

// La lista de miembros llega de dos sitios: la de la interfaz trae `email` y la
// del API trae `correo`. Las dos tienen que valer.
const MIEMBROS = [
  { id: 326, firstName: 'Roderi', lastName: 'Peña', email: 'roderi@gmail.com' },
  { idMiembros: 340, nombres: 'Daniel', apellidos: 'Peña', correo: 'Daniel@Gmail.com' },
  { id: 999, firstName: 'Sin', lastName: 'Correo', email: '' },
];

test('encuentra al miembro que ya tiene ese correo', () => {
  assert.equal(buscarMiembroConCorreo(MIEMBROS, 'roderi@gmail.com')?.id, 326);
});

test('no distingue mayusculas ni espacios sobrantes', () => {
  assert.equal(buscarMiembroConCorreo(MIEMBROS, '  DANIEL@gmail.com ')?.idMiembros, 340);
});

test('no se cuenta a si mismo', () => {
  assert.equal(buscarMiembroConCorreo(MIEMBROS, 'roderi@gmail.com', 326), null);
  assert.equal(buscarMiembroConCorreo(MIEMBROS, 'roderi@gmail.com', '326'), null);
  assert.equal(buscarMiembroConCorreo(MIEMBROS, 'Daniel@gmail.com', 340), null);
});

test('un correo vacio nunca choca con nadie', () => {
  assert.equal(buscarMiembroConCorreo(MIEMBROS, ''), null);
  assert.equal(buscarMiembroConCorreo(MIEMBROS, '   '), null);
  assert.equal(buscarMiembroConCorreo(MIEMBROS, null), null);
});

test('aguanta una lista que no llego', () => {
  assert.equal(buscarMiembroConCorreo(null, 'roderi@gmail.com'), null);
  assert.equal(buscarMiembroConCorreo(undefined, 'roderi@gmail.com'), null);
});

test('nombra al duplicado con lo que tenga', () => {
  assert.equal(nombreDeMiembro(MIEMBROS[0]), 'Roderi Peña');
  assert.equal(nombreDeMiembro(MIEMBROS[1]), 'Daniel Peña');
  assert.equal(nombreDeMiembro({ codigoMiembro: 'EDR-10005' }), 'EDR-10005');
  assert.equal(nombreDeMiembro({}), 'otro miembro');
});
