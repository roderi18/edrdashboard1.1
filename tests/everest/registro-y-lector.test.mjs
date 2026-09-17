// ----------------------------------------------------------------------
// EL REGISTRO DE BLOQUES Y EL LECTOR DE LA PORTADA.
//
// Lo que hay que garantizar antes de que la portada lea una sola cosa del
// Designer (fase 1):
//
//   - Cada valor de fabrica PASA SU PROPIO SANEADO SIN PERDER NADA. Si no,
//     "publicar lo mismo que hay" cambiaria la portada, y el Designer no podria
//     arrancar enseñando lo que esta en vivo.
//   - Sin nada publicado —o con algo roto publicado— cada bloque devuelve su
//     valor de fabrica. Una publicacion rota no deja un hueco: deja lo de antes.
//   - Publicar un bloque no toca los demas.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { FABRICA_DE_PORTADA } = await import('src/sections/principal/fabrica-de-portada.js');
const { BLOQUES_EVEREST, bloquePorId, bloquesPublicablesDe, GRUPOS_DE_BLOQUES } =
  await import('src/utils/everest/bloques.mjs');
const { resolverPortada, prepararPublicacion, ORIGEN_DEL_BLOQUE } =
  await import('src/utils/everest/portada.mjs');
const { PANTALLAS_EVEREST } = await import('src/utils/everest/colecciones.mjs');

const PRINCIPAL = PANTALLAS_EVEREST.principal;
const copia = (valor) => JSON.parse(JSON.stringify(valor));

// ----------------------------------------------------------------------
// EL REGISTRO
// ----------------------------------------------------------------------

test('cada bloque tiene un id unico, legible en una direccion', () => {
  const ids = BLOQUES_EVEREST.map((bloque) => bloque.id);

  assert.equal(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.match(id, /^[a-z]+(?:-[a-z]+)*$/));
});

test('cada bloque dice a que grupo pertenece y como se limpia', () => {
  const grupos = Object.values(GRUPOS_DE_BLOQUES);

  BLOQUES_EVEREST.forEach((bloque) => {
    assert.ok(grupos.includes(bloque.grupo), `${bloque.id}: grupo desconocido`);
    assert.ok(bloque.externo || typeof bloque.sanear === 'function', `${bloque.id}: sin saneado`);
  });
});

test('cada bloque de la portada tiene su valor de fabrica, y no sobra ninguno', () => {
  // Desde la fase 2 tambien el lema, que salio de dentro de `PrincipalLema`.
  assert.deepEqual(
    bloquesPublicablesDe(PRINCIPAL)
      .map((bloque) => bloque.id)
      .sort(),
    Object.keys(FABRICA_DE_PORTADA).sort()
  );
});

test('el encabezado de la tienda se aloja, no se guarda con la portada', () => {
  const encabezado = bloquePorId('encabezado-tienda');

  assert.equal(encabezado.externo, 'configuracion_tienda/encabezado');
  assert.ok(!bloquesPublicablesDe(PRINCIPAL).includes(encabezado));
});

test('las tarjetas con fondo apuntan a su foto o video de hoy', () => {
  assert.deepEqual(bloquePorId('bienvenida').medioDeTarjeta, {
    idTarjeta: 'bienvenida',
    aceptaVideo: false,
  });
  assert.deepEqual(bloquePorId('proxima-actividad').medioDeTarjeta, {
    idTarjeta: 'proxima-actividad',
    aceptaVideo: true,
  });
});

// ----------------------------------------------------------------------
// LA FABRICA PASA SU SANEADO SIN PERDER NADA
// ----------------------------------------------------------------------

Object.entries(FABRICA_DE_PORTADA).forEach(([idBloque, valor]) => {
  test(`el valor de fabrica de "${idBloque}" pasa su saneado tal cual`, () => {
    assert.deepEqual(bloquePorId(idBloque).sanear(copia(valor)), valor);
  });
});

// ----------------------------------------------------------------------
// EL LECTOR: SIN PUBLICAR, LO DE SIEMPRE
// ----------------------------------------------------------------------

const todoDeFabrica = (resuelto) => {
  Object.entries(FABRICA_DE_PORTADA).forEach(([idBloque, valor]) => {
    assert.equal(resuelto[idBloque].origen, ORIGEN_DEL_BLOQUE.codigo, idBloque);
    assert.equal(resuelto[idBloque].contenido, valor, idBloque);
  });
};

test('sin documento publicado, cada bloque es exactamente el de hoy', () => {
  todoDeFabrica(
    resolverPortada({ publicado: null, fabrica: FABRICA_DE_PORTADA, pantalla: PRINCIPAL })
  );
});

test('con cualquier cosa rara en lugar del documento, tambien', () => {
  [undefined, 'texto', 42, [], {}, { bloques: null }, { bloques: [] }, { bloques: 'x' }].forEach(
    (publicado) =>
      todoDeFabrica(
        resolverPortada({ publicado, fabrica: FABRICA_DE_PORTADA, pantalla: PRINCIPAL })
      )
  );
});

test('un bloque publicado con datos rotos vuelve a lo de siempre, no deja un hueco', () => {
  const resuelto = resolverPortada({
    publicado: {
      bloques: {
        'proxima-actividad': { contenido: { titulo: '', lugar: 42 } },
        comunicados: { contenido: [{ clave: 'Con Espacios', titulo: 'x' }] },
        historias: 'no es un objeto',
      },
    },
    fabrica: FABRICA_DE_PORTADA,
    pantalla: PRINCIPAL,
  });

  todoDeFabrica(resuelto);
});

// ----------------------------------------------------------------------
// EL LECTOR: LO PUBLICADO, Y SOLO ESE BLOQUE
// ----------------------------------------------------------------------

test('publicar un bloque cambia ese bloque y ninguno mas', () => {
  const nueva = {
    titulo: 'Investidura Nacional 2026',
    lugar: 'Santiago de los Caballeros',
    fechas: '14 noviembre 2026',
    diasQueFaltan: 59,
    estado: 'Inscripciones abiertas',
  };
  const resuelto = resolverPortada({
    publicado: {
      bloques: {
        'proxima-actividad': {
          contenido: nueva,
          publicadoEn: '2026-09-16T12:00:00.000Z',
          publicadoPor: { uid: 'uid-admin', nombre: 'Administrador' },
        },
      },
    },
    fabrica: FABRICA_DE_PORTADA,
    pantalla: PRINCIPAL,
  });

  assert.equal(resuelto['proxima-actividad'].origen, ORIGEN_DEL_BLOQUE.designer);
  assert.deepEqual(resuelto['proxima-actividad'].contenido, nueva);
  assert.equal(resuelto['proxima-actividad'].publicadoEn, '2026-09-16T12:00:00.000Z');

  Object.entries(FABRICA_DE_PORTADA)
    .filter(([idBloque]) => idBloque !== 'proxima-actividad')
    .forEach(([idBloque, valor]) => {
      assert.equal(resuelto[idBloque].origen, ORIGEN_DEL_BLOQUE.codigo, idBloque);
      assert.equal(resuelto[idBloque].contenido, valor, idBloque);
    });
});

test('lo publicado se pinta limpio: sin espacios sobrantes', () => {
  const resuelto = resolverPortada({
    publicado: {
      bloques: { lema: { contenido: { titulo: '  Siempre listos  ', pie: ' Servir ' } } },
    },
    fabrica: FABRICA_DE_PORTADA,
    pantalla: PRINCIPAL,
  });

  assert.deepEqual(resuelto.lema.contenido, { titulo: 'Siempre listos', pie: 'Servir' });
});

// ----------------------------------------------------------------------
// PREPARAR UNA PUBLICACION
// ----------------------------------------------------------------------

test('publicar firma con quien y cuando, y guarda el contenido ya limpio', () => {
  const publicacion = prepararPublicacion({
    idBloque: 'lema',
    contenido: { titulo: ' Siempre listos ', pie: '' },
    usuario: { uid: 'uid-admin', displayName: 'Roderi Peña' },
    ahora: new Date('2026-09-16T12:00:00.000Z'),
  });

  assert.deepEqual(publicacion, {
    contenido: { titulo: 'Siempre listos', pie: '' },
    // Sin diseño, uno vacio: se pinta como siempre (fase de diseño).
    diseno: {},
    publicadoEn: '2026-09-16T12:00:00.000Z',
    publicadoPor: { uid: 'uid-admin', nombre: 'Roderi Peña' },
  });
});

test('no se publica un bloque que no existe, uno externo ni un contenido invalido', () => {
  assert.throws(() => prepararPublicacion({ idBloque: 'inventado', contenido: {} }));
  assert.throws(() => prepararPublicacion({ idBloque: 'encabezado-tienda', contenido: {} }));
  assert.throws(
    () => prepararPublicacion({ idBloque: 'proxima-actividad', contenido: { titulo: '' } }),
    /Próxima actividad/
  );
});
