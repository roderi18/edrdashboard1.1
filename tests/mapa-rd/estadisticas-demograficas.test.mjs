import test from 'node:test';
import assert from 'node:assert/strict';

import {
  edadDe,
  categoriaDe,
  prepararPadron,
  resumirPadron,
} from '../../src/sections/mapa-rd/estadisticas-demograficas.mjs';

test('la categoría sigue la edad actual, incluso en el día del cumpleaños', () => {
  assert.equal(edadDe('2018-09-30', new Date(2026, 8, 29)), 7);
  assert.equal(edadDe('2018-09-29', new Date(2026, 8, 29)), 8);
  assert.equal(
    categoriaDe({ fechaNacimiento: '2018-09-29', idDivision: 1 }, new Date(2026, 8, 29)),
    'pioneros'
  );
  assert.equal(edadDe('2026-02-31'), null);
});

test('los filtros, el mapa y los totales usan el mismo padrón', () => {
  const padron = prepararPadron({
    regiones: [{ idRegion: 1, nombre: 'Región Central' }],
    secciones: [{ idSeccion: 2, idRegion: 1 }],
    iglesias: [{ idIglesia: 3, idSeccion: 2, direccion: 'Santo Domingo, Centro' }],
    destacamentos: [
      { idDestacamento: 4, idIglesia: 3, nombre: 'Alfa', direccion: 'Santo Domingo, Centro' },
      { idDestacamento: 5, idIglesia: 3, nombre: 'Provisional' },
    ],
    miembros: [
      { idMiembros: 10, idDestacamento: 4, fechaNacimiento: '2018-09-29', genero: 'Masculino' },
      { idMiembros: 11, idDestacamento: 4, fechaNacimiento: '2012-09-29', genero: 'Femenino' },
      { idMiembros: 12, idDestacamento: 5, fechaNacimiento: '2018-09-29', genero: 'Masculino' },
    ],
  });
  const total = resumirPadron(padron);
  assert.equal(total.dests.length, 1);
  assert.equal(total.miembros.length, 2);
  assert.equal(total.iglesias, 1);
  assert.equal(total.porRegion.find((r) => r.nombre === 'Región Central').destacamentos, 1);
  const filtrado = resumirPadron(padron, { provincia: 'Santo Domingo', sexo: 'femenino' });
  assert.equal(filtrado.miembros.length, 1);
  assert.equal(filtrado.dests.length, 1);
  assert.equal(filtrado.masculino, 0);
  assert.equal(filtrado.femenino, 1);
});

// El panel de la provincia cuenta los cuatro estatus. Se leen de `status` o de
// `estatusMiembro` (los dos nombres que trae la API) y lo vacío cuenta como
// activo, igual que en la lista de miembros; si no, "Activo" salía corto.
test('el estatus del miembro se cuenta con los sinónimos de la API', () => {
  const padron = prepararPadron({
    regiones: [{ idRegion: 1, nombre: 'Región Central' }],
    secciones: [{ idSeccion: 2, idRegion: 1 }],
    iglesias: [{ idIglesia: 3, idSeccion: 2 }],
    destacamentos: [
      { idDestacamento: 4, idIglesia: 3, nombre: 'Alfa', direccion: 'Santo Domingo, Centro' },
    ],
    miembros: [
      { idMiembros: 1, idDestacamento: 4, status: 'active' },
      { idMiembros: 2, idDestacamento: 4 },
      { idMiembros: 3, idDestacamento: 4, estatusMiembro: 'Inactivo' },
      { idMiembros: 4, idDestacamento: 4, status: 'banned' },
      { idMiembros: 5, idDestacamento: 4, status: 'reclutamiento' },
      { idMiembros: 6, idDestacamento: 4, status: 'fallecido' },
    ],
  });
  assert.deepEqual(resumirPadron(padron).porEstatus, {
    active: 2,
    reclutamiento: 1,
    banned: 2,
    fallecido: 1,
  });
});
