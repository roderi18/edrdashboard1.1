import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// LOS SELECTORES DE MIEMBROS BUSCAN COMO EL BUSCADOR DE LA CABECERA.
//
// "Asignar miembro" y los demas selectores usaban el filtro de MUI, que solo
// encuentra el texto seguido: "perez juan" o "Estalin" no traian a nadie,
// mientras el buscador de la cabecera si los encontraba.

const { filtrarPorNombreComoElBuscador } = await import(
  '../../src/utils/buscador-organizacion.mjs'
);

const filtrar = filtrarPorNombreComoElBuscador(
  (o) => o.nombre,
  (o) => o.codigo
);

const opciones = [
  { nombre: 'Juan Pérez Gómez', codigo: 'EDR-10001' },
  { nombre: 'Stalin Peralta', codigo: 'EDR-10002' },
  { nombre: 'María del Carmen Ruiz', codigo: 'EDR-10003' },
];

const nombres = (consulta) => filtrar(opciones, { inputValue: consulta }).map((o) => o.nombre);

test('sin nada escrito sale la lista tal cual', () => {
  assert.deepEqual(filtrar(opciones, { inputValue: '' }), opciones);
});

test('las palabras en cualquier orden y sin tildes', () => {
  assert.deepEqual(nombres('perez juan'), ['Juan Pérez Gómez']);
  assert.deepEqual(nombres('maria carmen'), ['María del Carmen Ruiz']);
});

test('con una errata tambien lo encuentra', () => {
  assert.deepEqual(nombres('Estalin'), ['Stalin Peralta']);
});

test('por codigo de miembro', () => {
  assert.deepEqual(nombres('10003'), ['María del Carmen Ruiz']);
});

test('sin tope: no se corta en seis como la cabecera', () => {
  const muchos = Array.from({ length: 20 }, (_, i) => ({ nombre: `Ana ${i}` }));
  assert.equal(filtrar(muchos, { inputValue: 'ana' }).length, 20);
});
