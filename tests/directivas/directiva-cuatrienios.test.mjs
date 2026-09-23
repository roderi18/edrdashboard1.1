// ----------------------------------------------------------------------
// LA DIRECTIVA NACIONAL SE GUARDA POR CUATRIENIO, COMO FOTO FIJA.
//
// Qué se quería evitar: la Directiva Nacional solo existía como "la de hoy". Al
// cambiar un cargo, el anterior desaparecía sin dejar rastro, y la organización
// perdía quién había servido en 2022-2026. Ahora cada cuatrienio queda guardado
// con la persona, el cargo y la foto de ENTONCES, y estas reglas deciden:
//  - qué cuatrienio corre en cada fecha (el 22/08/2026 ya es 2026-2030);
//  - cómo se lee el listado de la organización (vacantes fuera, una persona un
//    cargo, vale la primera posición, el ex comandante es para siempre);
//  - que el organigrama de la historia pinta la foto guardada y no la de perfil.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  planDelListado,
  cargosDelNivel,
  buscarPorNombre,
  posicionDelCargo,
  cargoDePosicion,
  cuatrienioDeFecha,
  ocupanteHistorico,
  esCuatrienioCerrado,
  integrantesDeEntidad,
  NIVELES_CUATRIENIO,
} = await import('../../src/utils/directiva-cuatrienios.mjs');
const { DIRECTIVA_2022_2026 } = await import('../../src/catalogs/directiva-2022-2026.mjs');
const { tieneCasillaEnOrganigrama } = await import('../../src/catalogs/directiva-diagrams.js');
const { DIRECTIVA_POSITIONS } = await import('../../src/catalogs/directiva-positions.js');

const plan = planDelListado(DIRECTIVA_2022_2026, '2022-2026');

test('el 22 de agosto de 2026 termina 2022-2026 y empieza 2026-2030 el mismo día', () => {
  assert.equal(cuatrienioDeFecha('2022-08-20')?.id, '2022-2026');
  assert.equal(cuatrienioDeFecha('2026-08-21')?.id, '2022-2026');
  assert.equal(cuatrienioDeFecha('2026-08-22')?.id, '2026-2030');
  assert.equal(cuatrienioDeFecha('2022-08-19'), null);
  assert.equal(esCuatrienioCerrado('2022-2026', '2026-09-18'), true);
  assert.equal(esCuatrienioCerrado('2026-2030', '2026-09-18'), false);
});

test('una casilla vacante no se agrega', () => {
  assert.equal(plan.vacantes, 4);
  assert.ok(plan.integrantes.every((fila) => fila.nombres));
  assert.equal(
    integrantesDeEntidad(plan.integrantes, {
      nivel: NIVELES_CUATRIENIO.seccional,
      nombre: 'Santiago',
    }).length,
    0
  );
});

test('una persona repetida se queda con su primera posición y la otra casilla queda vacía', () => {
  const ignorados = plan.ignorados.map((fila) => `${fila.nombre} | ${fila.posicion}`).sort();

  assert.deepEqual(ignorados, [
    'Carmen María Lorenzo | Sub-Director Seccional · Oeste Occidental',
    'Federico Muñoz | Secretario Regional · Región Este',
    'Héctor Luis Ramírez | Coordinador de Adiestramiento · Este Oriental I',
    'Josué Rodríguez | Director Seccional · Oeste Central',
    'Nehemías de León | Coordinador de Adiestramiento · Región Norte',
    'Ruddyney Alcántara | Director Seccional · San Juan–Elías Piña',
  ]);

  const carmen = plan.integrantes.filter((fila) => fila.nombres === 'Carmen María');

  assert.equal(carmen.length, 1);
  assert.equal(carmen[0].regionNombre, 'Región Central');
  assert.equal(carmen[0].cargo, 'produccion');
});

test('ex comandante nacional no cuenta como posición: se suma al cargo que ya tenga', () => {
  const mirke = plan.integrantes.filter((fila) => fila.nombres === 'Mirke');

  assert.deepEqual(mirke.map((fila) => fila.grupo).sort(), ['directiva', 'ex_comandantes']);
  assert.equal(plan.integrantes.filter((fila) => fila.grupo === 'ex_comandantes').length, 7);
});

test('una casilla con persona y sin cargo conocido entra como Provisional', () => {
  const { integrantes } = planDelListado(
    {
      regiones: [
        { nombre: 'Región X', directiva: [['cargo-que-no-existe', 'Ana', 'Pérez']], secciones: [] },
      ],
    },
    '2022-2026'
  );

  assert.equal(integrantes[0].cargo, 'provisional');
  assert.equal(integrantes[0].cargoNombre, 'Provisional');
});

test('los ids salen de la casilla: son únicos y repetir la carga escribe los mismos', () => {
  const ids = plan.integrantes.map((fila) => fila.id);

  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    planDelListado(DIRECTIVA_2022_2026, '2022-2026').integrantes.map((f) => f.id),
    ids
  );
});

test('cada cargo de región y sección cae en una casilla de su organigrama de hoy', () => {
  for (const nivel of [NIVELES_CUATRIENIO.regional, NIVELES_CUATRIENIO.seccional]) {
    for (const cargo of cargosDelNivel(nivel).filter((item) => item.id !== 'provisional')) {
      const idPosicion = posicionDelCargo(nivel, cargo.id);
      const posicion = DIRECTIVA_POSITIONS.find((item) => item.idCargo === idPosicion);

      assert.ok(posicion, `${nivel}/${cargo.id} sin posición`);
      assert.ok(tieneCasillaEnOrganigrama(nivel, posicion.idNodoDiagrama), `${nivel}/${cargo.id}`);
      // Y de vuelta: la foto de la directiva de hoy reconoce el cargo.
      assert.equal(cargoDePosicion(nivel, idPosicion), cargo.id);
    }
  }
});

test('el organigrama de la historia pinta la foto guardada, no la de perfil', () => {
  const filas = [
    {
      nivel: 'seccional',
      cargo: 'director',
      idPosicionDirectiva: posicionDelCargo('seccional', 'director'),
      idMiembros: '77',
      nombres: 'Pedro',
      apellidos: 'Sepúlveda',
      fotoUrl: 'https://copia/directiva-historica/2022-2026/pedro.webp',
    },
  ];

  const ocupante = ocupanteHistorico(filas, 'seccional', 'coordinador-seccional');

  assert.equal(ocupante.avatarUrl, 'https://copia/directiva-historica/2022-2026/pedro.webp');
  assert.equal(ocupante.idMiembros, '77');
  assert.equal(ocupanteHistorico(filas, 'seccional', 'capellan-seccional'), null);
});

test('las secciones del listado se reconocen en el padrón por nombre o alias', () => {
  const padron = [
    { id: '3', name: 'Región Central' },
    { id: '5', sectionalName: 'San Francisco de Macorís' },
  ];
  const nombre = (fila) => fila.name || fila.sectionalName;

  assert.equal(buscarPorNombre(padron, 'Central', { obtenerNombre: nombre })?.id, '3');
  assert.equal(
    buscarPorNombre(padron, 'San Francisco', {
      alias: ['San Francisco de Macorís'],
      obtenerNombre: nombre,
    })?.id,
    '5'
  );
  assert.equal(buscarPorNombre(padron, 'San Pedro', { obtenerNombre: nombre }), null);
});

// EL TELEFONO NO SE ENSEÑA EN LA MEMORIA DE UN CUATRIENIO.
//
// La fila de un cuatrienio pasado pinta el nombre y la foto CONGELADOS de
// entonces, pero el telefono se sacaba del padron de HOY: un dato de ahora
// colado en una instantanea de antes. Se quita con `undefined` porque es lo
// unico que la celda omite; con cadena vacia saldria "Tel. desconocido".
test('en la memoria de un cuatrienio la fila no enseña el telefono', () => {
  const fila = readFileSync(
    new URL('../../src/sections/national/national-table-row.jsx', import.meta.url),
    'utf8'
  );

  // `integrante` solo lo llevan las filas del cuatrienio guardado.
  assert.match(fila, /const esMemoriaDeCuatrienio = Boolean\(row\.integrante\);/);
  assert.match(fila, /subtitle=\{esMemoriaDeCuatrienio \? undefined : formatPhoneNumber\(phoneNumber\)\}/);
  assert.match(
    fila,
    /subtitleHref=\{esMemoriaDeCuatrienio \? undefined : getPhoneHref\(phoneNumber\)\}/
  );
});

// EL PERFIL DE UN CUATRIENIO PASADO NO ES LA FICHA DE UN MIEMBRO.
//
// Vive bajo /level/member/<id>/edit porque reutiliza esa pantalla, pero es la
// instantanea de quien ocupo un cargo. Se le pintaba encima la cabecera de
// miembro —el titulo "Miembro", unas migas con el id del integrante en vez de
// un nombre y cinco pestañas que ahi no llevan a nada—, y el menu lateral
// saltaba de "Consejo Nacional" a "Miembros". Lo delatan los dos parametros.
test('el perfil de un cuatrienio no lleva la cabecera ni las pestañas del miembro', () => {
  const layout = readFileSync(
    new URL('../../src/sections/member/layout/member-edit-layout.jsx', import.meta.url),
    'utf8'
  );

  assert.match(layout, /searchParams\?\.get\('cuatrienio'\) && searchParams\?\.get\('integrante'\)/);
  // Los hijos a pelo: PerfilDirectivaNacional ya trae su propio contenedor.
  assert.match(layout, /if \(esPerfilHistorico\) \{\s*\n\s*return children;/);
});

test('en el perfil de un cuatrienio el menu se queda en Consejo Nacional', () => {
  const menu = readFileSync(
    new URL('../../src/layouts/nav-config-dashboard.jsx', import.meta.url),
    'utf8'
  );

  // Hacen falta LOS DOS parametros: una ficha normal con ?cuatrienio= suelto
  // sigue siendo de Miembros.
  assert.match(
    menu,
    /searchParams\?\.get\('cuatrienio'\) && searchParams\?\.get\('integrante'\)/
  );
  assert.match(menu, /marcaActiva: esDelConsejoNacional/);
  assert.match(menu, /marcaActiva: esDeMiembros/);
  // Y "Miembros" se apaga justo cuando el Consejo Nacional se enciende.
  assert.match(menu, /const esDeMiembros = \(contexto\) =>[\s\S]*?&& !esPerfilDeCuatrienio\(contexto\)/);
});
