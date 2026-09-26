// ----------------------------------------------------------------------
// "AGREGAR CASILLA": CASILLAS Y CONTENEDORES AÑADIDOS DESDE EL ORGANIGRAMA.
//
// Qué se pedía y qué se rompía:
//  - Un cargo nuevo exigía tocar código: el árbol de cada nivel y el catálogo
//    de la ficha son listas fijas. Ahora el Administrador Global añade una
//    casilla (se asigna) o un contenedor (agrupa) con su nombre.
//  - Es GLOBAL POR NIVEL: la de una sección sale en todas las secciones, y
//    también en la ficha del miembro ("Cargo Nacional" o "Nivel posición en tu
//    Destacamento"), porque árbol y catálogo son la misma cosa.
//  - El destacamento casa casilla y asignación por cargo + división; un mapa
//    hecho al cargar el módulo no conocía las añadidas después.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  sanearCasilla,
  TIPOS_CASILLA,
  crearIdCasilla,
  arbolConCasillas,
  casillasVigentes,
  posicionDeCasilla,
  arbolesConCasillas,
  esCargoDeCasillaDest,
  nodosParaElegirPadre,
} = await import('../../src/utils/casillas-personalizadas.mjs');
const {
  DIRECTIVA_POSITIONS,
  getOrganigramaDestSlot,
  posicionDirectivaPorId,
  registrarCasillasPersonalizadas,
  versionDeCasillasPersonalizadas,
} = await import('../../src/catalogs/directiva-positions.js');
const { SECTIONAL_LEADERSHIP_DATA } = await import('../../src/catalogs/directiva-diagrams.js');
const { buscarPosicionPorNodo } = await import('../../src/utils/leadership-assignments.js');

const casilla = (datos = {}) => ({
  id: 'cabc123',
  nivel: 'seccional',
  nombre: 'Coordinador de Música',
  tipo: TIPOS_CASILLA.casilla,
  idNodoPadre: 'coordinador-seccional',
  orden: 1,
  activo: true,
  ...datos,
});

const idsDe = (nodo) => (nodo ? [nodo.id, ...(nodo.children || []).flatMap(idsDe)] : []);

test('el id de una casilla nueva no choca con los de fábrica ni lleva datos de nadie', () => {
  const id = crearIdCasilla(1_790_000_000_000);

  assert.match(id, /^c[a-z0-9]+$/);
  assert.equal(
    DIRECTIVA_POSITIONS.some((posicion) => posicion.idCargo.includes(id)),
    false
  );
});

test('una ficha sin nombre, de un nivel que no existe o con división fuera del destacamento no sirve', () => {
  assert.ok(sanearCasilla(casilla()));
  assert.equal(sanearCasilla(casilla({ nombre: ' ' })), null);
  assert.equal(sanearCasilla(casilla({ nombre: 'x'.repeat(61) })), null);
  assert.equal(sanearCasilla(casilla({ nivel: 'zona' })), null);
  assert.equal(sanearCasilla(casilla({ tipo: 'otro' })), null);
  assert.equal(sanearCasilla(casilla({ division: 'exploradores' })), null);
  assert.ok(
    sanearCasilla(
      casilla({ nivel: 'destacamento', division: 'exploradores', idNodoPadre: 'pastor' })
    )
  );
  // Espacios de sobra fuera: "Coordinador   de Música" es el mismo nombre.
  assert.equal(
    sanearCasilla(casilla({ nombre: '  Coordinador   de Música ' })).nombre,
    'Coordinador de Música'
  );
});

test('la casilla cuelga de su padre en el árbol del nivel, sin tocar el de fábrica', () => {
  const antes = JSON.stringify(SECTIONAL_LEADERSHIP_DATA);
  const arbol = arbolConCasillas(SECTIONAL_LEADERSHIP_DATA, 'seccional', [casilla()]);
  const director = arbol.children.find((nodo) => nodo.id === 'coordinador-seccional');

  assert.ok(
    director.children.some(
      (nodo) => nodo.id === 'casilla-cabc123' && nodo.role === 'Coordinador de Música'
    )
  );
  assert.equal(JSON.stringify(SECTIONAL_LEADERSHIP_DATA), antes);
  // Una casilla de otro nivel no se cuela.
  const regional = arbolConCasillas(SECTIONAL_LEADERSHIP_DATA, 'seccional', [
    casilla({ nivel: 'regional' }),
  ]);
  assert.equal(idsDe(regional).includes('casilla-cabc123'), false);
});

test('un contenedor es caja de estructura y lo añadido dentro cuelga de él', () => {
  const contenedor = casilla({
    id: 'ccont01',
    nombre: 'Comité de Música',
    tipo: TIPOS_CASILLA.contenedor,
  });
  const dentro = casilla({
    id: 'cdent01',
    nombre: 'Pianista',
    idNodoPadre: 'casilla-ccont01',
    orden: 2,
  });
  const arbol = arbolConCasillas(SECTIONAL_LEADERSHIP_DATA, 'seccional', [dentro, contenedor]);
  const director = arbol.children.find((nodo) => nodo.id === 'coordinador-seccional');
  const caja = director.children.find((nodo) => nodo.id === 'casilla-ccont01');

  assert.equal(caja.isDivision, true);
  assert.equal(caja.name, 'Comité de Música');
  assert.deepEqual(
    caja.children.map((nodo) => nodo.id),
    ['casilla-cdent01']
  );
  assert.equal(posicionDeCasilla(sanearCasilla(contenedor)).asignable, false);
  assert.equal(posicionDeCasilla(sanearCasilla(dentro)).asignable, true);
});

test('una casilla cuyo padre ya no existe se sigue viendo, colgada de la raíz', () => {
  const huerfana = casilla({ idNodoPadre: 'nodo-que-no-existe' });
  const arbol = arbolConCasillas(SECTIONAL_LEADERSHIP_DATA, 'seccional', [huerfana]);

  assert.ok(arbol.children.some((nodo) => nodo.id === 'casilla-cabc123'));
});

test('una casilla quitada deja de dibujarse y de ofrecerse, pero su nombre se sigue sabiendo', () => {
  const quitada = casilla({ activo: false });

  assert.deepEqual(casillasVigentes([quitada]), []);
  assert.equal(
    idsDe(arbolConCasillas(SECTIONAL_LEADERSHIP_DATA, 'seccional', [quitada])).includes(
      'casilla-cabc123'
    ),
    false
  );

  registrarCasillasPersonalizadas([quitada]);
  const posicion = posicionDirectivaPorId('seccional-casilla-cabc123');
  assert.equal(posicion?.nombreCargo, 'Coordinador de Música');
  assert.equal(posicion.asignable, false);
  registrarCasillasPersonalizadas([]);
});

test('registrada, la casilla está en el catálogo que usan la ficha y los organigramas', () => {
  const version = versionDeCasillasPersonalizadas();

  registrarCasillasPersonalizadas([casilla()]);

  const posicion = buscarPosicionPorNodo(DIRECTIVA_POSITIONS, 'seccional', 'casilla-cabc123');
  assert.equal(posicion?.idCargo, 'seccional-casilla-cabc123');
  assert.equal(posicion.nombreCargo, 'Coordinador de Música');
  assert.equal(posicion.asignable, true);
  assert.ok(versionDeCasillasPersonalizadas() > version);

  // Registrar la misma lista otra vez no cambia nada (ni vacía la caché de cargos).
  const siguiente = versionDeCasillasPersonalizadas();
  registrarCasillasPersonalizadas([casilla()]);
  assert.equal(versionDeCasillasPersonalizadas(), siguiente);

  // Registrar otra lista sustituye la anterior sin duplicar ni tocar las de fábrica.
  const deFabrica = DIRECTIVA_POSITIONS.filter((item) => !item.personalizada).length;
  registrarCasillasPersonalizadas([casilla({ id: 'cotra01', nombre: 'Otra' })]);
  assert.equal(posicionDirectivaPorId('seccional-casilla-cabc123'), null);
  assert.equal(DIRECTIVA_POSITIONS.filter((item) => item.personalizada).length, 1);
  assert.equal(DIRECTIVA_POSITIONS.filter((item) => !item.personalizada).length, deFabrica);

  registrarCasillasPersonalizadas([]);
});

test('en el destacamento la casilla casa con su asignación por cargo y división', () => {
  const deExploradores = casilla({
    id: 'cdest01',
    nivel: 'destacamento',
    nombre: 'Guía de Música',
    idNodoPadre: 'lider-grupo-exploradores',
    division: 'exploradores',
  });

  registrarCasillasPersonalizadas([deExploradores]);

  const slot = getOrganigramaDestSlot({ idCargo: 'destacamento-casilla-cdest01' });
  assert.deepEqual(slot, { cargo: 'casilla_cdest01', division: 'exploradores', orden: 1 });
  assert.equal(esCargoDeCasillaDest(slot.cargo), true);

  const [, grupo] = arbolesConCasillas(
    [
      { id: 'pastor', role: 'Pastor', children: [] },
      {
        id: 'division-exploradores',
        isDivision: true,
        children: [
          {
            id: 'lider-grupo-exploradores',
            role: 'Líder',
            asignacionOrganigrama: { cargo: 'lider_grupo', division: 'exploradores', orden: 1 },
          },
        ],
      },
    ],
    'destacamento',
    [deExploradores]
  );
  const nodo = grupo.children[0].children[0];
  assert.equal(nodo.id, 'casilla-cdest01');
  assert.deepEqual(nodo.asignacionOrganigrama, slot);

  registrarCasillasPersonalizadas([]);
});

test('"Debajo de" nombra cada nodo sin ambigüedad: la división por su nombre y sus cargos con ella', () => {
  const opciones = nodosParaElegirPadre([
    { id: 'pastor', role: 'Pastor', children: [] },
    {
      id: 'division-pioneros',
      name: 'Pioneros',
      role: '8 a 10 años',
      isDivision: true,
      children: [
        {
          id: 'lider-grupo-pioneros',
          role: 'Líder de Grupo',
          asignacionOrganigrama: { cargo: 'lider_grupo', division: 'pioneros', orden: 1 },
        },
      ],
    },
  ]);

  assert.deepEqual(
    opciones.map(({ id, nombre, division }) => ({ id, nombre, division })),
    [
      { id: 'pastor', nombre: 'Pastor', division: null },
      { id: 'division-pioneros', nombre: 'Pioneros', division: 'pioneros' },
      { id: 'lider-grupo-pioneros', nombre: 'Líder de Grupo (Pioneros)', division: 'pioneros' },
    ]
  );
});

test('quitar un contenedor sube lo que colgaba de él a su sitio, no a la raíz', () => {
  const contenedor = casilla({
    id: 'ccont02',
    nombre: 'Comité de Música',
    tipo: TIPOS_CASILLA.contenedor,
    activo: false,
  });
  const dentro = casilla({ id: 'cdent02', nombre: 'Pianista', idNodoPadre: 'casilla-ccont02' });
  const arbol = arbolConCasillas(SECTIONAL_LEADERSHIP_DATA, 'seccional', [contenedor, dentro]);
  const director = arbol.children.find((nodo) => nodo.id === 'coordinador-seccional');

  assert.ok(director.children.some((nodo) => nodo.id === 'casilla-cdent02'));
  assert.equal(idsDe(arbol).includes('casilla-ccont02'), false);
  assert.equal(
    arbol.children.some((nodo) => nodo.id === 'casilla-cdent02'),
    false,
    'no se va a la raíz'
  );
});
