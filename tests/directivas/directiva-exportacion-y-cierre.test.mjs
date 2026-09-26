// ----------------------------------------------------------------------
// EXPORTAR LA DIRECTIVA NACIONAL, EL RECORDATORIO DE CIERRE Y EL MOTIVO DE
// SALIDA.
//
// Qué se rompía:
//  - Al exportar, las secciones de una región quedaban lejos de su región: el
//    documento no se leía como un organigrama. Ahora va el Consejo Ejecutivo y
//    después cada región con sus secciones debajo.
//  - Nada recordaba guardar la directiva en su memoria antes del 22/08.
//  - El historial solo guardaba fechas; ahora también por qué salió.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { ordenarDirectivaParaExportar } = await import('../../src/utils/directiva-exportacion.mjs');
const { recordatorioDeCierre, textoDelRecordatorio } =
  await import('../../src/utils/recordatorio-cierre-cuatrienio.mjs');
const { motivoDeSalidaAutomatico, construirRegistroHistorial, etiquetaDeMotivo } =
  await import('../../src/utils/directiva-historial.mjs');

const fila = (level, entityId, nombre, hierarchyRoleOrder = 1) => ({
  id: `${level}-${entityId}-${nombre}`,
  level,
  entityId,
  nationalXname: nombre,
  hierarchyStructureOrder: 1,
  hierarchyRoleOrder,
});

const REGIONES = { 1: 'Región Este', 2: 'Región Norte' };
const SECCIONES = { 10: 'Sección Oriental I', 11: 'Sección Oriental II', 20: 'Sección Cibao' };
const REGION_DE_SECCION = { 10: '1', 11: '1', 20: '2' };
const opciones = {
  regionDeSeccion: (id) => REGION_DE_SECCION[id] || '',
  tituloDeRegion: (id) => REGIONES[id],
  tituloDeSeccion: (id) => SECCIONES[id] || `Sección ${id}`,
};

test('exportar: Consejo Ejecutivo primero, y cada región con sus secciones debajo', () => {
  const salida = ordenarDirectivaParaExportar(
    [
      fila('seccional', '20', 'Ana'),
      fila('regional', '2', 'Beto'),
      fila('seccional', '11', 'Carla'),
      fila('nacional', 'nacional', 'Director', 1),
      fila('seccional', '10', 'Dora'),
      fila('regional', '1', 'Eli'),
      fila('nacional', 'nacional', 'Subdirector', 2),
    ],
    opciones
  );

  assert.deepEqual(
    salida.map((item) => (item.esEncabezado ? `# ${item.titulo}` : item.nationalXname)),
    [
      '# Consejo Ejecutivo',
      'Director',
      'Subdirector',
      '# Región Este',
      'Eli',
      '# Sección Oriental I',
      'Dora',
      '# Sección Oriental II',
      'Carla',
      '# Región Norte',
      'Beto',
      '# Sección Cibao',
      'Ana',
    ]
  );
});

test('exportar: una región sin gente propia sale igual como encabezado de sus secciones', () => {
  const salida = ordenarDirectivaParaExportar([fila('seccional', '20', 'Ana')], opciones);

  assert.deepEqual(
    salida.map((item) => item.titulo || item.nationalXname),
    ['Región Norte', 'Sección Cibao', 'Ana']
  );
});

test('exportar: una sección sin región conocida no se pierde, va al final', () => {
  const salida = ordenarDirectivaParaExportar(
    [fila('seccional', '99', 'Zoe'), fila('nacional', 'nacional', 'Director')],
    opciones
  );

  assert.deepEqual(
    salida.map((item) => item.titulo || item.nationalXname),
    ['Consejo Ejecutivo', 'Director', 'Secciones sin región', 'Sección 99', 'Zoe']
  );
});

// El 22/08 ya es la directiva nueva; las 11:00 UTC son las 07:00 en Santo Domingo.
const CUATRIENIOS = [{ id: '2026-2030', inicio: '2026-08-22', fin: '2030-08-22' }];
const el = (fecha) => new Date(`${fecha}T11:00:00Z`);

test('recordatorio de cierre: a 30, 7 y 1 día, cada tramo con su id', () => {
  assert.equal(
    recordatorioDeCierre({ ahora: el('2030-07-23'), cuatrienios: CUATRIENIOS }).id,
    'cierre_cuatrienio_directiva_2026-2030_30'
  );
  assert.equal(
    recordatorioDeCierre({ ahora: el('2030-08-10'), cuatrienios: CUATRIENIOS }).tramo,
    30
  );
  assert.equal(
    recordatorioDeCierre({ ahora: el('2030-08-15'), cuatrienios: CUATRIENIOS }).tramo,
    7
  );
  assert.equal(
    recordatorioDeCierre({ ahora: el('2030-08-21'), cuatrienios: CUATRIENIOS }).tramo,
    1
  );
});

test('recordatorio de cierre: nada fuera de los últimos 30 días ni el día del cambio', () => {
  assert.equal(recordatorioDeCierre({ ahora: el('2030-07-01'), cuatrienios: CUATRIENIOS }), null);
  assert.equal(recordatorioDeCierre({ ahora: el('2030-08-22'), cuatrienios: CUATRIENIOS }), null);
});

test('recordatorio de cierre: con 1 día, hoy es el último', () => {
  assert.match(textoDelRecordatorio({ cuatrienio: '2026-2030', dias: 1 }), /Hoy es el último día/);
});

test('motivo de salida: reemplazado si entra otra persona, sin especificar si queda vacía', () => {
  assert.equal(
    motivoDeSalidaAutomatico({ siguienteIdMiembro: '5', siguienteActivo: true }),
    'reemplazo'
  );
  assert.equal(
    motivoDeSalidaAutomatico({ siguienteIdMiembro: '5', siguienteActivo: false }),
    'sin_especificar'
  );
});

test('motivo de salida: el registro lo guarda, y uno inválido o antiguo es "Sin especificar"', () => {
  const anterior = { nivel: 'nacional', idMiembro: '1', fechaInicio: '2026-01-01' };

  assert.equal(
    construirRegistroHistorial({
      anterior,
      idAsignacion: 'a',
      fechaSalida: '2026-09-01',
      motivo: 'reemplazo',
    }).motivo,
    'reemplazo'
  );
  assert.equal(
    construirRegistroHistorial({
      anterior,
      idAsignacion: 'a',
      fechaSalida: '2026-09-01',
      motivo: 'xx',
    }).motivo,
    'sin_especificar'
  );
  assert.equal(etiquetaDeMotivo(undefined), 'Sin especificar');
});
