import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aceptaElAviso,
  cumpleanosDelDia,
  diasHastaCumpleanos,
  construirAvisoDeCumpleanos,
  destinatariosDelDestacamento,
} from '../../src/server/cumpleanos-core.mjs';

// ----------------------------------------------------------------------
// El barrido diario de cumpleaños.
//
// Corre una vez al dia y avisa de quien cumple HOY y de quien cumple dentro de
// SIETE dias, a todos los miembros de su destacamento.
// ----------------------------------------------------------------------

const HOY = new Date(2026, 7, 31); // 31 de agosto de 2026

test('quien cumple hoy sale con cero dias', () => {
  assert.equal(diasHastaCumpleanos('2009-08-31', HOY), 0);
});

test('quien cumple dentro de una semana sale con siete', () => {
  assert.equal(diasHastaCumpleanos('2009-09-07', HOY), 7);
});

test('el cumpleaños que ya paso cuenta para el año que viene', () => {
  assert.equal(diasHastaCumpleanos('2009-08-30', HOY), 364);
});

test('sin fecha de nacimiento no hay cuenta', () => {
  assert.equal(diasHastaCumpleanos(null, HOY), null);
  assert.equal(diasHastaCumpleanos('no es una fecha', HOY), null);
});

// El 29 de febrero existe uno de cada cuatro años; el aviso no puede reventar
// ni caer en un dia que no toca.
test('un 29 de febrero no rompe la cuenta', () => {
  const dias = diasHastaCumpleanos('2008-02-29', new Date(2026, 1, 20));

  assert.equal(Number.isInteger(dias), true);
  assert.ok(dias >= 0 && dias <= 366);
});

const MIEMBROS = [
  { idMiembros: 1, nombres: 'Roderi', apellidos: 'Peña', fechaNacimiento: '2009-08-31', idDestacamento: '231' },
  { idMiembros: 2, nombres: 'Daniel', apellidos: 'Cruz', fechaNacimiento: '2009-09-07', idDestacamento: '231' },
  { idMiembros: 3, nombres: 'Ana', apellidos: 'Gil', fechaNacimiento: '2009-12-01', idDestacamento: '231' },
  { idMiembros: 4, nombres: 'Stalin', apellidos: 'Mota', fechaNacimiento: '2009-08-31', idDestacamento: '240' },
];

test('el barrido recoge solo los de hoy y los de dentro de siete dias', () => {
  const salen = cumpleanosDelDia(MIEMBROS, { hoy: HOY }).map(({ miembro, dias }) => [
    miembro.nombres,
    dias,
  ]);

  assert.deepEqual(salen, [['Roderi', 0], ['Daniel', 7], ['Stalin', 0]]);
});

// A TODOS los del destacamento, que es la gente que lo felicita.
test('el aviso va a todas las cuentas del destacamento', () => {
  const destinatarios = destinatariosDelDestacamento({
    idDestacamento: '231',
    miembros: MIEMBROS,
    cuentasPorMiembro: { 1: ['uid-1'], 2: ['uid-2'], 3: ['uid-3'], 4: ['uid-4'] },
  });

  assert.deepEqual(destinatarios, ['uid-1', 'uid-2', 'uid-3']);
});

test('y no a los de otro destacamento', () => {
  const destinatarios = destinatariosDelDestacamento({
    idDestacamento: '231',
    miembros: MIEMBROS,
    cuentasPorMiembro: { 1: ['uid-1'], 4: ['uid-4'] },
  });

  assert.equal(destinatarios.includes('uid-4'), false);
});

test('un miembro sin cuenta no rompe el reparto', () => {
  const destinatarios = destinatariosDelDestacamento({
    idDestacamento: '231',
    miembros: MIEMBROS,
    cuentasPorMiembro: { 1: ['uid-1'] },
  });

  assert.deepEqual(destinatarios, ['uid-1']);
});

test('quien apago los cumpleaños no lo recibe', () => {
  assert.equal(aceptaElAviso(null, 'cumpleanos_miembro_destacamento_hoy'), true);
  assert.equal(
    aceptaElAviso(
      { tiposNotificacion: { cumpleanos_miembro_destacamento_hoy: false } },
      'cumpleanos_miembro_destacamento_hoy'
    ),
    false
  );
  assert.equal(
    aceptaElAviso({ modulos: { cumpleanos: false } }, 'cumpleanos_miembro_destacamento_hoy'),
    false
  );
});

// El id lleva la fecha dentro: si la tarea corre dos veces el mismo dia, la
// segunda pisa a la primera en vez de mandar el aviso dos veces.
test('el aviso del mismo dia no se duplica', () => {
  const uno = construirAvisoDeCumpleanos({
    miembro: MIEMBROS[0],
    dias: 0,
    idsDestinatarios: ['uid-1'],
    hoy: HOY,
  });
  const otro = construirAvisoDeCumpleanos({
    miembro: MIEMBROS[0],
    dias: 0,
    idsDestinatarios: ['uid-1', 'uid-2'],
    hoy: HOY,
  });

  assert.equal(uno.id, otro.id);
  assert.equal(uno.id, 'cumpleanos_miembro_destacamento_hoy_1_2026-08-31');
});

test('el aviso dice lo que toca segun el dia', () => {
  const hoy = construirAvisoDeCumpleanos({ miembro: MIEMBROS[0], dias: 0, idsDestinatarios: ['x'], hoy: HOY });
  const proximo = construirAvisoDeCumpleanos({ miembro: MIEMBROS[1], dias: 7, idsDestinatarios: ['x'], hoy: HOY });

  assert.match(hoy.mensaje, /Hoy está de cumpleaños Roderi Peña/);
  assert.equal(hoy.titulo, 'Cumpleaños hoy en tu destacamento');
  assert.match(proximo.mensaje, /Faltan 7 días para el cumpleaños de Daniel Cruz/);
  assert.equal(proximo.rolDestinatario, 'usuario');
  assert.equal(proximo.estado, 'no_leida');
});

// La cara del cumpleañero no viene en el padron de la API —las fotos viven en
// Firebase—, asi que hay que pasarsela. Sin ella el aviso salia con un icono de
// sobre, que es justo lo contrario de lo que se quiere ver en un cumpleaños.
test('el aviso lleva la foto del miembro cuando la hay', () => {
  const aviso = construirAvisoDeCumpleanos({
    miembro: MIEMBROS[0],
    dias: 0,
    idsDestinatarios: ['uid-1'],
    hoy: HOY,
    urlFoto: 'https://ejemplo/adrian.jpg',
  });

  assert.equal(aviso.imagenTipo, 'persona');
  assert.equal(aviso.imagenURL, 'https://ejemplo/adrian.jpg');
  assert.equal(aviso.miniaturaURL, 'https://ejemplo/adrian.jpg');
});

test('y sin foto no se inventa una', () => {
  const aviso = construirAvisoDeCumpleanos({
    miembro: MIEMBROS[0],
    dias: 0,
    idsDestinatarios: ['uid-1'],
    hoy: HOY,
  });

  assert.equal(aviso.imagenURL, null);
});

// ----------------------------------------------------------------------
// EL CUMPLEAÑERO NO SE FELICITA A SI MISMO.
//
// El aviso salia a TODO el destacamento, el propio cumpleañero incluido: se
// encontraba en sus notificaciones un "hoy esta de cumpleaños <su nombre>" que
// no le decia nada nuevo, y con un boton de felicitar que le habria rechazado.
// ----------------------------------------------------------------------
test('el cumpleañero queda fuera del reparto', () => {
  const cuentasPorMiembro = { 1: ['uid-1'], 2: ['uid-2'], 3: ['uid-3'] };

  const conEl = destinatariosDelDestacamento({
    idDestacamento: '231',
    miembros: MIEMBROS,
    cuentasPorMiembro,
  });

  const sinEl = destinatariosDelDestacamento({
    idDestacamento: '231',
    miembros: MIEMBROS,
    cuentasPorMiembro,
    exceptoMiembro: '1',
  });

  assert.deepEqual(conEl, ['uid-1', 'uid-2', 'uid-3']);
  assert.deepEqual(sinEl, ['uid-2', 'uid-3']);
});

test('y queda fuera por todas sus cuentas, no solo por una', () => {
  const salen = destinatariosDelDestacamento({
    idDestacamento: '231',
    miembros: MIEMBROS,
    cuentasPorMiembro: { 1: ['uid-1', 'uid-1-bis'], 2: ['uid-2'] },
    exceptoMiembro: 1,
  });

  assert.deepEqual(salen, ['uid-2']);
});

test('sin excepcion, el reparto no cambia', () => {
  const salen = destinatariosDelDestacamento({
    idDestacamento: '231',
    miembros: MIEMBROS,
    cuentasPorMiembro: { 1: ['uid-1'], 2: ['uid-2'] },
    exceptoMiembro: null,
  });

  assert.deepEqual(salen, ['uid-1', 'uid-2']);
});
