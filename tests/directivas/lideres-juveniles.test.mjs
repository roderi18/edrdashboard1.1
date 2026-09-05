import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// LA DIRECTIVA DE LIDERES JUVENILES.
//
// Cada casilla del cuadro tiene que existir en el catalogo de cargos: si no, se
// puede asignar a alguien y la asignacion no aparece en ninguna parte, que es
// justo lo que pasaba antes con los cargos que ningun organigrama dibujaba.
//
// Y dos cargos se repiten dentro del mismo cuadro —hay dos Asistentes de Grupo
// y tres Guias de Patrulla—, asi que lo unico que los separa es el ORDEN de la
// casilla. Si dos nodos cayeran en la misma, asignar a uno pisaria al otro.

const { DIRECTIVA_POSITIONS, getOrganigramaDestSlot } = await import(
  'src/catalogs/directiva-positions.js'
);
const { construirArbolJuvenil, DIVISIONES_JUVENILES } = await import(
  'src/sections/dest/leadership/dest-youth-leadership-data.js'
);

const nodosDe = (nodo, acumulado = []) => {
  acumulado.push(nodo);
  (nodo.children || []).forEach((hijo) => nodosDe(hijo, acumulado));

  return acumulado;
};

const claveCasilla = ({ cargo, division, orden }) => [cargo, division, orden].join('|');

const posicionDeCasilla = (casilla) =>
  DIRECTIVA_POSITIONS.find((position) => {
    const slot = getOrganigramaDestSlot(position);

    return (
      slot &&
      slot.cargo === casilla.cargo &&
      slot.division === casilla.division &&
      slot.orden === casilla.orden
    );
  });

test('las cuatro divisiones tienen su cuadro, con dieciseis casillas cada uno', () => {
  assert.equal(DIVISIONES_JUVENILES.length, 4);

  // 1 Lider + 2 Asistentes + 1 Juvenil + 1 Guia Mayor + 5 de su equipo
  // + 3 Guias de Patrulla + 3 Auxiliares.
  DIVISIONES_JUVENILES.forEach(({ id }) => {
    assert.equal(nodosDe(construirArbolJuvenil(id)).length, 16);
  });
});

test('cada casilla del cuadro existe en el catalogo de cargos', () => {
  DIVISIONES_JUVENILES.forEach(({ id }) => {
    nodosDe(construirArbolJuvenil(id)).forEach((nodo) => {
      const posicion = posicionDeCasilla(nodo.asignacionOrganigrama);

      assert.ok(posicion, `sin cargo en el catalogo: ${nodo.id}`);
    });
  });
});

test('los dos asistentes y las tres patrullas ocupan casillas distintas', () => {
  const claves = DIVISIONES_JUVENILES.flatMap(({ id }) =>
    nodosDe(construirArbolJuvenil(id)).map((nodo) => claveCasilla(nodo.asignacionOrganigrama))
  );

  assert.equal(new Set(claves).size, claves.length);
});

test('el Lider de Grupo y su primer Asistente son los MISMOS de la Directiva Local', () => {
  // El cuadro juvenil continua hacia abajo lo que la Directiva Local ya dibuja:
  // quien este puesto alla tiene que salir puesto aqui.
  const arbol = construirArbolJuvenil('exploradores');
  const lider = arbol.asignacionOrganigrama;
  const primerAsistente = arbol.children[0].asignacionOrganigrama;

  assert.deepEqual(lider, { cargo: 'lider_grupo', division: 'exploradores', orden: 1 });
  assert.deepEqual(primerAsistente, {
    cargo: 'lider_asistente_grupo',
    division: 'exploradores',
    orden: 1,
  });
});

test('los cargos nuevos no pisan el orden de las asignaciones ya guardadas', () => {
  // El `orden` del catalogo forma parte del id del documento de asignacion, asi
  // que reutilizar uno dejaria huerfana la asignacion que ya lo tuviera.
  const porDivision = new Map();

  DIRECTIVA_POSITIONS.filter((p) => p.nivel === 'destacamento' && p.division).forEach((p) => {
    const usados = porDivision.get(p.division) || new Set();

    assert.ok(!usados.has(p.orden), `orden repetido en ${p.division}: ${p.orden}`);
    usados.add(p.orden);
    porDivision.set(p.division, usados);
  });
});
