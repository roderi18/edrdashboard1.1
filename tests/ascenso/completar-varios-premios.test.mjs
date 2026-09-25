import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// COMPLETAR VARIOS PREMIOS A LA VEZ (Ctrl + clic y "Completar").
//
// Completar uno a uno repintaba la cuadrícula tantas veces como premios. El lote
// escribe todo en memoria de una vez y avisa UNA sola vez, así que los checks
// salen juntos y al instante. Y no puede pisar lo que ya estaba completado: su
// fecha y sus veces son las de entonces.

const { getAwardsProgressCache, setAwardsProgressCache, vaciarProgresoEnCache } =
  await import('src/services/awards-progress-cache.js');
const { completarPremiosAscenso, cambiarEstadoPremiosAscenso } =
  await import('src/sections/member/awards/components/core/AwardsActionsCore.js');

const MIEMBRO = '777';
const premio = (rowId) => ({ sectionId: 'div', parentId: 'grupo', rowId, metadata: {} });

const avisos = [];
globalThis.window = {
  dispatchEvent: (evento) => avisos.push(evento),
};
globalThis.CustomEvent = class {
  constructor(tipo, opciones) {
    this.type = tipo;
    this.detail = opciones?.detail;
  }
};

test.beforeEach(() => {
  avisos.length = 0;
  vaciarProgresoEnCache();
});

test('completa todos los elegidos en memoria y avisa a la pantalla una sola vez', async () => {
  const resultado = await completarPremiosAscenso({
    memberId: MIEMBRO,
    premios: [premio('a'), premio('b'), premio('c')],
  });

  const { status } = getAwardsProgressCache(MIEMBRO);
  assert.deepEqual(status.sistemaAscenso.div.grupo, {
    a: 'completado',
    b: 'completado',
    c: 'completado',
  });
  assert.equal(avisos.length, 1);
  assert.equal(resultado.completados + resultado.fallidos, 3);
});

test('no toca los que ya estaban completados (ni su fecha ni sus veces)', async () => {
  setAwardsProgressCache(MIEMBRO, {
    status: { sistemaAscenso: { div: { grupo: { a: 'completado' } } } },
    data: {
      sistemaAscenso: {
        div: {
          grupo: { a: { status: 'completado', completedDate: '2020-01-01', timesCompleted: 3 } },
        },
      },
    },
  });

  const resultado = await completarPremiosAscenso({
    memberId: MIEMBRO,
    premios: [premio('a'), premio('b')],
  });

  const { data } = getAwardsProgressCache(MIEMBRO);
  assert.equal(data.sistemaAscenso.div.grupo.a.completedDate, '2020-01-01');
  assert.equal(data.sistemaAscenso.div.grupo.a.timesCompleted, 3);
  assert.equal(data.sistemaAscenso.div.grupo.b.status, 'completado');
  assert.equal(resultado.completados + resultado.fallidos, 1);
});

test('si todos estaban completados no escribe ni avisa', async () => {
  setAwardsProgressCache(MIEMBRO, {
    status: { sistemaAscenso: { div: { grupo: { a: 'completado' } } } },
    data: {},
  });

  const resultado = await completarPremiosAscenso({ memberId: MIEMBRO, premios: [premio('a')] });

  assert.deepEqual(resultado, { completados: 0, fallidos: 0 });
  assert.equal(avisos.length, 0);
});

test('quitar el completado de varios: solo los completados, sin fecha, veces ni certificado', async () => {
  setAwardsProgressCache(MIEMBRO, {
    status: { sistemaAscenso: { div: { grupo: { a: 'completado', b: 'completado' } } } },
    data: {
      sistemaAscenso: {
        div: {
          grupo: {
            a: {
              status: 'completado',
              completedDate: '2020-01-01',
              timesCompleted: 2,
              certificate: { id: 'c' },
            },
            b: { status: 'completado', completedDate: '2021-01-01', timesCompleted: 1 },
          },
        },
      },
    },
  });

  const resultado = await cambiarEstadoPremiosAscenso({
    memberId: MIEMBRO,
    premios: [premio('a'), premio('b'), premio('sin-completar')],
    nextStatus: 'no_iniciado',
  });

  const { status, data } = getAwardsProgressCache(MIEMBRO);
  assert.equal(status.sistemaAscenso.div.grupo.a, 'no_iniciado');
  assert.equal(status.sistemaAscenso.div.grupo.b, 'no_iniciado');
  assert.equal(status.sistemaAscenso.div.grupo['sin-completar'], undefined);
  assert.equal(data.sistemaAscenso.div.grupo.a.completedDate, null);
  assert.equal(data.sistemaAscenso.div.grupo.a.timesCompleted, 0);
  assert.equal(data.sistemaAscenso.div.grupo.a.certificate, null);
  assert.equal(avisos.length, 1);
  assert.equal(resultado.cambiados + resultado.fallidos, 2);
});
