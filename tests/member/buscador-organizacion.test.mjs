// ----------------------------------------------------------------------
// EL BUSCADOR DE LA CABECERA ENCUENTRA A LA GENTE.
//
// Qué se rompía: el buscador solo conocía pantallas, artículos y premios. Para
// dar con un miembro había que saber su destacamento y buscarlo en esa lista, y
// un nombre escrito con una letra de más no encontraba a nadie.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { buscarPorNombre, armarIndiceDeOrganizacion } =
  await import('../../src/utils/buscador-organizacion.mjs');

const indice = armarIndiceDeOrganizacion({
  miembros: [
    {
      idMiembros: 323,
      nombres: 'Stalin',
      apellidos: 'Peralta',
      codigoMiembro: 'EDR-10001',
      idDestacamento: 52,
      telefono: '809',
      fechaNacimiento: '1982-11-26',
    },
    { idMiembros: 7, nombres: 'María José', apellidos: 'Gómez', idDestacamento: 52 },
    { idMiembros: 8, nombres: 'Juan', apellidos: 'Pérez', idDestacamento: 9 },
  ],
  destacamentos: [
    { idDestacamento: 52, nombre: 'Halcones Del Este', numero: '52', idIglesia: 4 },
    { idDestacamento: 9, nombre: 'Tribu de Judá', numero: '18', idIglesia: 5 },
  ],
  iglesias: [
    { idIglesia: 4, idSeccion: 1 },
    { idIglesia: 5, idSeccion: 1 },
  ],
  secciones: [{ idSeccion: 1, nombre: 'Este Oriental I', idRegion: 3 }],
  regiones: [{ idRegion: 3, nombre: 'Región Central' }],
});

const nombres = (lista) => lista.map((elemento) => elemento.nombre);

test('el miembro lleva su destacamento, y nada de sus datos personales', () => {
  const stalin = indice.miembros.find((miembro) => miembro.id === '323');

  assert.equal(stalin.nombre, 'Stalin Peralta');
  assert.equal(stalin.destacamento, 'Halcones Del Este 52');
  assert.equal(stalin.codigo, 'EDR-10001');
  assert.deepEqual(Object.keys(stalin).sort(), [
    'codigo',
    'destacamento',
    'id',
    'idDestacamento',
    'nombre',
  ]);
});

test('encuentra por el principio, sin tildes y por apellido', () => {
  const miembros = indice.miembros;

  assert.deepEqual(nombres(buscarPorNombre({ elementos: miembros, consulta: 'stal' })), [
    'Stalin Peralta',
  ]);
  assert.deepEqual(nombres(buscarPorNombre({ elementos: miembros, consulta: 'maria gomez' })), [
    'María José Gómez',
  ]);
  assert.deepEqual(nombres(buscarPorNombre({ elementos: miembros, consulta: 'perez' })), [
    'Juan Pérez',
  ]);
});

test('encuentra los parecidos: una letra de más, de menos o cambiada', () => {
  const miembros = indice.miembros;

  assert.deepEqual(nombres(buscarPorNombre({ elementos: miembros, consulta: 'Estalin' })), [
    'Stalin Peralta',
  ]);
  assert.deepEqual(nombres(buscarPorNombre({ elementos: miembros, consulta: 'peraltta' })), [
    'Stalin Peralta',
  ]);
});

test('todas las palabras tienen que coincidir, y lo exacto va primero', () => {
  const miembros = indice.miembros;

  assert.deepEqual(buscarPorNombre({ elementos: miembros, consulta: 'juan gomez' }), []);
  assert.deepEqual(nombres(buscarPorNombre({ elementos: miembros, consulta: 'edr-10001' })), [
    'Stalin Peralta',
  ]);
});

test('destacamentos, secciones y regiones, con de dónde cuelgan', () => {
  assert.deepEqual(buscarPorNombre({ elementos: indice.destacamentos, consulta: 'halcones' }), [
    { id: '52', nombre: 'Halcones Del Este 52', detalle: 'Este Oriental I' },
  ]);
  assert.deepEqual(buscarPorNombre({ elementos: indice.secciones, consulta: 'oriental' }), [
    { id: '1', nombre: 'Este Oriental I', detalle: 'Región Central' },
  ]);
  assert.equal(buscarPorNombre({ elementos: indice.regiones, consulta: 'central' }).length, 1);
});

test('la ruta del índice exige sesión', async () => {
  const ruta = await readFile(
    new URL('../../src/app/api/buscador/organizacion/route.js', import.meta.url),
    'utf8'
  );

  assert.match(ruta, /const \{ error: sinSesion \} = await identificarConSesionRest\(req\);/);
  assert.match(ruta, /if \(sinSesion\) return sinSesion;/);
});
