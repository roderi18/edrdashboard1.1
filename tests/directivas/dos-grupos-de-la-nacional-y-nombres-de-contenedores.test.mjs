// ----------------------------------------------------------------------
// LA NACIONAL TIENE DOS GRUPOS, Y LOS CONTENEDORES SE RENOMBRAN EN SU MENÚ.
//
// Qué se pedía:
//  - En la Directiva Nacional, lo que sale del Consejo Ejecutivo es un grupo y lo
//    que sale del Consejo Nacional es otro: una persona puede tener un cargo de
//    cada uno. Juan Carlos García es Vicepresidente del Consejo Nacional y
//    también Coordinador Nacional de Adiestramiento. Dentro de un mismo grupo
//    sigue valiendo un cargo por persona. Antes darle el segundo le quitaba el
//    primero (o pedía "traspasarlo").
//  - Cambiar el nombre de un contenedor desde los tres puntitos, en los cuatro
//    organigramas, y que valga para todo el nivel.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const { sonCargosCompatibles, esDelConsejoEjecutivo } =
  await import('../../src/utils/cargos-compatibles.mjs');
const { DIRECTIVA_POSITIONS } = await import('../../src/catalogs/directiva-positions.js');
const { posicionDeCasilla } = await import('../../src/utils/casillas-personalizadas.mjs');

// El Vicepresidente es una casilla añadida que cuelga de la raíz (Concilio).
const vicepresidente = posicionDeCasilla({
  id: 'cmurfek5d',
  nivel: 'nacional',
  nombre: 'Vicepresidente del Consejo Nacional',
  tipo: 'casilla',
  idNodoPadre: 'asambleas-de-dios',
  activo: true,
});
const posiciones = [...DIRECTIVA_POSITIONS, vicepresidente];
const nacional = (idPosicionDirectiva) => ({ nivel: 'nacional', idPosicionDirectiva });

test('qué cuelga del Consejo Ejecutivo y qué del Consejo Nacional', () => {
  assert.equal(esDelConsejoEjecutivo('nacional-coordinador-adiestramiento', posiciones), true);
  assert.equal(
    esDelConsejoEjecutivo('nacional-oficiales-adiestramientos-especiales', posiciones),
    true
  );
  assert.equal(esDelConsejoEjecutivo('nacional-sub-director-nacional', posiciones), true);
  assert.equal(esDelConsejoEjecutivo(vicepresidente.idCargo, posiciones), false);
  assert.equal(esDelConsejoEjecutivo('nacional-capellan-nacional', posiciones), false);
});

test('un cargo de cada grupo puede ir junto (Juan Carlos García)', () => {
  assert.equal(
    sonCargosCompatibles(
      nacional(vicepresidente.idCargo),
      nacional('nacional-coordinador-adiestramiento'),
      posiciones
    ),
    true
  );
});

test('dos del mismo grupo, no', () => {
  assert.equal(
    sonCargosCompatibles(
      nacional('nacional-coordinador-promocion'),
      nacional('nacional-coordinador-adiestramiento'),
      posiciones
    ),
    false
  );
});

test('compatible no es traspaso: se suma sin preguntar ni quitar el otro', () => {
  const hook = readFileSync(
    new URL('../../src/sections/common/use-leadership-assignments.js', import.meta.url),
    'utf8'
  );

  assert.match(hook, /if \(cargoQueOcupa && !yaEstaEnEsteNodo && !seSuma\)/);
});

test('los contenedores de los cuatro organigramas tienen "Cambiar nombre" en sus tres puntitos', () => {
  const vistas = {
    nacional: 'src/sections/national/leadership/national-leadership-view.jsx',
    regional: 'src/sections/regional/leadership/regional-leadership-view.jsx',
    seccional: 'src/sections/sectional/leadership/sectional-leadership-view.jsx',
    destacamento: 'src/app/dashboard/level/dest/[id]/edit/leadership/page.jsx',
  };

  Object.entries(vistas).forEach(([nivel, ruta]) => {
    assert.match(
      readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8'),
      new RegExp(`<MenuDeContenedor nivel="${nivel}"`),
      ruta
    );
  });

  const menu = readFileSync(
    new URL('../../src/sections/common/menu-de-contenedor.jsx', import.meta.url),
    'utf8'
  );

  assert.match(
    menu,
    /renombrarContenedorDeDirectiva\(\{ nivel, idNodo, nombre: limpio, usuario: user \}\)/
  );
  assert.match(menu, /if \(!isAdminGlobal\(user\) \|\| !idNodo\) return null;/);
});
