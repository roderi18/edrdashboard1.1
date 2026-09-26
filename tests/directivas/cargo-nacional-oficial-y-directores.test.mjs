// ----------------------------------------------------------------------
// "CARGO NACIONAL" DE LA FICHA: UN SOLO "OFICIAL ESPECIAL" Y LOS DIRECTORES.
//
// Qué se rompía:
//  - El desplegable ofrecía las veinte casillas de Oficial Especial como veinte
//    opciones iguales, y React avisaba de claves repetidas ("Encountered two
//    children with the same key, `Oficial Especial`"). Ahora es una opción, y
//    la casilla se decide al guardar.
//  - Director Regional y Director Seccional tenían cargo en el catálogo pero
//    ninguna casilla en su organigrama: no salían en el desplegable y quien los
//    ocupaba no se veía en ninguna directiva.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  casillasDelDiseno,
  valorEnElDesplegable,
  unaSolaOpcionDeOficial,
  OPCION_OFICIAL_ESPECIAL,
  casillaParaOficialEspecial,
} = await import('../../src/utils/oficial-especial-una-opcion.mjs');
const { DIRECTIVA_POSITIONS } = await import('../../src/catalogs/directiva-positions.js');

const oficial = (numero, idMiembro, activo = true) => ({
  idPosicionDirectiva: `nacional-oficial-especial-${numero}`,
  idMiembro,
  activo,
});

test('el desplegable deja un solo "Oficial Especial", en el lugar del primero', () => {
  const opciones = [
    { value: 'nacional-director-nacional', label: 'Director Nacional' },
    { value: 'nacional-oficial-especial-1', label: 'Oficial Especial' },
    { value: 'nacional-oficial-especial-2', label: 'Oficial Especial' },
    { value: 'regional-director-regional', label: 'Director Regional' },
  ];

  assert.deepEqual(
    unaSolaOpcionDeOficial(opciones).map((opcion) => opcion.value),
    ['nacional-director-nacional', OPCION_OFICIAL_ESPECIAL, 'regional-director-regional']
  );
  assert.equal(unaSolaOpcionDeOficial(opciones, { etiqueta: 'Protocolo' })[1].label, 'Protocolo');
});

test('una casilla guardada de Oficial se enseña como la opción única', () => {
  assert.equal(valorEnElDesplegable('nacional-oficial-especial-7'), OPCION_OFICIAL_ESPECIAL);
  assert.equal(valorEnElDesplegable('regional-director-regional'), 'regional-director-regional');
});

test('quien ya es Oficial conserva su casilla', () => {
  assert.deepEqual(
    casillaParaOficialEspecial({
      idMiembro: '5',
      asignaciones: [oficial(1, '9'), oficial(3, '5')],
      casillasCreadas: ['oficial-especial-1', 'oficial-especial-2', 'oficial-especial-3'],
    }),
    { idPosicionDirectiva: 'nacional-oficial-especial-3', nodoACrear: '' }
  );
});

test('si no, la primera casilla dibujada y vacía (una baja no la ocupa)', () => {
  assert.deepEqual(
    casillaParaOficialEspecial({
      idMiembro: '5',
      asignaciones: [oficial(1, '9'), oficial(2, '8', false)],
      casillasCreadas: ['oficial-especial-1', 'oficial-especial-2'],
    }),
    { idPosicionDirectiva: 'nacional-oficial-especial-2', nodoACrear: '' }
  );
});

test('sin casillas vacías, se crea la siguiente; con veinte ocupadas, no cabe', () => {
  assert.deepEqual(
    casillaParaOficialEspecial({
      idMiembro: '5',
      asignaciones: [oficial(1, '9')],
      casillasCreadas: ['oficial-especial-1'],
    }),
    { idPosicionDirectiva: 'nacional-oficial-especial-2', nodoACrear: 'oficial-especial-2' }
  );

  const veinte = Array.from({ length: 20 }, (_, i) => oficial(i + 1, `m${i}`));
  const creadas = Array.from({ length: 20 }, (_, i) => `oficial-especial-${i + 1}`);

  assert.equal(
    casillaParaOficialEspecial({ idMiembro: '5', asignaciones: veinte, casillasCreadas: creadas }),
    null
  );
});

test('sin diseño guardado el organigrama dibuja una sola casilla', () => {
  assert.deepEqual(casillasDelDiseno(null), ['oficial-especial-1']);
  assert.deepEqual(
    casillasDelDiseno({ customNodeLists: { oficialesEspeciales: ['oficial-especial-4'] } }),
    ['oficial-especial-4']
  );
});

// "Coordinador Regional/Seccional" y "Director Regional/Seccional" son el mismo
// cargo: se llama Director, y su asistente Sub-Director. Una sola opción de
// cada uno en el desplegable, la que da el rol (la de sección conserva el id
// `seccional-coordinador-seccional` porque lo llevan las asignaciones guardadas).
const asignablesLlamados = (nivel, nombre) =>
  DIRECTIVA_POSITIONS.filter(
    (posicion) => posicion.nivel === nivel && posicion.asignable && posicion.nombreCargo === nombre
  ).map((posicion) => posicion.idCargo);

test('un solo Director Regional y un solo Director Seccional en el desplegable', () => {
  assert.deepEqual(asignablesLlamados('regional', 'Director Regional'), [
    'regional-director-regional',
  ]);
  assert.deepEqual(asignablesLlamados('seccional', 'Director Seccional'), [
    'seccional-coordinador-seccional',
  ]);
});

test('el asistente es Sub-Director, y "Coordinador Regional/Seccional" ya no existe', () => {
  assert.deepEqual(asignablesLlamados('regional', 'Sub-Director Regional'), [
    'regional-subdirector-regional',
  ]);
  assert.deepEqual(asignablesLlamados('seccional', 'Sub-Director Seccional'), [
    'seccional-sub-coordinador-seccional',
  ]);

  const conCoordinador = DIRECTIVA_POSITIONS.filter((posicion) =>
    /Coordinador (Asistente )?(Regional|Seccional)|Sub-Coordinador|Subdirector (Regional|Seccional)/.test(
      `${posicion.nombreCargo} ${posicion.nombreCargoPadre || ''}`
    )
  );

  assert.deepEqual(conCoordinador, []);
});

test('en una memoria ya guardada, el Director Regional sale en su casilla y no en el título', async () => {
  const { ocupanteHistorico } = await import('../../src/utils/directiva-cuatrienios.mjs');
  // Así se guardó en 2022-2026: con la posición de la caja "Directiva Regional".
  const integrantes = [
    {
      grupo: 'directiva',
      cargo: 'director',
      idPosicionDirectiva: 'regional-directiva-regional',
      idMiembros: '42',
      nombres: 'Ana',
      apellidos: 'Pérez',
    },
  ];

  assert.equal(ocupanteHistorico(integrantes, 'regional', 'director-regional')?.id, '42');
  assert.equal(ocupanteHistorico(integrantes, 'regional', 'directiva-regional'), null);
});
