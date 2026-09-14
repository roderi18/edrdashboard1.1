import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, no una replica: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { primerApellidoDeTexto, primerNombreDeTexto } = await import('src/utils/nombres-de-persona');
const { getLeadershipShortName } = await import('src/utils/leadership-assignments');

const leer = (relativa) => fs.readFileSync(relativa, 'utf8');

// ----------------------------------------------------------------------
// "FAUSTO DEL" NO ES EL NOMBRE DE NADIE.
//
// Donde el nombre se abrevia se cogia la PRIMERA palabra de los apellidos. Con
// los apellidos compuestos de aqui eso deja la particula sola: "Fausto Del
// Rosario Peralta" salia como "Fausto Del", que ni identifica a la persona ni se
// lee como un nombre —parece una frase cortada a la mitad—. Igual con "De los
// Santos", "De la Cruz" y "De Jesus".
//
// Ahora la particula arrastra la palabra que le sigue, y se hace en UN sitio:
// habia tres copias de esta abreviatura y solo una sabia de particulas.
// ----------------------------------------------------------------------

test('la particula se lleva el apellido que le sigue', () => {
  assert.equal(primerApellidoDeTexto('Del Rosario Peralta'), 'Del Rosario');
  assert.equal(primerApellidoDeTexto('De los Santos Perez'), 'De los Santos');
  assert.equal(primerApellidoDeTexto('De la Cruz Martinez'), 'De la Cruz');
  assert.equal(primerApellidoDeTexto('De Jesus Ramirez'), 'De Jesus');
});

test('un apellido normal sigue siendo una palabra', () => {
  // El arreglo no puede llevarse por delante el caso corriente: "Peña Rosario"
  // son dos apellidos, no uno compuesto.
  assert.equal(primerApellidoDeTexto('Peña Rosario'), 'Peña');
  assert.equal(primerApellidoDeTexto('Martinez'), 'Martinez');
  assert.equal(primerApellidoDeTexto(''), '');
  assert.equal(primerApellidoDeTexto(null), '');
});

test('los nombres no llevan particula', () => {
  assert.equal(primerNombreDeTexto('Roderi Daniel'), 'Roderi');
  assert.equal(primerNombreDeTexto('  Fausto  '), 'Fausto');
});

test('la tarjeta del organigrama tampoco corta el apellido', () => {
  assert.equal(
    getLeadershipShortName({ nombres: 'Fausto', apellidos: 'Del Rosario Peralta' }),
    'Fausto Del Rosario'
  );
  assert.equal(
    getLeadershipShortName({ nombres: 'Mario Alejandro', apellidos: 'Peña Felix' }),
    'Mario A. Peña'
  );
  // Sin los campos separados solo queda la cadena entera.
  assert.equal(getLeadershipShortName({ name: 'Fausto Del Rosario' }), 'Fausto Del Rosario');
});

test('las cuatro abreviaturas salen de la misma funcion', () => {
  // Eran cuatro copias y solo una sabia de particulas: la del organigrama si, y las
  // de las notificaciones no. Si alguna vuelve a partir por su cuenta, el fallo
  // reaparece solo en una pantalla y cuesta encontrarlo.
  const consumidores = [
    // La lista de asistencia: es donde se vio "Fausto Del", en la pantalla y en
    // el Excel descargado, que salen del mismo `getMemberName`.
    'src/sections/attendance/view/attendance-quick-view.jsx',
    'src/server/miembros-directorio.js',
    'src/services/solicitudes-cambio-notificaciones-service.js',
    'src/utils/leadership-assignments.js',
  ];

  consumidores.forEach((ruta) => {
    const fuente = leer(ruta);

    assert.match(fuente, /from '(?:src\/utils|\.)\/nombres-de-persona(?:\.js)?'/, ruta);
    assert.doesNotMatch(fuente, /const primero = \(texto\)/, ruta);
    // La abreviatura por la primera palabra es justo la que dejaba "Fausto Del".
    assert.doesNotMatch(fuente, /const getFirstWord =/, ruta);
  });
});
