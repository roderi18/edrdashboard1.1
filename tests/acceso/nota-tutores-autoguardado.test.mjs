import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (ruta) => fs.readFileSync(path.join(process.cwd(), ruta), 'utf8');

test('la nota se autoguarda después de dejar de escribir', () => {
  const formulario = leer('src/sections/member/parents/member-edit-parents-form.jsx');

  assert.match(formulario, /window\.setTimeout\(async \(\) =>/);
  assert.match(formulario, /guardarNotaTutoresDelMiembro\(\{/);
  assert.match(formulario, /}, 700\)/);
  assert.match(formulario, /Guardado automáticamente/);
});

test('al abandonar la página se envía cualquier nota pendiente con keepalive', () => {
  const formulario = leer('src/sections/member/parents/member-edit-parents-form.jsx');
  const servicio = leer('src/services/tutores-service.js');

  assert.match(formulario, /addEventListener\('pagehide', guardarAntesDeSalir\)/);
  assert.match(formulario, /keepalive: true/);
  assert.match(servicio, /keepalive,/);
});

test('la API de la nota exige padres.editar y registra auditoría', () => {
  const ruta = leer('src/app/api/miembros/tutores/nota/route.js');

  assert.match(ruta, /exigirPermisoDeCargoRest\(req, \['padres\.editar'\]\)/);
  assert.match(ruta, /runTransaction/);
  assert.match(ruta, /COLECCION_AUDITORIA/);
});

test('la colección de notas no queda accesible directamente al navegador', () => {
  const reglas = leer('firestore.rules');

  assert.match(
    reglas,
    /match \/notas_tutores_miembros\/\{idMiembro\}[\s\S]*?allow read, write: if false;/
  );
});
