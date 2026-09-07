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

test('los "cuenta creada" de administrador que ya estaban escritos no se enseñan', () => {
  // Dejaron de crearse, pero los viejos siguen en Firestore y salen mancos
  // —"La cuenta de  fue creada correctamente"—, porque aquel aviso no guardaba
  // el nombre en sus metadatos.
  assert.match(
    servicio,
    /if \(notificacion\.tipoNotificacion === 'cuenta_creada' && rolDestinatario === 'admin'\) \{\s*\n\s*return false;/
  );
  // El del propio dueño de la cuenta se queda.
  assert.match(servicio, /if \(rolDestinatario === 'usuario'\) return !usuarioEsAdmin;/);
});

test('quien registro lo lee en primera persona; los demas ven quien fue', () => {
  // La frase propia se arma AL PINTARLA, con el nombre que el aviso ya guarda en
  // sus metadatos: asi tambien se leen bien los que ya estaban escritos, que no
  // traian ninguna version propia dentro.
  assert.match(servicio, /const construirTituloPropioDelActor = \(notificacion = \{\}\) => \{/);
  assert.match(servicio, /Registraste a <strong>\$\{escapeHtml\(nombreMiembro\)\}<\/strong> exitosamente/);
  assert.match(servicio, /notificacion\.metadatos\?\.nombres, notificacion\.metadatos\?\.apellidos/);
  assert.doesNotMatch(servicio, /Se registró a <strong>/);

  assert.match(servicio, /tituloHtml: `<p><strong>\$\{escapeHtml\(actorNombre\)\}<\/strong> registró a \$\{escapeHtml\(nombreMiembro\)\}\.<\/p>`/);
  assert.match(servicio, /if \(esElActor\) \{/);
  assert.match(servicio, /title: construirTituloHtml\(notificacion, usuarioId\)/);
});

test('el nombre de quien actua no sale dos veces seguidas', () => {
  assert.match(servicio, /const componerTituloHtml = \(actorNombre, mensaje\) =>/);
  assert.match(servicio, /texto\.toLowerCase\(\)\.startsWith\(nombre\.toLowerCase\(\)\)/);
  assert.match(servicio, /\? componerTituloHtml\(actorNombre, mensaje\)/);
});
