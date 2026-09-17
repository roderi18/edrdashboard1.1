// ----------------------------------------------------------------------
// EL ESTATUS DEL MIEMBRO SE MUEVE CON LA ASISTENCIA, Y SOLO COMO SE ACORDÓ.
//
// El estatus lo cambiaba alguien a mano cuando se acordaba: quien dejaba de
// venir seguía "Activo" y nadie lo reclutaba. Este test clava la regla entera,
// incluidos los casos que la hacen molesta si se programan de más:
// el día sin reunión, la excusa que no perdona los tres meses, el cambio a mano
// que manda 30 días y el fallecido que no se mueve con nada.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { ESTATUS_MIEMBRO } = await import('src/utils/estatus-miembro.mjs');
const {
  aplicarPaseDeLista,
  evaluarPorTiempo,
  aplicarCambioManual,
  estaPorCaerEnInactivo,
  reiniciarPorCambioDeDestacamento,
  registroInicialDeEstatus,
  fechaLimiteDeInactividad,
  explicarEstatus,
  mesesEntre,
} = await import('src/utils/estatus-por-asistencia.mjs');

const activo = (extra = {}) =>
  registroInicialDeEstatus({
    idMiembros: '10002',
    estatus: ESTATUS_MIEMBRO.ACTIVO,
    fechaUltimaPresencia: '2026-04-04',
    desde: '2026-01-10',
    ...extra,
  });

// Pasa lista varias veces seguidas, como los sábados de un destacamento.
const pasarLista = (registro, dias) =>
  dias.reduce(
    (actual, [fecha, estado, esReunion = true]) =>
      aplicarPaseDeLista({ registro: actual, fecha, estado, esReunion }),
    registro
  );

test('tres faltas seguidas dejan al miembro en reclutamiento', () => {
  const tras = pasarLista(activo(), [
    ['2026-03-07', 'ausente'],
    ['2026-03-14', 'ausente'],
    ['2026-03-21', 'ausente'],
  ]);

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);
  assert.equal(tras.faltasSeguidas, 3);
  assert.match(tras.motivo, /3 reuniones seguidas/);
  assert.equal(tras.desde, '2026-03-21');
});

test('dos faltas no bastan, y una presencia reinicia la cuenta', () => {
  const tras = pasarLista(activo(), [
    ['2026-03-07', 'ausente'],
    ['2026-03-14', 'ausente'],
    ['2026-03-21', 'presente'],
    ['2026-03-28', 'ausente'],
  ]);

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(tras.faltasSeguidas, 1);
});

test('la excusa y el enfermo cortan la racha de faltas', () => {
  const tras = pasarLista(activo({ fechaUltimaPresencia: '2026-02-28' }), [
    ['2026-03-07', 'ausente'],
    ['2026-03-14', 'ausente'],
    ['2026-03-21', 'enfermo'],
    ['2026-03-28', 'excusa'],
    ['2026-04-04', 'ausente'],
  ]);

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(tras.faltasSeguidas, 1);
  // No estuvo: su última presencia no se mueve.
  assert.equal(tras.fechaUltimaPresencia, '2026-02-28');
});

test('un día sin reunión no cuenta para nada', () => {
  const tras = pasarLista(activo(), [
    ['2026-03-07', 'ausente'],
    ['2026-03-14', 'ausente'],
    // Excursión: se pasa lista igual, pero no es reunión.
    ['2026-03-18', 'ausente', false],
    ['2026-03-21', 'ausente'],
  ]);

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);
  assert.equal(tras.faltasSeguidas, 3);
});

test('venir a una actividad no reactiva, pero sí cuenta como presencia para los tres meses', () => {
  const tras = aplicarPaseDeLista({
    registro: registroInicialDeEstatus({
      estatus: ESTATUS_MIEMBRO.INACTIVO,
      fechaUltimaPresencia: '2026-01-10',
      desde: '2026-04-11',
    }),
    fecha: '2026-05-02',
    estado: 'presente',
    esReunion: false,
  });

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.INACTIVO);
  assert.equal(tras.presenciasSeguidas, 0);
  assert.equal(tras.fechaUltimaPresencia, '2026-05-02');
});

test('desde reclutamiento vuelve a activo con una sola presencia', () => {
  const tras = aplicarPaseDeLista({
    registro: registroInicialDeEstatus({
      estatus: ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
      fechaUltimaPresencia: '2026-03-01',
      desde: '2026-03-21',
    }),
    fecha: '2026-04-04',
    estado: 'presente',
  });

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.ACTIVO);
  assert.match(tras.motivo, /Volvió/);
});

test('desde inactivo hacen falta tres reuniones seguidas', () => {
  const inactivo = registroInicialDeEstatus({
    estatus: ESTATUS_MIEMBRO.INACTIVO,
    fechaUltimaPresencia: '2026-04-04',
    desde: '2026-07-11',
  });

  const dos = pasarLista(inactivo, [
    ['2026-08-01', 'presente'],
    ['2026-08-08', 'presente'],
  ]);
  assert.equal(dos.estatus, ESTATUS_MIEMBRO.INACTIVO);

  const tres = pasarLista(dos, [['2026-08-15', 'presente']]);
  assert.equal(tres.estatus, ESTATUS_MIEMBRO.ACTIVO);
  assert.match(tres.motivo, /3 reuniones seguidas/);
});

test('si falta en medio, la cuenta para reactivarse empieza de cero', () => {
  const tras = pasarLista(
    registroInicialDeEstatus({ estatus: ESTATUS_MIEMBRO.INACTIVO, desde: '2026-07-11' }),
    [
      ['2026-08-01', 'presente'],
      ['2026-08-08', 'ausente'],
      ['2026-08-15', 'presente'],
    ]
  );

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.INACTIVO);
  assert.equal(tras.presenciasSeguidas, 1);
});

test('el miembro nuevo empieza en reclutamiento y necesita tres reuniones seguidas', () => {
  const nuevo = registroInicialDeEstatus({ idMiembros: '99999', desde: '' });
  assert.equal(nuevo.estatus, ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);

  const dos = pasarLista(nuevo, [
    ['2026-09-05', 'presente'],
    ['2026-09-12', 'presente'],
  ]);
  assert.equal(dos.estatus, ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);

  const tres = pasarLista(dos, [['2026-09-19', 'presente']]);
  assert.equal(tres.estatus, ESTATUS_MIEMBRO.ACTIVO);
});

test('tres meses sin presencia lo dejan inactivo, aunque nadie pase lista', () => {
  const tras = evaluarPorTiempo({
    registro: registroInicialDeEstatus({
      estatus: ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
      fechaUltimaPresencia: '2026-04-04',
      desde: '2026-05-02',
    }),
    hoy: '2026-07-11',
  });

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.INACTIVO);
  assert.match(tras.motivo, /2026-04-04/);
});

test('a los dos meses todavía no baja', () => {
  const tras = evaluarPorTiempo({
    registro: registroInicialDeEstatus({
      estatus: ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
      fechaUltimaPresencia: '2026-04-04',
    }),
    hoy: '2026-06-04',
  });

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);
});

test('las excusas no salvan de los tres meses', () => {
  const conExcusas = pasarLista(activo(), [
    ['2026-04-11', 'excusa'],
    ['2026-05-02', 'enfermo'],
    ['2026-06-06', 'excusa'],
  ]);

  assert.equal(conExcusas.estatus, ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(
    evaluarPorTiempo({ registro: conExcusas, hoy: '2026-07-11' }).estatus,
    ESTATUS_MIEMBRO.INACTIVO
  );
});

test('el que nunca vino cuenta desde su ingreso', () => {
  const tras = evaluarPorTiempo({
    registro: registroInicialDeEstatus({ desde: '2026-01-10' }),
    hoy: '2026-05-10',
  });

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.INACTIVO);
  assert.match(tras.motivo, /Nunca ha asistido/);
});

test('se avisa dos semanas antes de caer en inactivo', () => {
  const registro = registroInicialDeEstatus({
    estatus: ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
    fechaUltimaPresencia: '2026-04-04',
  });

  assert.equal(fechaLimiteDeInactividad('2026-04-04'), '2026-07-04');
  assert.equal(estaPorCaerEnInactivo({ registro, hoy: '2026-06-01' }), false);
  assert.equal(estaPorCaerEnInactivo({ registro, hoy: '2026-06-25' }), true);
  // El día del límite ya no es aviso: es el cambio.
  assert.equal(estaPorCaerEnInactivo({ registro, hoy: '2026-07-04' }), false);
});

test('el fallecido no se mueve con nada', () => {
  const fallecido = registroInicialDeEstatus({
    estatus: ESTATUS_MIEMBRO.FALLECIDO,
    desde: '2026-05-02',
  });

  assert.equal(
    pasarLista(fallecido, [
      ['2026-05-09', 'presente'],
      ['2026-05-16', 'presente'],
      ['2026-05-23', 'presente'],
    ]).estatus,
    ESTATUS_MIEMBRO.FALLECIDO
  );
  assert.equal(evaluarPorTiempo({ registro: fallecido, hoy: '2027-01-01' }).estatus, ESTATUS_MIEMBRO.FALLECIDO);
});

test('un cambio a mano manda 30 días y luego la regla vuelve a decidir', () => {
  const aMano = aplicarCambioManual({
    registro: activo(),
    estatus: ESTATUS_MIEMBRO.ACTIVO,
    motivo: 'Habló con el coordinador',
    autor: 'Coordinador',
    hoy: '2026-03-24',
  });

  assert.equal(aMano.respetarManualHasta, '2026-04-23');

  const dentro = pasarLista(aMano, [
    ['2026-03-28', 'ausente'],
    ['2026-04-04', 'ausente'],
    ['2026-04-11', 'ausente'],
  ]);
  assert.equal(dentro.estatus, ESTATUS_MIEMBRO.ACTIVO, 'dentro de los 30 días no se mueve');
  assert.equal(dentro.faltasSeguidas, 3, 'pero las faltas se siguen contando');

  const despues = pasarLista(dentro, [['2026-04-25', 'ausente']]);
  assert.equal(despues.estatus, ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);
});

test('cambiar de destacamento reinicia las rachas y deja el estatus igual', () => {
  const tras = reiniciarPorCambioDeDestacamento({
    registro: { ...activo(), faltasSeguidas: 2, presenciasSeguidas: 1 },
    idDestacamento: '77',
  });

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(tras.faltasSeguidas, 0);
  assert.equal(tras.presenciasSeguidas, 0);
  assert.equal(tras.idDestacamento, '77');
});

test('el chip explica por qué está así', () => {
  const texto = explicarEstatus({
    ...activo(),
    faltasSeguidas: 2,
    motivo: 'Faltó a 2 reuniones seguidas.',
  });

  assert.match(texto, /Última presencia: 2026-04-04/);
  assert.match(texto, /2 faltas seguidas/);
});

test('los meses se cuentan por fecha, no por días redondos', () => {
  assert.equal(mesesEntre('2026-04-04', '2026-07-03'), 2);
  assert.equal(mesesEntre('2026-04-04', '2026-07-04'), 3);
  assert.equal(mesesEntre('2026-11-30', '2027-02-28'), 2);
});
