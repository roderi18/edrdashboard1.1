// ----------------------------------------------------------------------
// "QUITAR DEL ORGANIGRAMA" DESDE EL LÁPIZ, PARA TODO EL NIVEL.
//
// Qué se pedía: quitar una casilla o un contenedor de la Jerarquía desde el
// panel del lápiz, globalmente (todas las regiones, todas las secciones…). Las
// añadidas ya se podían quitar; las de fábrica viven en el código, así que se
// guarda una ficha `oculta` y el árbol del nivel deja de dibujar ese nodo. Lo
// que colgaba de él sube a su sitio, y "Devolver" lo trae de vuelta.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { TIPOS_CASILLA, sanearCasilla, casillasVigentes, arbolConCasillas, casillasDelCatalogo } =
  await import('../../src/utils/casillas-personalizadas.mjs');

const ARBOL = {
  id: 'raiz',
  name: 'Consejo',
  children: [
    {
      id: 'secretario-nacional',
      role: 'Secretario Nacional',
      children: [{ id: 'ayudante', role: 'Ayudante' }],
    },
    { id: 'tesorero', role: 'Tesorero' },
  ],
};

const oculta = (idNodo, extra = {}) => ({
  id: 'cabcdef1',
  nivel: 'nacional',
  nombre: 'Secretario Nacional',
  tipo: TIPOS_CASILLA.oculta,
  idNodoPadre: idNodo,
  activo: true,
  ...extra,
});

const ids = (nodo) => [nodo.id, ...(nodo.children || []).flatMap(ids)];

test('un nodo de fábrica quitado no se dibuja y lo que colgaba sube a su sitio', () => {
  const arbol = arbolConCasillas(ARBOL, 'nacional', [oculta('secretario-nacional')]);

  assert.deepEqual(
    arbol.children.map((hijo) => hijo.id),
    ['ayudante', 'tesorero']
  );
  // El árbol de fábrica no se toca.
  assert.equal(ARBOL.children[0].id, 'secretario-nacional');
});

test('es por nivel, y devolverlo (inactiva) lo trae de vuelta', () => {
  assert.ok(
    ids(arbolConCasillas(ARBOL, 'regional', [oculta('secretario-nacional')])).includes(
      'secretario-nacional'
    )
  );
  assert.ok(
    ids(
      arbolConCasillas(ARBOL, 'nacional', [oculta('secretario-nacional', { activo: false })])
    ).includes('secretario-nacional')
  );
});

test('la raíz no se quita', () => {
  assert.equal(arbolConCasillas(ARBOL, 'nacional', [oculta('raiz')]).id, 'raiz');
});

test('la ficha oculta ni se dibuja como casilla ni entra en el catálogo', () => {
  const lista = [oculta('secretario-nacional')];

  assert.equal(casillasVigentes(lista).length, 0);
  assert.equal(casillasDelCatalogo(lista).length, 0);
  // Una añadida se quita a sí misma: no se oculta con una ficha.
  assert.equal(sanearCasilla(oculta('casilla-cabcdef9')), null);
});

test('el panel del lápiz lo ofrece en los cuatro organigramas y las reglas lo admiten', () => {
  const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

  [
    'src/sections/national/leadership/national-leadership-view.jsx',
    'src/sections/regional/leadership/regional-leadership-view.jsx',
    'src/sections/sectional/leadership/sectional-leadership-view.jsx',
    'src/app/dashboard/level/dest/[id]/edit/leadership/page.jsx',
  ].forEach((ruta) => assert.match(leer(ruta), /<QuitarCasillaDelNivel/, ruta));
  assert.match(leer('firestore.rules'), /tipo in \['casilla', 'contenedor', 'oculta'\]/);
});

// ----------------------------------------------------------------------
// "Ya hay un cargo 'Tesorero Ejecutivo'": el catálogo trae cargos de fábrica
// sin casilla en el organigrama, y contaban como repetidos aunque nadie los
// viera. Solo cuentan los que se dibujan.
// ----------------------------------------------------------------------

const { nombreDeCargoEnUso } = await import('../../src/utils/casillas-personalizadas.mjs');

const POSICIONES = [
  { nivel: 'nacional', nombreCargo: 'Tesorero Ejecutivo', idNodoDiagrama: 'tesorero-ejecutivo' },
  { nivel: 'nacional', nombreCargo: 'Secretario Nacional', idNodoDiagrama: 'secretario-nacional' },
  { nivel: 'nacional', nombreCargo: 'Zonas', personalizada: true, idCasilla: 'czonas01' },
];
const dibujados = new Set(['secretario-nacional']);
const tieneCasilla = (nivel, id) => dibujados.has(id);
const usado = (nombre, extra = {}) =>
  nombreDeCargoEnUso({ posiciones: POSICIONES, nivel: 'nacional', nombre, tieneCasilla, ...extra });

test('un cargo de fábrica sin casilla no impide crear uno con su nombre', () => {
  assert.equal(usado('Tesorero Ejecutivo'), false);
  assert.equal(usado('secretario nacional'), true);
  assert.equal(usado('Zonas'), true);
});

test('tampoco lo impide uno quitado del nivel, ni la propia casilla al renombrarla', () => {
  assert.equal(usado('Secretario Nacional', { lista: [oculta('secretario-nacional')] }), false);
  assert.equal(usado('Zonas', { idCasillaPropia: 'czonas01' }), false);
});
