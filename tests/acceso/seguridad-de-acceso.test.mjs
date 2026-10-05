// ----------------------------------------------------------------------
// SEGURIDAD DEL ACCESO: lo que una auditoria encontro abierto.
//
// Que se rompia:
//  - El titulo de una notificacion se inyectaba como HTML: XSS almacenado.
//  - El limite por IP leia la primera entrada de `x-forwarded-for`, que pone el
//    propio cliente: bastaba cambiarla para saltarselo.
//  - Un token revocado (cambio de clave, cuenta deshabilitada) seguia valiendo
//    hasta una hora en la API.
//  - Cinco fallos agotaban el codigo de recuperacion de cualquiera.
//  - La contraseña podia ser `123456`, y la llave de "probar como usuario" valia
//    un año sin fecha.
//  - No habia cabeceras de seguridad.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { htmlSeguro } = await import('../../src/utils/html-seguro.mjs');
const { ipDeLaLista } = await import('../../src/server/ip-del-cliente.mjs');
const { tokenRevocado, GRACIA_PRIMER_ACCESO_MS } =
  await import('../../src/server/verificar-token-core.mjs');
const { validarClaveNueva, MINIMO_CLAVE } = await import('../../src/utils/validar-clave-nueva.mjs');

const leer = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');

// --- XSS ---

test('htmlSeguro neutraliza scripts, manejadores y enlaces', () => {
  const ataques = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)">clic</a>',
    '<svg onload=alert(1)>',
    '<b onclick="x()">negrita</b>',
    '<iframe src="https://malo.example"></iframe>',
  ];

  for (const ataque of ataques) {
    const salida = htmlSeguro(ataque);

    assert.doesNotMatch(salida, /<(img|script|a|svg|iframe)\b/i, ataque);
    assert.doesNotMatch(salida, /<[^>]*\son\w+=/i, ataque);
  }
});

test('htmlSeguro respeta el formato simple y sin atributos', () => {
  assert.equal(
    htmlSeguro('<p><strong>Ana</strong> te escribió<br/>hola</p>'),
    '<p><strong>Ana</strong> te escribió<br>hola</p>'
  );
  assert.equal(htmlSeguro('Tom &amp; Jerry < 3'), 'Tom &amp; Jerry &lt; 3');
  assert.equal(htmlSeguro(null), '');
});

test('el panel de avisos pinta el titulo con htmlSeguro', async () => {
  const fuente = await leer('src/layouts/components/notifications-drawer/notification-item.jsx');

  assert.match(fuente, /__html: htmlSeguro\(data\)/);
  assert.doesNotMatch(fuente, /__html: data\b/);
});

// --- origen de la llamada ---

test('la IP se lee desde la derecha: lo que antepone el cliente no cuenta', () => {
  assert.equal(ipDeLaLista('1.1.1.1, 2.2.2.2, 203.0.113.7, 130.211.0.1', 1), '203.0.113.7');
  assert.equal(ipDeLaLista('9.9.9.9, 203.0.113.7, 130.211.0.1', 1), '203.0.113.7');
  assert.equal(ipDeLaLista('203.0.113.7', 1), '203.0.113.7');
  assert.equal(ipDeLaLista('', 1), '');
  assert.equal(ipDeLaLista('falso, 203.0.113.7', 0), '203.0.113.7');
});

test('el limite ya no se fia de cabeceras que puede poner cualquiera', async () => {
  const fuente = await leer('src/server/limite-intentos.js');

  assert.doesNotMatch(fuente, /x-nf-client-connection-ip'\)/);
  assert.doesNotMatch(fuente, /headers\.get\('x-real-ip'\)/);
});

// --- revocacion ---

const ahora = Date.parse('2026-10-05T12:00:00Z');
const emitidoHace = (segundos) => Math.floor((ahora - segundos * 1000) / 1000);

test('un token emitido antes de la revocacion no vale', () => {
  const cuenta = { tokensValidAfterTime: new Date(ahora - 60 * 1000).toUTCString() };

  assert.equal(tokenRevocado({ iat: emitidoHace(3600) }, cuenta, { ahora }), true);
  assert.equal(tokenRevocado({ iat: emitidoHace(10) }, cuenta, { ahora }), false);
});

test('una cuenta deshabilitada nunca vale', () => {
  assert.equal(tokenRevocado({ iat: emitidoHace(1) }, { disabled: true }, { ahora }), true);
});

test('la gracia de primer acceso solo cubre tokens del codigo de un solo uso y diez minutos', () => {
  const revocadoHace = (ms) => ({ tokensValidAfterTime: new Date(ahora - ms).toUTCString() });
  const conMarca = { iat: emitidoHace(3600), debeCambiarClave: true };
  const sinMarca = { iat: emitidoHace(3600) };
  const gracia = { graciaPrimerAcceso: true, ahora };

  assert.equal(tokenRevocado(conMarca, revocadoHace(60 * 1000), gracia), false);
  // Una sesion normal robada se corta al instante, con gracia o sin ella.
  assert.equal(tokenRevocado(sinMarca, revocadoHace(60 * 1000), gracia), true);
  // Pasados los diez minutos, tampoco.
  assert.equal(tokenRevocado(conMarca, revocadoHace(GRACIA_PRIMER_ACCESO_MS + 1000), gracia), true);
  // Sin pedir la gracia, no hay gracia.
  assert.equal(tokenRevocado(conMarca, revocadoHace(60 * 1000), { ahora }), true);
});

test('las puertas de la API verifican con revocacion y encierran al que debe cambiar la clave', async () => {
  const [requireRole, claves, claims] = await Promise.all([
    leer('src/server/require-role.js'),
    leer('src/server/claves-miembro.js'),
    leer('src/app/api/admin/set-user-claims/route.js'),
  ]);

  for (const fuente of [requireRole, claves, claims]) {
    assert.match(fuente, /verificarTokenDeSesion/);
    assert.doesNotMatch(fuente, /\.verifyIdToken\(token\)/);
  }

  assert.match(requireRole, /debeCambiarClave === true/);
  assert.match(claves, /!encerrado && \(esAdministradorGlobal/);
});

test('set-user-claims da prioridad al perfil sobre el claim', async () => {
  const fuente = await leer('src/app/api/admin/set-user-claims/route.js');

  assert.match(fuente, /callerAssignment\?\.rolId \|\| caller\.rol/);
  assert.doesNotMatch(fuente, /caller\.rol \|\| callerAssignment/);
});

// --- codigo de recuperacion ---

test('agotar los intentos congela el codigo, no lo destruye', async () => {
  const [claves, ruta, secretos] = await Promise.all([
    leer('src/server/claves-miembro.js'),
    leer('src/app/api/auth/acceso-con-codigo/route.js'),
    leer('src/server/secretos-acceso.js'),
  ]);

  assert.match(claves, /BLOQUEO_CODIGO_UN_USO_MS = 15 \* 60 \* 1000/);
  assert.match(claves, /export const codigoBloqueado/);
  assert.match(ruta, /registrarFalloDeCodigo/);
  assert.doesNotMatch(ruta, /intentos: Number\(registro\?\.intentos \|\| 0\) \+ 1/);
  // El conteo es una transaccion: atomico aunque lleguen varias a la vez.
  assert.match(secretos, /runTransaction/);
});

// --- contraseña ---

test('la contraseña nueva exige largo, rechaza las comunes y el codigo del miembro', () => {
  assert.equal(MINIMO_CLAVE, 8);
  assert.match(validarClaveNueva('corta'), /al menos 8/);
  assert.match(validarClaveNueva('x'.repeat(200)), /no puede pasar/);
  assert.match(validarClaveNueva('12345678'), /demasiado común/);
  assert.match(validarClaveNueva('Exploradores'), /demasiado común/);
  assert.match(validarClaveNueva('aaaaaaaa'), /demasiado común/);
  assert.match(
    validarClaveNueva('claveEDR10049!', { codigoMiembro: 'EDR-10049' }),
    /código de miembro/
  );
  assert.equal(validarClaveNueva('Verde-Montaña-72'), null);
});

test('el servidor y la pantalla piden el mismo minimo de contraseña', async () => {
  const pantalla = await leer('src/auth/view/firebase/firebase-primer-acceso-view.jsx');
  const ruta = await leer('src/app/api/auth/clave-miembro/route.js');

  assert.match(pantalla, /const MINIMO_CLAVE = 8;/);
  assert.match(ruta, /validarClaveNueva/);
});

// --- cambio de correo ---

test('cambiar el correo exige sesion reciente y cierra las sesiones ajenas', async () => {
  const fuente = await leer('src/app/api/auth/correo-cuenta-miembro/route.js');

  assert.match(fuente, /authTime > 30 \* 60/);
  assert.match(fuente, /revokeRefreshTokens\(cuenta\.uid\)/);
});

// --- suplantacion ---

test('la llave de "probar como usuario" caduca y deja constancia', async () => {
  const fuente = await leer('src/app/api/admin/probar-como-usuario/route.js');

  assert.match(fuente, /VIGENCIA_LLAVE = 60 \* 60 \* 12/);
  assert.match(fuente, /contenido\.exp < Date\.now\(\)/);
  assert.match(fuente, /\[probar-como-usuario\] entrada/);
  assert.doesNotMatch(fuente, /UN_ANO/);
});

// --- cabeceras ---

test('todas las rutas llevan cabeceras de seguridad', async () => {
  const fuente = await leer('next.config.mjs');

  for (const clave of [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
    "frame-ancestors 'self'",
  ]) {
    assert.ok(fuente.includes(clave), `falta ${clave}`);
  }
});
