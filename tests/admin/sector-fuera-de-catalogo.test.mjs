// ----------------------------------------------------------------------
// EL SECTOR QUE NO ESTÁ EN EL CATÁLOGO SE VE Y SE CONSERVA.
//
// Qué se rompía: la landing envió "Los Mina" para el destacamento 278 y se
// guardó bien en la iglesia ("Santo Domingo, Santo Domingo Este, Los Mina,
// Calle Primera #1, Las Enfermeras"), pero `barrios.json` solo tiene "Los Mina
// Norte" y "Los Mina Sur": la ficha lo buscaba por nombre exacto, no lo
// encontraba y el campo Sector salía vacío, como si no se hubiera recibido.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const { esSectorLibre, nombreDeSector, opcionDeSectorLibre, sectorIdDesdeNombre } =
  await import('../../src/utils/sector-fuera-de-catalogo.mjs');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');
const catalogo = [
  { id: 12488, nombre: 'Los Mina Norte' },
  { id: 12489, nombre: 'Los Mina Sur' },
];

test('un sector del catálogo se elige por su id, como siempre', () => {
  assert.equal(sectorIdDesdeNombre('Los Mina Norte', catalogo), '12488');
  assert.equal(nombreDeSector('12488', catalogo), 'Los Mina Norte');
});

test('uno que no está se conserva como texto y vuelve igual al guardar', () => {
  const id = sectorIdDesdeNombre('Los Mina', catalogo);

  assert.equal(id, 'texto:Los Mina');
  assert.equal(esSectorLibre(id), true);
  assert.equal(nombreDeSector(id, catalogo), 'Los Mina');
  assert.deepEqual(opcionDeSectorLibre(id), { id: 'texto:Los Mina', nombre: 'Los Mina' });
  assert.equal(opcionDeSectorLibre('12488'), null);
  assert.equal(sectorIdDesdeNombre('', catalogo), '');
});

test('la ficha, el desplegable y el guardado usan esa misma regla', () => {
  assert.match(
    leer('src/sections/dest/dest-create-edit-form.jsx'),
    /sectorIdDesdeNombre\(sectorName, sectores\)/
  );
  assert.match(
    leer('src/components/location/location-select.jsx'),
    /opcionDeSectorLibre\(watch\('sectorId'\)\)/
  );
  assert.match(
    leer('src/services/church-service.js'),
    /nombreDeSector\(data\?\.sectorId, sectores\)/
  );
});

test('mayúsculas, tildes y comas no hacen otro sector', async () => {
  const { claveDeSector } = await import('../../src/utils/sector-fuera-de-catalogo.mjs');

  assert.equal(sectorIdDesdeNombre('los cacaos', [{ id: 162, nombre: 'Los Cacaos' }]), '162');
  assert.equal(
    claveDeSector('Los Cantines, la altagracia'),
    claveDeSector('Los Cantines la Altagracia')
  );
  assert.equal(claveDeSector('Antonio Guzmán'), 'antonio guzman');
});

test('la carga de la landing quita las comas del sector y el catálogo trae los recibidos', () => {
  assert.ok(
    leer('src/services/actualizaciones-destacamentos-service.js').includes(
      "String(direccion.sector ?? '')"
    )
  );

  const barrios = JSON.parse(leer('src/data/barrios.json'));

  ['Los Mina', 'Vista Mar', 'Villa de San Luis', 'Mirador del Ozama', 'Los Guaricanos'].forEach(
    (nombre) =>
      assert.ok(
        barrios.some((b) => b.nombre === nombre),
        nombre
      )
  );
});
