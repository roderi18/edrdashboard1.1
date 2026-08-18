import test from 'node:test';
import assert from 'node:assert/strict';

import { claveNodo } from '../../src/utils/leadership-assignments.js';
import {
  DIRECTIVA_POSITIONS,
  getOrganigramaDestSlot,
  DIRECTIVA_POSITIONS_BY_LEVEL,
} from '../../src/catalogs/directiva-positions.js';
import {
  recogerIdsDeNodos,
  NODOS_DIAGRAMA_POR_NIVEL,
  REGIONAL_LEADERSHIP_DATA,
  NATIONAL_LEADERSHIP_DATA,
  SECTIONAL_LEADERSHIP_DATA,
} from '../../src/catalogs/directiva-diagrams.js';

// ----------------------------------------------------------------------
// El desplegable "Cargo Nacional" de la ficha del miembro ofrece los cargos
// asignables del catalogo. Si ofrece uno que ningun organigrama dibuja, se puede
// asignar un cargo que despues no aparece en ninguna Directiva.
//
// Regresion: se ofrecian "Secretario Seccional", "Tesorero Seccional", "Director
// Seccional", "Subdirector Seccional", "Director Regional", "Tesorero Ejecutivo"
// y "Director Ministerios Infantiles", ninguno con casilla en su organigrama.
// ----------------------------------------------------------------------

const asignablesDe = (nivel) =>
  (DIRECTIVA_POSITIONS_BY_LEVEL[nivel] || []).filter((position) => position.asignable);

for (const nivel of ['nacional', 'regional', 'seccional']) {
  test(`todo cargo asignable de ${nivel} tiene casilla en su organigrama`, () => {
    const claves = NODOS_DIAGRAMA_POR_NIVEL[nivel];
    const huerfanos = asignablesDe(nivel).filter(
      (position) => !claves.has(claveNodo(position.idNodoDiagrama))
    );

    assert.deepEqual(
      huerfanos.map((position) => position.nombreCargo),
      [],
      `cargos sin casilla en el organigrama de ${nivel}`
    );
  });
}

test('todo cargo asignable de destacamento tiene casilla en el organigrama', () => {
  const huerfanos = asignablesDe('destacamento').filter(
    (position) => !getOrganigramaDestSlot(position)
  );

  assert.deepEqual(huerfanos.map((position) => position.nombreCargo), []);
});

test('los cargos que el organigrama dibuja pero el catalogo no ofrece son de estructura', () => {
  // A la inversa: un nodo del diagrama sin posicion asignable solo se admite si
  // el catalogo lo declara como caja de estructura (o no lo conoce en absoluto,
  // como los titulos decorativos). Sirve para detectar un cargo NUEVO en el
  // diagrama que nadie dio de alta en el catalogo.
  const arboles = {
    nacional: NATIONAL_LEADERSHIP_DATA,
    regional: REGIONAL_LEADERSHIP_DATA,
    seccional: SECTIONAL_LEADERSHIP_DATA,
  };

  for (const [nivel, arbol] of Object.entries(arboles)) {
    const posicionesDelNivel = DIRECTIVA_POSITIONS_BY_LEVEL[nivel] || [];

    recogerIdsDeNodos(arbol).forEach((idNodo) => {
      const position = posicionesDelNivel.find(
        (item) => claveNodo(item.idNodoDiagrama) === claveNodo(idNodo)
      );

      assert.ok(position, `el nodo "${idNodo}" de ${nivel} no existe en el catalogo`);
    });
  }
});

test('las posiciones no asignables conservan su idCargoApi para poder traducirlas', () => {
  // Dejar de ser asignable no puede borrar el puente con la API: un miembro que
  // ya arrastre ese cargo tiene que seguir viendo su nombre.
  const secretarioSeccional = DIRECTIVA_POSITIONS.find(
    (position) => position.idCargo === 'seccional-secretario-seccional'
  );

  assert.equal(secretarioSeccional.asignable, false);
  assert.equal(secretarioSeccional.idCargoApi, 13);
});
