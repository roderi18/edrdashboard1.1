// ----------------------------------------------------------------------
// UNA LICENCIA NO ES UNA FALTA.
//
// Quien se iba un mes salía "Ausente" cada sábado que nadie lo marcaba: le
// sumaba faltas seguidas y lo bajaba a Reclutamiento sin haber dejado el
// destacamento. "Otro · De licencia" cubre un rango de días; mientras dure, el
// pase de lista lo pone solo y la regla del estatus no le cuenta la falta.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  MOTIVOS_OTRO,
  rangoDeLicencia,
  etiquetaDeOtro,
  licenciasEnFecha,
  licenciaCubreFecha,
  motivoLicenciaInvalida,
  MAXIMO_DIAS_LICENCIA,
} = await import('src/utils/licencias-asistencia.mjs');
const { ESTATUS_MIEMBRO } = await import('src/utils/estatus-miembro.mjs');
const { aplicarPaseDeLista, registroInicialDeEstatus } =
  await import('src/utils/estatus-por-asistencia.mjs');

test('"De licencia" es la primera opción de "Otro"', () => {
  assert.equal(MOTIVOS_OTRO[0].value, 'licencia');
  assert.equal(MOTIVOS_OTRO[0].label, 'De licencia');
  assert.equal(etiquetaDeOtro('licencia'), 'Otro · De licencia');
  assert.equal(etiquetaDeOtro(''), 'Otro');
});

test('"Suspensión disciplinaria" también pide días y tampoco es falta', () => {
  assert.equal(MOTIVOS_OTRO[1].value, 'suspension');
  assert.equal(MOTIVOS_OTRO[1].label, 'Suspensión disciplinaria');
  assert.equal(MOTIVOS_OTRO[1].pideDias, true);
  assert.equal(etiquetaDeOtro('suspension'), 'Otro · Suspensión disciplinaria');
});

test('los días de la licencia incluyen el primero', () => {
  assert.deepEqual(rangoDeLicencia({ fechaInicio: '2026-09-05', dias: 7 }), {
    fechaInicio: '2026-09-05',
    fechaFin: '2026-09-11',
  });
  assert.deepEqual(rangoDeLicencia({ fechaInicio: '2026-12-28', dias: 7 }).fechaFin, '2027-01-03');
});

test('una licencia sin día de inicio, sin días o demasiado larga no se acepta', () => {
  assert.match(motivoLicenciaInvalida({ fechaInicio: '', dias: 7 }), /empieza/);
  assert.match(motivoLicenciaInvalida({ fechaInicio: '2026-09-05', dias: 0 }), /al menos/);
  assert.match(
    motivoLicenciaInvalida({ fechaInicio: '2026-09-05', dias: MAXIMO_DIAS_LICENCIA + 1 }),
    /máximo/
  );
  assert.equal(motivoLicenciaInvalida({ fechaInicio: '2026-09-05', dias: 30 }), '');
});

test('la licencia cubre su rango y nada más', () => {
  const licencia = { idMiembro: '7', fechaInicio: '2026-09-05', fechaFin: '2026-09-11' };

  assert.equal(licenciaCubreFecha(licencia, '2026-09-04'), false);
  assert.equal(licenciaCubreFecha(licencia, '2026-09-05'), true);
  assert.equal(licenciaCubreFecha(licencia, '2026-09-11'), true);
  assert.equal(licenciaCubreFecha(licencia, '2026-09-12'), false);
});

test('en un día se sabe quién está de licencia', () => {
  const vigentes = licenciasEnFecha(
    [
      { idMiembro: '7', fechaInicio: '2026-09-05', fechaFin: '2026-09-11' },
      { idMiembro: '8', fechaInicio: '2026-10-01', fechaFin: '2026-10-07' },
    ],
    '2026-09-10'
  );

  assert.deepEqual([...vigentes.keys()], ['7']);
});

test('estar de licencia no cuenta como falta para el estatus', () => {
  const activo = registroInicialDeEstatus({
    estatus: ESTATUS_MIEMBRO.ACTIVO,
    fechaUltimaPresencia: '2026-08-29',
    desde: '2026-01-10',
  });

  const tras = ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26'].reduce(
    (actual, fecha) => aplicarPaseDeLista({ registro: actual, fecha, estado: 'licencia' }),
    activo
  );

  assert.equal(tras.estatus, ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(tras.faltasSeguidas, 0);
  // Tampoco es presencia: los tres meses sin venir siguen corriendo.
  assert.equal(tras.fechaUltimaPresencia, '2026-08-29');
});
