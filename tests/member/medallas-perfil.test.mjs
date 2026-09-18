// ----------------------------------------------------------------------
// LAS MEDALLAS SON LA CARPETA, Y SU ORDEN LO DECIDE EL DESIGNER.
//
// Qué se pidió: las medallas existen igual que las cintas —en EXPLORA Designer y
// en los perfiles— y cualquier imagen que se deje en
// `public/parches/Cintas y medallas/medallas` aparece en la aplicación sin tocar
// código. Qué no se puede romper: una imagen que se quita no deja un hueco en los
// perfiles, una nueva nunca se pierde por no estar en el orden guardado, y la
// subcarpeta "en proceso" no se cuela.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ordenarMedallas,
  moverMedallaEnOrden,
  catalogoDesdeArchivos,
  disponerMedallasEnFilas,
  normalizarOrdenDeMedallas,
  construirMedallasAsignadas,
} from '../../src/utils/medallas-perfil.mjs';

const catalogo = catalogoDesdeArchivos([
  '10-medalla-proyectos-misiones.webp',
  '2-medalla-de-valentia.webp',
  '1-medalla-al-valor.webp',
  'national-leadership-award.webp',
  'medalOfExcellent-mejorada.webp',
  'national-leadership-award-small.webp',
  'DIRECTRICES.md',
  'en proceso',
]);
const ids = (lista) => lista.map((medalla) => medalla.id);

test('cualquier imagen de la carpeta es una medalla; lo demás no', () => {
  assert.deepEqual(ids(catalogo), [
    '1-medalla-al-valor',
    '2-medalla-de-valentia',
    '10-medalla-proyectos-misiones',
    'medalOfExcellent-mejorada',
    'national-leadership-award',
  ]);
  assert.equal(catalogo[0].nombre, 'Medalla al valor');
  assert.equal(catalogo[3].nombre, 'Medal of excellent mejorada');
  assert.equal(catalogo[0].src, '/parches/Cintas%20y%20medallas/medallas/1-medalla-al-valor.webp');
  // La `-small` no es otra medalla: es la que se pinta pequeña en el perfil.
  assert.equal(
    catalogo[4].srcPequena,
    '/parches/Cintas%20y%20medallas/medallas/national-leadership-award-small.webp'
  );
  assert.equal(catalogo[0].srcPequena, catalogo[0].src);
});

test('el orden guardado manda; lo nuevo va al final y lo borrado se descarta', () => {
  const orden = normalizarOrdenDeMedallas(
    ['national-leadership-award', 'ya-no-existe', '1-medalla-al-valor'],
    catalogo
  );

  assert.deepEqual(orden.slice(0, 2), ['national-leadership-award', '1-medalla-al-valor']);
  assert.equal(orden.length, catalogo.length);
  assert.equal(orden.includes('ya-no-existe'), false);
});

test('las medallas de un miembro salen en el orden global, sin las que ya no existen', () => {
  const orden = ['national-leadership-award', '2-medalla-de-valentia'];

  assert.deepEqual(
    ordenarMedallas(
      [{ id: '2-medalla-de-valentia' }, 'national-leadership-award', 'borrada'],
      catalogo,
      orden
    ),
    ['national-leadership-award', '2-medalla-de-valentia']
  );
});

test('arrastrar pone una medalla en el lugar de otra', () => {
  assert.deepEqual(
    moverMedallaEnOrden([], catalogo, 'national-leadership-award', '1-medalla-al-valor').slice(
      0,
      2
    ),
    ['national-leadership-award', '1-medalla-al-valor']
  );
});

test('como mucho tres, en una fila; y asignar conserva la fecha', () => {
  assert.deepEqual(disponerMedallasEnFilas(['a', 'b', 'c', 'd', 'e']), [['a', 'b', 'c']]);
  assert.deepEqual(disponerMedallasEnFilas(['a', 'b']), [['a', 'b']]);

  const [previa, nueva] = construirMedallasAsignadas(
    [{ id: 'a', origen: 'prueba', asignadaEn: '2026-01-01' }],
    ['a', 'b'],
    '2026-09-18'
  );

  assert.equal(previa.asignadaEn, '2026-01-01');
  assert.equal(nueva.asignadaEn, '2026-09-18');
});

// El manifiesto se regenera antes de cada build: una imagen nueva en la carpeta
// sale en producción sin que nadie tenga que acordarse de nada.
test('cada build regenera el manifiesto de producción', async () => {
  const paquete = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8')
  );

  assert.equal(paquete.scripts.prebuild, 'node scripts/generar-manifiesto-medallas.mjs');
});

test('las medallas solo las escribe el Administrador Global y no caen en el comodín', async () => {
  const reglas = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');

  assert.match(
    reglas,
    /match \/medallas_miembros\/\{idMiembros\} \{\s*allow read: if esUsuarioDelSistema\(\);\s*allow write: if esAdministradorGlobal\(\);/
  );
  assert.match(reglas, /coleccion != 'medallas_miembros'/);
});

// ----------------------------------------------------------------------
// LOS EFECTOS: que la medalla no se vea siempre estática, sin perder lo guardado.
// ----------------------------------------------------------------------

test('sin efecto guardado, la medalla se mueve con el soplo y brilla con el destello', async () => {
  const { configuracionDeMedallas } = await import('../../src/utils/medallas-perfil.mjs');
  const config = configuracionDeMedallas(['a', { id: 'b', efectoMovimiento: 'pendulo' }]);

  assert.deepEqual(config.get('a'), { efectoMovimiento: 'soplo', efectoBrillo: 'destello' });
  assert.deepEqual(config.get('b'), { efectoMovimiento: 'pendulo', efectoBrillo: 'destello' });
  assert.equal(
    configuracionDeMedallas([{ id: 'c', efectoBrillo: 'xx' }]).get('c').efectoBrillo,
    'destello'
  );
});

test('los efectos se guardan con cada medalla y un id repetido no se duplica', async () => {
  const { construirMedallasAsignadas } = await import('../../src/utils/medallas-perfil.mjs');
  const medallas = construirMedallasAsignadas(
    [{ id: 'a', origen: 'prueba', asignadaEn: '2026-01-01' }],
    [{ id: 'a', efectoMovimiento: 'latido', efectoBrillo: 'resplandor' }, 'a', 'b'],
    '2026-09-18'
  );

  assert.equal(medallas.length, 2);
  assert.equal(medallas[0].asignadaEn, '2026-01-01');
  assert.equal(medallas[0].efectoMovimiento, 'latido');
  assert.equal(medallas[0].efectoBrillo, 'resplandor');
});

test('cada medalla arranca su ciclo en un punto distinto y siempre el mismo', async () => {
  const { desfaseDeMedalla } = await import('../../src/utils/medallas-perfil.mjs');

  assert.equal(desfaseDeMedalla('1-medalla-al-valor'), desfaseDeMedalla('1-medalla-al-valor'));
  assert.notEqual(
    desfaseDeMedalla('1-medalla-al-valor'),
    desfaseDeMedalla('2-medalla-de-valentia')
  );
  assert.ok(desfaseDeMedalla('x') >= 0 && desfaseDeMedalla('x') < 1);
});

test('quien pide menos movimiento en su sistema no ve las medallas moverse', async () => {
  const componente = await readFile(
    new URL('../../src/components/insignias-perfil/medallas-de-miembro.jsx', import.meta.url),
    'utf8'
  );

  assert.match(componente, /@media \(prefers-reduced-motion: reduce\)/);
});
