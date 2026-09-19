// ----------------------------------------------------------------------
// PINES DEL PERFIL.
//
// Qué se quería: un apartado de pines como el de cintas y medallas (perfil,
// lápiz del Administrador Global y EXPLORA Designer), con los pines ENCIMA de
// las cintas, centrados. Estas pruebas cuidan que:
//  - el catálogo sea la carpeta `pines` (cualquier imagen, sin tocar código) y
//    apunte a ESA carpeta, no a la de medallas, con la que comparte la lectura;
//  - en el perfil salgan en una sola fila y como mucho tres;
//  - el orden global mande y lo desconocido se descarte;
//  - al volver a guardar se conserve la fecha de los que ya estaban;
//  - los añadidos en el Designer se separen como pines, no como medallas.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  RUTA_PINES,
  MAXIMO_PINES,
  ordenarPines,
  disponerPinesEnFilas,
  construirPinesAsignados,
  catalogoDePinesDesdeArchivos,
} = await import('src/utils/pines-perfil.mjs');
const { RUTA_MEDALLAS, catalogoDesdeArchivos } = await import('src/utils/medallas-perfil.mjs');
const { separarInsignias } = await import('src/utils/insignias-personalizadas.mjs');

const ARCHIVOS = ['pin-instructor.webp', 'instructor-juvenil.webp', 'LEEME.md'];

test('el catálogo es la carpeta de pines y apunta a ella', () => {
  const catalogo = catalogoDePinesDesdeArchivos(ARCHIVOS);

  assert.deepEqual(
    catalogo.map((pin) => pin.id),
    ['instructor-juvenil', 'pin-instructor']
  );
  assert.equal(catalogo[0].nombre, 'Instructor juvenil');
  assert.ok(catalogo.every((pin) => pin.src.startsWith(`${RUTA_PINES}/`)));
  // Las medallas siguen en su carpeta: compartir la lectura no las movió.
  assert.ok(catalogoDesdeArchivos(ARCHIVOS)[0].src.startsWith(`${RUTA_MEDALLAS}/`));
});

test('en el perfil: una sola fila y como mucho tres', () => {
  assert.equal(MAXIMO_PINES, 3);
  assert.deepEqual(disponerPinesEnFilas(['a', 'b']), [['a', 'b']]);
  assert.deepEqual(disponerPinesEnFilas(['a', 'b', 'c', 'd']), [['a', 'b', 'c']]);
  assert.deepEqual(disponerPinesEnFilas([]), []);
});

test('manda el orden global y lo que ya no existe se descarta', () => {
  const catalogo = catalogoDePinesDesdeArchivos(ARCHIVOS);

  assert.deepEqual(
    ordenarPines(['instructor-juvenil', 'pin-instructor', 'borrado'], catalogo, [
      'pin-instructor',
      'instructor-juvenil',
    ]),
    ['pin-instructor', 'instructor-juvenil']
  );
});

test('al volver a guardar se conserva la fecha de los que ya estaban', () => {
  const anteriores = [{ id: 'pin-instructor', origen: 'prueba', asignadaEn: '2026-01-01' }];
  const pines = construirPinesAsignados(
    anteriores,
    ['pin-instructor', { id: 'instructor-juvenil' }, 'pin-instructor'],
    '2026-09-19'
  );

  assert.deepEqual(pines, [
    { id: 'pin-instructor', origen: 'prueba', asignadaEn: '2026-01-01' },
    { id: 'instructor-juvenil', origen: 'prueba', asignadaEn: '2026-09-19' },
  ]);
});

test('un pin añadido en el Designer se separa como pin, detrás de los de la carpeta', () => {
  const { pines, medallas } = separarInsignias([
    {
      id: 'p100',
      tipo: 'pin',
      nombre: 'Pin nuevo',
      descripcion: 'Se da a quien…',
      src: 'https://firebasestorage.googleapis.com/v0/b/erd.appspot.com/o/everest%2Finsignias-pin%2Fp100.webp?alt=media',
    },
  ]);

  assert.equal(medallas.length, 0);
  assert.equal(pines[0].id, 'p100');
  assert.equal(pines[0].numero, Number.MAX_SAFE_INTEGER);
  assert.equal(pines[0].srcPequena, pines[0].src);
});
