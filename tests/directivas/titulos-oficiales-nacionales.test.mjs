// ----------------------------------------------------------------------
// TÍTULOS DE LOS OFICIALES DE LA NACIONAL.
//
// Qué se quería: en la tarjeta "Oficiales Especiales", tres puntos por oficial
// con "Asignar título" y un desplegable con la lista (Protocolo, Diseño y
// artes…). Estas pruebas cuidan que:
//  - un título lo puedan llevar VARIAS personas, sin límite (antes era de una
//    sola y los ocupados salían deshabilitados; se cambió a petición), y cada
//    persona lleve uno solo;
//  - el desplegable diga quiénes lo llevan, sin deshabilitar ninguno;
//  - "Asignar miembros" dé el mismo título a varios de una vez, todos o ninguno;
//  - "Nuevo" del Administrador Global no duplique uno existente;
//  - solo cuente la directiva ACTUAL: quien ya no es Oficial Especial no pinta
//    su título, no cuenta entre quienes lo llevan y no puede recibir uno;
//  - las reglas dejen ampliar la lista solo al Administrador Global y la
//    colección no caiga en el comodín del final.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  tituloDe,
  asignarTitulo,
  opcionesDeTitulo,
  asignarTituloAVarios,
  catalogoDeTitulos,
  agregarTituloAlCatalogo,
  TITULOS_OFICIALES_DE_FABRICA,
} = await import('src/utils/titulos-oficiales-nacionales.mjs');

const catalogo = catalogoDeTitulos();

test('la lista de fábrica trae los siete títulos pedidos, en ese orden', () => {
  assert.deepEqual(catalogo, [...TITULOS_OFICIALES_DE_FABRICA]);
  assert.equal(catalogo.length, 7);
  assert.equal(catalogo[2], 'Protocolo');
});

test('un mismo título lo pueden llevar varios oficiales', () => {
  let asignaciones = asignarTitulo(
    {},
    { idMiembro: '10', titulo: 'Protocolo', catalogo, datos: { nombre: 'Ana' } }
  );

  asignaciones = asignarTitulo(asignaciones, { idMiembro: '11', titulo: 'protocolo ', catalogo });

  assert.equal(tituloDe(asignaciones, '10'), 'Protocolo');
  // Escrito con otra mayúscula, se guarda con el nombre de la lista.
  assert.equal(tituloDe(asignaciones, '11'), 'Protocolo');
});

test('cambiar de título deja libre el anterior y quitarlo borra la asignación', () => {
  let asignaciones = asignarTitulo({}, { idMiembro: '10', titulo: 'Protocolo', catalogo });

  asignaciones = asignarTitulo(asignaciones, {
    idMiembro: '10',
    titulo: 'Diseño y artes',
    catalogo,
  });
  assert.equal(tituloDe(asignaciones, '10'), 'Diseño y artes');
  assert.doesNotThrow(() =>
    asignarTitulo(asignaciones, { idMiembro: '11', titulo: 'Protocolo', catalogo })
  );

  asignaciones = asignarTitulo(asignaciones, { idMiembro: '10', titulo: '', catalogo });
  assert.equal(tituloDe(asignaciones, '10'), '');
});

test('no se asigna un título que no está en la lista', () => {
  assert.throws(
    () => asignarTitulo({}, { idMiembro: '10', titulo: 'Inventado', catalogo }),
    /no está/
  );
});

test('el desplegable no deshabilita ninguno y dice quiénes lo llevan', () => {
  const asignaciones = {
    10: { titulo: 'Diseño y artes', nombre: 'Ana' },
    11: { titulo: 'Protocolo', nombre: 'Luis' },
    12: { titulo: 'Diseño y artes', nombre: 'Rosa' },
  };
  const opciones = opcionesDeTitulo({ catalogo, asignaciones, idMiembro: '11' });

  assert.deepEqual(
    opciones.map((opcion) => opcion.titulo),
    catalogo,
    'en el orden de la lista, sin mover los que tienen gente'
  );
  assert.ok(opciones.every((opcion) => !('deshabilitado' in opcion)));

  const diseno = opciones.find((opcion) => opcion.titulo === 'Diseño y artes');
  assert.deepEqual(
    diseno.personas.map((persona) => persona.nombre),
    ['Ana', 'Rosa']
  );
  assert.equal(opciones.find((opcion) => opcion.titulo === 'Protocolo').propio, true);
});

test('"Asignar miembros": el mismo título a varios, todos o ninguno', () => {
  const vigentes = new Set(['10', '11', '12']);
  const asignaciones = asignarTituloAVarios(
    { 12: { titulo: 'Protocolo', nombre: 'Rosa' } },
    {
      titulo: 'Comisión permanente de estatutos',
      catalogo,
      vigentes,
      personas: [
        { idMiembro: '10', nombre: 'Ana' },
        { idMiembro: '11', nombre: 'Luis' },
        { idMiembro: '12', nombre: 'Rosa' },
      ],
    }
  );

  ['10', '11', '12'].forEach((id) =>
    assert.equal(tituloDe(asignaciones, id), 'Comisión permanente de estatutos')
  );
  assert.equal(asignaciones[11].nombre, 'Luis');

  // Uno que hoy no es Oficial: no se escribe a nadie.
  assert.throws(
    () =>
      asignarTituloAVarios(
        {},
        {
          titulo: 'Protocolo',
          catalogo,
          vigentes,
          personas: [{ idMiembro: '10' }, { idMiembro: '99' }],
        }
      ),
    /directiva actual/
  );
  assert.throws(() => asignarTituloAVarios({}, { titulo: '', catalogo, personas: [] }), /Elige/);
});

test('"Nuevo" suma al final y no deja repetir ni dejar vacío', () => {
  const adicionales = agregarTituloAlCatalogo([], '  Coordinador   de jóvenes ');

  assert.deepEqual(adicionales, ['Coordinador de jóvenes']);
  assert.equal(catalogoDeTitulos(adicionales).at(-1), 'Coordinador de jóvenes');
  assert.throws(() => agregarTituloAlCatalogo(adicionales, 'PROTOCOLO'), /ya está/);
  assert.throws(() => agregarTituloAlCatalogo(adicionales, 'coordinador de jovenes'), /ya está/);
  assert.throws(() => agregarTituloAlCatalogo(adicionales, '   '), /Escribe/);
});

test('las reglas: solo el Administrador Global amplía la lista y no cae en el comodín', () => {
  const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const bloque = reglas.match(
    /match \/titulos_oficiales_nacionales\/\{documento\} \{[\s\S]*?\n {4}\}/
  )?.[0];

  assert.ok(bloque, 'falta el bloque de titulos_oficiales_nacionales');
  assert.match(bloque, /allow write: if esAdministradorGlobal\(\)/);
  assert.match(bloque, /request\.resource\.data\.get\('adicionales', \[\]\)/);
  assert.match(reglas, /coleccion != 'titulos_oficiales_nacionales'/);
});

test('solo cuenta la directiva actual: el título de un ex oficial no se pinta ni se cuenta', () => {
  const asignaciones = { 10: { titulo: 'Protocolo', nombre: 'Ana' } };
  const vigentes = new Set(['11']);

  assert.equal(tituloDe(asignaciones, '10', vigentes), '');
  assert.equal(tituloDe(asignaciones, '10'), 'Protocolo');

  const protocolo = opcionesDeTitulo({ catalogo, asignaciones, idMiembro: '11', vigentes }).find(
    (opcion) => opcion.titulo === 'Protocolo'
  );
  assert.equal(protocolo.personas.length, 0);

  assert.throws(
    () => asignarTitulo({}, { idMiembro: '10', titulo: 'Protocolo', catalogo, vigentes }),
    /directiva actual/
  );
});

test('"Asignar miembros" está en la tarjeta y reutiliza las casillas vacías antes de crear', () => {
  const vista = readFileSync(
    new URL('../../src/sections/national/leadership/national-leadership-view.jsx', import.meta.url),
    'utf8'
  );

  assert.match(vista, /esNodoComitesEspeciales && puedeAsignarOficiales/);
  assert.match(vista, /Asignar miembros/);
  // Nunca en una directiva pasada.
  assert.match(vista, /const puedeAsignarOficiales = puedeAsignarTitulo;/);
  assert.match(vista, /const puedeAsignarTitulo = !historico && /);
  // Primero las vacías, luego las que falten, y el título a todos al final.
  assert.match(vista, /const casillas = \[\.\.\.vacias, \.\.\.libres\];/);
  assert.match(vista, /guardarTituloDeVariosOficiales\(/);
});

test('los Oficiales Especiales se acumulan en su tarjeta, sin casillas debajo', () => {
  const vista = readFileSync(
    new URL('../../src/sections/national/leadership/national-leadership-view.jsx', import.meta.url),
    'utf8'
  );

  // El árbol se dibuja sin la cadena de casillas `oficial-especial-N`.
  assert.match(vista, /obtenerDiagramaNacionalConOficiales\(\[\]\)/);
  assert.match(vista, /puedeAgregarOficialEspecial=\{false\}/);
  // Quitar a uno se hace desde la franja "Ver más".
  assert.match(vista, /onQuitarOficial=\{quitarOficial\}/);
});
