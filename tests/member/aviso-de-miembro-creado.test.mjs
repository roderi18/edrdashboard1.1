import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const servicio = fs.readFileSync(
  path.join(process.cwd(), 'src/services/notification-service.js'),
  'utf8'
);

test('crear un miembro deja UN aviso, no dos', () => {
  // La cuenta de acceso se crea junto con el miembro: el aviso de "cuenta
  // creada" a los administradores repetia el alta.
  assert.doesNotMatch(servicio, /ya tiene cuenta de acceso/);
  assert.doesNotMatch(servicio, /creo la cuenta de acceso de/);
  assert.match(servicio, /return \[userNotification\]\.filter\(Boolean\);/);
});

test('quien registro lo lee en primera persona; los demas ven quien fue', () => {
  assert.match(servicio, /tituloHtmlPropio: `<p>Se registró a <strong>\$\{escapeHtml\(nombreMiembro\)\}<\/strong> exitosamente\.<\/p>`/);
  assert.match(servicio, /tituloHtml: `<p><strong>\$\{escapeHtml\(actorNombre\)\}<\/strong> registró a \$\{escapeHtml\(nombreMiembro\)\}\.<\/p>`/);
  assert.match(servicio, /if \(esElActor && notificacion\.tituloHtmlPropio\)/);
  assert.match(servicio, /title: construirTituloHtml\(notificacion, usuarioId\)/);
});

test('el nombre de quien actua no sale dos veces seguidas', () => {
  assert.match(servicio, /const componerTituloHtml = \(actorNombre, mensaje\) =>/);
  assert.match(servicio, /texto\.toLowerCase\(\)\.startsWith\(nombre\.toLowerCase\(\)\)/);
  assert.match(servicio, /\? componerTituloHtml\(actorNombre, mensaje\)/);
});
