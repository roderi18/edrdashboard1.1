// ----------------------------------------------------------------------
// EL DESTACAMENTO DESTACADO PUEDE LLEVAR FOTO.
//
// La tarjeta "Destacamento destacado de la semana" solo tenía nombre, región,
// miembros y valoración. Ahora el Designer deja subir una foto, opcional y solo
// imagen. Sin foto el bloque queda idéntico (la portada no cambia hasta que se
// publica); una foto rota devuelve el bloque entero a fábrica.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { bloquePorId } = await import('src/utils/everest/bloques.mjs');

const sanear = bloquePorId('destacamento-destacado').sanear;
const base = {
  nombre: 'Destacamento 52 — Halcones del Este',
  region: 'Región Central',
  miembros: 38,
  valoracion: 4.9,
};
const foto = {
  url: 'https://firebasestorage.googleapis.com/v0/b/x/o/everest%2Ffoto.webp?alt=media',
  tipo: 'imagen',
};

test('sin foto el bloque queda igual que siempre', () => {
  assert.deepEqual(sanear(base), base);
});

test('con una foto válida se guarda', () => {
  assert.deepEqual(sanear({ ...base, foto }).foto, foto);
});

test('un video o una dirección sin https no valen: el bloque vuelve a fábrica', () => {
  assert.equal(sanear({ ...base, foto: { ...foto, tipo: 'video' } }), null);
  assert.equal(
    sanear({ ...base, foto: { url: 'http://ejemplo.com/a.jpg', tipo: 'imagen' } }),
    null
  );
});

test('la tarjeta solo pinta la foto si viene, y el editor la ofrece', () => {
  const leer = (ruta) => fs.readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

  assert.match(leer('src/sections/principal/principal-lateral.jsx'), /!!destacado\.foto\?\.url &&/);
  assert.match(
    leer('src/sections/everest/editores/editores-simples.jsx'),
    /cambiar\('foto', valor\)/
  );
});
