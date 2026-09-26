// ----------------------------------------------------------------------
// HISTORIAL DE OCUPANTES DE UN CARGO DE DIRECTIVA.
//
// Qué se quería evitar: cambiar a alguien de una casilla de directiva
// sobreescribía el documento, y quien la ocupaba antes desaparecía sin dejar
// rastro. Estas reglas deciden cuándo esa salida merece quedar guardada (30
// días calendario mínimo, para no ensuciar el historial con correcciones
// rápidas) y cómo se arma la lista que mezcla vigentes e historial.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  diasEntre,
  debeRegistrarSalida,
  combinarHistorialYVigentes,
  nombreDeCargoPorPosicion,
  construirRegistroHistorial,
  NIVELES_HISTORIAL_NACIONAL,
} = await import('../../src/utils/directiva-historial.mjs');

test('la vista global del Consejo Nacional nunca incluye destacamentos', () => {
  assert.deepEqual(NIVELES_HISTORIAL_NACIONAL, ['nacional', 'regional', 'seccional']);
  assert.ok(!NIVELES_HISTORIAL_NACIONAL.includes('destacamento'));
});

test('el nombre del cargo sale del catalogo por su id de posicion', () => {
  assert.equal(nombreDeCargoPorPosicion('inexistente-xyz'), 'Cargo');
  assert.notEqual(nombreDeCargoPorPosicion('destacamento-pastor'), 'Cargo');
});

test('combinarHistorialYVigentes resuelve el cargo y la entidad si no vienen dados', () => {
  const filas = combinarHistorialYVigentes({
    vigentes: [
      {
        id: 'a',
        nivel: 'regional',
        idEntidad: '7',
        idPosicionDirectiva: 'destacamento-pastor',
        fechaInicio: '2026-01-01',
      },
    ],
    resolverEntidadNombre: (idEntidad, nivel) =>
      nivel === 'regional' ? `Región ${idEntidad}` : '',
  });

  assert.equal(filas[0].entidadNombre, 'Región 7');
  assert.notEqual(filas[0].cargoNombre, '');
});

test('dias calendario entre dos fechas', () => {
  assert.equal(diasEntre('2026-01-01', '2026-01-31'), 30);
  assert.equal(diasEntre('2026-01-01', '2026-01-30'), 29);
  assert.equal(diasEntre('', '2026-01-30'), 0);
});

test('con menos de 30 dias no se registra la salida', () => {
  const anterior = { activo: true, idMiembro: '1', fechaInicio: '2026-01-01' };

  assert.equal(
    debeRegistrarSalida({ anterior, siguienteIdMiembro: '2', fechaSalida: '2026-01-29' }),
    false
  );
});

test('con 30 dias exactos si se registra la salida', () => {
  const anterior = { activo: true, idMiembro: '1', fechaInicio: '2026-01-01' };

  assert.equal(
    debeRegistrarSalida({ anterior, siguienteIdMiembro: '2', fechaSalida: '2026-01-31' }),
    true
  );
});

test('si la casilla estaba vacia o inactiva no hay a quien registrar', () => {
  assert.equal(
    debeRegistrarSalida({ anterior: null, siguienteIdMiembro: '2', fechaSalida: '2026-02-01' }),
    false
  );
  assert.equal(
    debeRegistrarSalida({
      anterior: { activo: false, idMiembro: '1', fechaInicio: '2026-01-01' },
      siguienteIdMiembro: '2',
      fechaSalida: '2026-02-01',
    }),
    false
  );
});

test('si sigue siendo la misma persona no es una salida', () => {
  const anterior = { activo: true, idMiembro: '1', fechaInicio: '2026-01-01' };

  assert.equal(
    debeRegistrarSalida({ anterior, siguienteIdMiembro: '1', fechaSalida: '2026-03-01' }),
    false
  );
});

test('vacar el cargo (sin reemplazo) tambien cuenta como salida con 30+ dias', () => {
  const anterior = { activo: true, idMiembro: '1', fechaInicio: '2026-01-01' };

  assert.equal(
    debeRegistrarSalida({
      anterior,
      siguienteIdMiembro: '',
      siguienteActivo: false,
      fechaSalida: '2026-03-01',
    }),
    true
  );
});

test('el id del registro es estable por salida, no por casilla', () => {
  const anterior = {
    nivel: 'regional',
    idEntidad: '7',
    idPosicionDirectiva: 'coordinador-adiestramiento',
    idMiembro: '1',
    nombreMiembro: 'Juan Pérez',
    fechaInicio: '2026-01-01',
  };

  const registro = construirRegistroHistorial({
    anterior,
    idAsignacion: 'regional_7_coordinador-adiestramiento_general_1',
    fechaSalida: '2028-06-15',
  });

  assert.equal(registro.id, 'regional_7_coordinador-adiestramiento_general_1__2028-06-15');
  assert.equal(registro.fechaInicio, '2026-01-01');
  assert.equal(registro.fechaFin, '2028-06-15');
  assert.equal(registro.nombreMiembro, 'Juan Pérez');
});

test('vigentes primero, y despues el historial por fecha de salida mas reciente', () => {
  const filas = combinarHistorialYVigentes({
    historial: [
      { id: 'a', fechaInicio: '2026-01-01', fechaFin: '2028-06-15', nombreMiembro: 'Juan Pérez' },
      { id: 'b', fechaInicio: '2022-08-20', fechaFin: '2026-01-01', nombreMiembro: 'Ana Ruiz' },
    ],
    vigentes: [{ id: 'c', fechaInicio: '2028-06-15', nombreMiembro: 'María Gómez' }],
  });

  assert.deepEqual(
    filas.map((fila) => fila.nombreMiembro),
    ['María Gómez', 'Juan Pérez', 'Ana Ruiz']
  );
  assert.equal(filas[0].vigente, true);
  assert.equal(filas[1].vigente, false);
});
