import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// CADA PREMIO LLEVA SU PROPIA INSIGNIA, Y TODAS LAS CARPETAS DE PREMIOS SE VEN IGUAL.
//
// Las insignias se buscan por el nombre del premio. Un premio renombrado en el
// catálogo, o una imagen con otro nombre, dejaría la tarjeta con una imagen rota
// sin que nadie lo notara; y buscarlas por número (001.png…) ponía insignias de
// otro premio. Aquí se recorre el catálogo REAL contra los archivos REALES.
// Además, la tarjeta de insignia se pinta en TODA carpeta de premios (la última
// de cada rama) del Sistema de Ascenso y de la Academia, no en las que tienen
// subcarpetas: allí se mezclarían tarjetas de dos alturas.

const { _awards } = await import('src/_mock/_awards.js');
const { CARPETAS_CON_INSIGNIA, imagenDeInsignia, esCarpetaDePremios, nombreDeArchivo } =
  await import('src/utils/insignias-de-premios.mjs');

const aDisco = (ruta) => path.join(process.cwd(), 'public', ...ruta.split('/').filter(Boolean));

for (const [idCarpeta, carpeta] of Object.entries(CARPETAS_CON_INSIGNIA)) {
  const premios = _awards.filter((nodo) => nodo.parentId === idCarpeta && nodo.type !== 'folder');

  test(`${idCarpeta}: es una carpeta de premios del catálogo`, () => {
    assert.ok(premios.length > 0);
    assert.equal(esCarpetaDePremios(idCarpeta), true);
  });

  test(`${idCarpeta}: cada premio encuentra su imagen (o está declarado sin imagen)`, () => {
    const rotos = premios.filter((premio) => {
      const ruta = imagenDeInsignia(idCarpeta, premio.name);
      if (!ruta) return !carpeta.sinImagen?.includes(nombreDeArchivo(premio.name));
      return !fs.existsSync(aDisco(ruta));
    });

    assert.deepEqual(
      rotos.map((premio) => premio.name),
      []
    );
  });

  // Salvo las carpetas que a propósito llevan una sola insignia para todos.
  test(
    `${idCarpeta}: dos premios no comparten insignia`,
    { skip: carpeta.imagenCompartida },
    () => {
      const imagenes = premios
        .map((premio) => imagenDeInsignia(idCarpeta, premio.name))
        .filter(Boolean);

      assert.equal(new Set(imagenes).size, imagenes.length);
    }
  );
}

test('las carpetas de premios son las últimas de cada rama, en los dos sistemas', () => {
  assert.equal(esCarpetaDePremios('seguidores__premios-de-destreza-verde'), true);
  assert.equal(esCarpetaDePremios('pioneros__guias-semanales__senda-de-bronce__trimestre-1'), true);
  assert.equal(esCarpetaDePremios('instructor'), true);
  assert.equal(esCarpetaDePremios('lider-de-destacamento'), true);
});

test('no son carpetas de premios la raíz, los programas ni las que tienen subcarpetas', () => {
  assert.equal(esCarpetaDePremios(''), false);
  assert.equal(esCarpetaDePremios('sistema-de-ascenso'), false);
  assert.equal(esCarpetaDePremios('academia-ministerial'), false);
  // Seguidores tiene subcarpetas (y un manual suelto): tarjetas de carpeta.
  assert.equal(esCarpetaDePremios('seguidores'), false);
  assert.equal(esCarpetaDePremios('no-existe'), false);
});

test('fuera de las carpetas con imágenes no hay imagen (sale el icono en su lugar)', () => {
  assert.equal(imagenDeInsignia('otra-carpeta', 'Academicos'), null);
  assert.equal(
    imagenDeInsignia('exploradores__premios-de-destreza-plata', 'Explorador del Aire'),
    null
  );
});

test('Retos Espirituales: las 6 insignias en secuencia por el número del reto', () => {
  const carpeta = 'exploradores__retos-espirituales';
  const archivo = (nombre) => imagenDeInsignia(carpeta, nombre).split('/').pop();

  assert.equal(archivo('1 La Biblia es única'), '1-azul-claro.webp');
  assert.equal(archivo('2 Mi amigo'), '2-rojo.webp');
  assert.equal(archivo('6 Algo'), '6-amarillo.webp');
  assert.equal(archivo('7 Algo'), '1-azul-claro.webp');
  assert.equal(archivo('12 Palabras de consuelo'), '6-amarillo.webp');
  assert.equal(archivo('150 El último'), '6-amarillo.webp');
});
