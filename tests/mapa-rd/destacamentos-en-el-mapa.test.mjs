// LOS DESTACAMENTOS EN EL MAPA: UN NÚMERO POR PROVINCIA Y EL TOTAL POR REGIÓN.
//
// El mapa de prueba no decía cuántos destacamentos hay en cada sitio. Ahora,
// como el de la landing, cuenta el padrón entero: la provincia sale de la
// dirección (o de la de su iglesia) y la región es la de verdad (iglesia →
// sección → región), no la del color de la provincia. "Provisional" no cuenta.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparPor,
  destacamentosDelMapa,
  nombreDeDestacamento,
} from '../../src/sections/mapa-rd/destacamentos-del-mapa.mjs';

const base = {
  iglesias: [
    { idIglesia: 1, idSeccion: 10, direccion: 'La Romana, La Romana, , C/ 1' },
    { idIglesia: 2, idSeccion: 20, direccion: '' },
  ],
  secciones: [
    { idSeccion: 10, idRegion: 13 },
    { idSeccion: 20, idRegion: 3 },
  ],
  regiones: [
    { idRegion: 13, nombre: 'Región Este' },
    { idRegion: 3, nombre: 'Región Central' },
  ],
  provinciasDelMapa: ['La Romana', 'Bahoruco', 'Santiago'],
};

test('la provincia sale de la dirección, sin importar tildes; si falta, de la iglesia', () => {
  const [conDireccion, sinDireccion] = destacamentosDelMapa({
    ...base,
    destacamentos: [
      {
        idDestacamento: 1,
        nombre: 'Leones',
        numero: '5',
        idIglesia: 2,
        direccion: 'BAORUCO, Neiba',
      },
      { idDestacamento: 2, nombre: 'Tigres', numero: '', idIglesia: 1, direccion: 'N/A' },
    ],
  });
  assert.equal(conDireccion.provincia, 'Bahoruco');
  assert.equal(sinDireccion.provincia, 'La Romana');
});

test('la región es la de su sección, aunque la provincia sea de otra', () => {
  const [d] = destacamentosDelMapa({
    ...base,
    destacamentos: [{ idDestacamento: 1, nombre: 'Águilas', idIglesia: 2, direccion: 'Santiago' }],
  });
  assert.equal(d.provincia, 'Santiago');
  assert.equal(d.region, 'Región Central');
});

test('"Provisional" no se cuenta y sin provincia no sale en el mapa', () => {
  const lista = destacamentosDelMapa({
    ...base,
    destacamentos: [
      { idDestacamento: 234, nombre: 'Provisional', idIglesia: 1 },
      { idDestacamento: 9, nombre: 'Desconocido', numero: '12', idIglesia: 2, direccion: 'N/A' },
    ],
  });
  assert.deepEqual(
    lista.map((d) => d.id),
    ['9']
  );
  assert.equal(agruparPor(lista, 'provincia').size, 0);
  assert.equal(agruparPor(lista, 'region').get('Región Central').length, 1);
  assert.equal(nombreDeDestacamento(lista[0]), 'Desconocido 12');
});
