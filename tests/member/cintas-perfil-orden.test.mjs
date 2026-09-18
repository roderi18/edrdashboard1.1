// ----------------------------------------------------------------------
// LAS CINTAS DEL PERFIL SALEN EN SU ORDEN OFICIAL Y CON LA FILA INCOMPLETA ARRIBA.
//
// El número del archivo es el orden. Ordenar por el nombre ponía la 10 antes que
// la 2, y la regla acordada es leerlas como un libro con la fila incompleta
// arriba: con 3, 8, 14, 20, 25 → arriba [3][8], abajo [14][20][25].
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  CATALOGO_CINTAS_PERFIL,
  ORIGEN_CINTA,
  ordenarCintas,
  disponerCintasEnFilas,
  construirCintasAsignadas,
  configuracionPorCinta,
  vecesPorCinta,
  digitosDeVeces,
  EFECTOS_BORDE_CINTA,
  EFECTOS_NUMERO_CINTA,
} = await import('src/utils/cintas-perfil.mjs');

test('cada cinta del catálogo tiene su imagen en la carpeta pública', () => {
  const carpeta = path.join(process.cwd(), 'public/parches/Cintas y medallas/cintas-perfil');
  // Solo las cintas (.webp): la carpeta tiene además `pendientes/`, con
  // imágenes que todavía no son del catálogo, y contarla hacía fallar la prueba.
  const archivos = new Set(fs.readdirSync(carpeta).filter((nombre) => nombre.endsWith('.webp')));

  assert.equal(CATALOGO_CINTAS_PERFIL.length, archivos.size);
  CATALOGO_CINTAS_PERFIL.forEach((cinta) => {
    assert.ok(archivos.has(decodeURIComponent(path.basename(cinta.src))), cinta.id);
  });
});

test('cada cinta tiene nombre y descripción, sin "medalla" ni remisiones a capítulos', () => {
  CATALOGO_CINTAS_PERFIL.forEach((cinta) => {
    assert.ok(cinta.descripcion, cinta.id);
    assert.doesNotMatch(cinta.nombre, /medalla/i, cinta.id);
    assert.doesNotMatch(cinta.descripcion, /cap[ií]tulo/i, cinta.id);
  });
});

test('se ordenan por número, no por texto, y 12a va antes que 12b', () => {
  assert.deepEqual(ordenarCintas(['14', '2', '12b', '10', '12a', '3']), [
    '2',
    '3',
    '10',
    '12a',
    '12b',
    '14',
  ]);
});

test('se descartan repetidas y las que no existen', () => {
  assert.deepEqual(ordenarCintas(['8', { id: '8' }, '9', 'x', null]), ['8']);
});

test('con cinco, dos arriba y tres abajo, leídas como un libro', () => {
  assert.deepEqual(disponerCintasEnFilas(['25', '3', '20', '8', '14']), [
    ['3', '8'],
    ['14', '20', '25'],
  ]);
});

test('con múltiplos de tres todas las filas van llenas', () => {
  assert.deepEqual(disponerCintasEnFilas(['1', '2', '3', '4', '5', '6']), [
    ['1', '2', '3'],
    ['4', '5', '6'],
  ]);
  assert.deepEqual(disponerCintasEnFilas([]), []);
});

test('nunca se muestran más de 18', () => {
  const todas = CATALOGO_CINTAS_PERFIL.map((cinta) => cinta.id);
  const filas = disponerCintasEnFilas(todas);

  assert.equal(filas.flat().length, 18);
  assert.equal(filas.length, 6);
  assert.equal(filas[0][0], '1');
});

test('al reasignar se conserva el origen de las que ya estaban', () => {
  const anteriores = [{ id: '3', origen: ORIGEN_CINTA.AWARD, asignadaEn: 'antes' }];
  assert.deepEqual(construirCintasAsignadas(anteriores, ['8', { id: '3', veces: 4 }], 'ahora'), [
    { id: '3', origen: ORIGEN_CINTA.AWARD, asignadaEn: 'antes', veces: 4 },
    { id: '8', origen: ORIGEN_CINTA.PRUEBA, asignadaEn: 'ahora', veces: 1 },
  ]);
});

test('una cinta ganada una vez no lleva número; más veces, sus dígitos dorados', () => {
  assert.deepEqual(digitosDeVeces(1), []);
  assert.deepEqual(digitosDeVeces(undefined), []);
  assert.match(digitosDeVeces(3)[0], /numeros-cintas\/numero-3-dorado\.webp$/);
  assert.deepEqual(
    digitosDeVeces(12).map((src) => src.match(/numero-(\d)-/)[1]),
    ['1', '2']
  );
});

test('las entradas antiguas sin veces cuentan como una', () => {
  const veces = vecesPorCinta([{ id: '27' }, { id: '28', veces: 5 }, '3']);
  assert.equal(veces.get('27'), 1);
  assert.equal(veces.get('28'), 5);
  assert.equal(veces.get('3'), 1);
});

test('los efectos antiguos usan el barrido y las elecciones válidas se conservan', () => {
  const configuraciones = configuracionPorCinta([
    '3',
    {
      id: '5',
      veces: 2,
      efectoBorde: EFECTOS_BORDE_CINTA.OLA,
      efectoNumero: EFECTOS_NUMERO_CINTA.DESTELLO,
    },
  ]);

  assert.deepEqual(configuraciones.get('3'), {
    veces: 1,
    efectoBorde: EFECTOS_BORDE_CINTA.BARRIDO,
    efectoNumero: EFECTOS_NUMERO_CINTA.BARRIDO,
  });
  assert.deepEqual(configuraciones.get('5'), {
    veces: 2,
    efectoBorde: EFECTOS_BORDE_CINTA.OLA,
    efectoNumero: EFECTOS_NUMERO_CINTA.DESTELLO,
  });
});

test('la configuración visual elegida se guarda y los valores desconocidos se normalizan', () => {
  assert.deepEqual(
    construirCintasAsignadas(
      [],
      [
        {
          id: '7',
          veces: 3,
          efectoBorde: EFECTOS_BORDE_CINTA.CENTELLEO,
          efectoNumero: 'desconocido',
        },
      ],
      'ahora'
    ),
    [
      {
        id: '7',
        origen: ORIGEN_CINTA.PRUEBA,
        asignadaEn: 'ahora',
        veces: 3,
        efectoBorde: EFECTOS_BORDE_CINTA.CENTELLEO,
        efectoNumero: EFECTOS_NUMERO_CINTA.BARRIDO,
      },
    ]
  );
});

test('cada dígito tiene su imagen', () => {
  const carpeta = path.join(process.cwd(), 'public/parches/Cintas y medallas/numeros-cintas');
  for (let digito = 0; digito <= 9; digito += 1) {
    assert.ok(fs.existsSync(path.join(carpeta, `numero-${digito}-dorado.webp`)), String(digito));
  }
});
