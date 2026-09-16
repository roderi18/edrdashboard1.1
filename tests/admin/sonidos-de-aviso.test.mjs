import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// COMO SUENA LA APLICACION.
//
// El Administrador Global elige en Administracion → Sonidos que suena en cada
// aviso, y ESE es el que suena en su modulo: mensaje de chat recibido, campana,
// mensaje enviado y archivo cargado.
//
// Lo que no puede volver: que un aviso apagado suene igual, que un sonido
// inventado rompa la reproduccion, o que al entrar suene una vez por cada
// conversacion y por cada notificacion vieja sin leer.
// ----------------------------------------------------------------------

const {
  AVISOS,
  SONIDOS,
  SIN_SONIDO,
  sonarAviso,
  eleccionPorDefecto,
  fijarEleccionDeSonidos,
  eleccionDeSonidos,
} = await import('src/utils/sonidos-de-aviso.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('los cuatro avisos tienen sonido de fábrica y dicen en qué módulo suenan', () => {
  assert.deepEqual(
    AVISOS.map((aviso) => aviso.clave),
    ['mensajeRecibido', 'campana', 'mensajeEnviado', 'archivoSubido']
  );

  AVISOS.forEach((aviso) => {
    assert.ok(aviso.modulo, `${aviso.clave} no dice dónde suena`);
    assert.ok(
      SONIDOS.some((sonido) => sonido.clave === aviso.porDefecto),
      `${aviso.clave} viene con un sonido que no existe`
    );
  });
});

test('un sonido inventado no se cuela: vuelve al de fábrica', () => {
  fijarEleccionDeSonidos({ campana: 'trompeta-imaginaria' });

  assert.equal(eleccionDeSonidos().campana, 'trompeta-imaginaria');
  // Sin Web Audio (node) no suena, pero tampoco revienta: es lo que garantiza
  // que un aviso nunca tumbe al modulo que lo dispara.
  assert.equal(sonarAviso('campana'), false);
});

test('"Sin sonido" no suena, y tampoco un aviso que no existe', () => {
  fijarEleccionDeSonidos({ ...eleccionPorDefecto(), mensajeEnviado: SIN_SONIDO });

  assert.equal(sonarAviso('mensajeEnviado'), false);
  assert.equal(sonarAviso('loQueSea'), false);
});

test('cada aviso está conectado a su módulo', () => {
  // Chat: al llegar y al enviar.
  assert.match(
    leer('src/sections/chat/hooks/use-chat-realtime-sync.js'),
    /sonarAviso\('mensajeRecibido'\)/
  );
  // Al pulsar Enter, no cuando contesta el servidor; y 100 ms después, para que
  // no se confunda con el golpe de la tecla.
  assert.match(
    leer('src/sections/chat/chat-message-input.jsx'),
    /sonarAviso\('mensajeEnviado', \{ retrasoMs: 100 \}\)/
  );
  // Campana: en el propio aviso de Firestore, no después de recargar la lista.
  assert.match(
    leer('src/layouts/dashboard/layout.jsx'),
    /if \(cambio\?\.nuevas > 0\) sonarAviso\('campana'\)/
  );
  // Subidas: las dos puertas, archivos y fotos.
  assert.match(leer('src/utils/firebase-file-storage.js'), /sonarAviso\('archivoSubido'\)/);
  assert.match(leer('src/utils/firebase-image-storage.js'), /sonarAviso\('archivoSubido'\)/);
});

// Al entrar, el listener trae TODAS las conversaciones y la campana ya tiene
// avisos sin leer: sin estas dos guardas sonaba una vez por cada una.
test('al entrar no suena nada: solo cuando llega algo nuevo', () => {
  const chat = leer('src/sections/chat/hooks/use-chat-realtime-sync.js');

  assert.match(chat, /if \(yaSonado === undefined \|\| yaSonado === idMensaje\) return false;/);
  assert.match(chat, /return esDeOtro && sinLeer && !silenciada;/);

  // La campana solo cuenta las que llegan NUEVAS: marcar una como leída también
  // es un cambio, y eso no tiene que sonar. Y la primera foto no avisa.
  assert.match(
    leer('src/services/notification-service.js'),
    /nuevas: cambios\.filter\(\(cambio\) => cambio\.type === 'added'\)\.length/
  );
});

test('el propio mensaje no suena como recibido, y una conversación silenciada tampoco', () => {
  const chat = leer('src/sections/chat/hooks/use-chat-realtime-sync.js');

  assert.match(chat, /ultimoMensaje\?\.remitenteIdMiembros\) !== Number\(idMiembros\)/);
  assert.match(chat, /silenciadoPorIdMiembros\?\.\[String\(idMiembros\)\]/);
});

// UN SONIDO POR MENSAJE. La escucha esta montada dos veces —el marco del panel y
// la pantalla del chat—, y ademas cada cambio de la conversacion (el acuse de
// entrega, el contador) la despertaba otra vez: un mensaje sonaba tres o cuatro
// veces seguidas.
test('un mensaje suena una sola vez, aunque escuchen dos pantallas', () => {
  const chat = leer('src/sections/chat/hooks/use-chat-realtime-sync.js');

  // La memoria vive FUERA del componente: las dos escuchas comparten la misma.
  assert.match(chat, /^const ultimoMensajeQueSono = new Map\(\);$/m);
  assert.match(chat, /ultimoMensajeQueSono\.set\(idConversacion, idMensaje\)/);
  // Y se decide por el mensaje, no por cualquier cambio de la conversacion.
  assert.match(
    chat,
    /const idMensaje = String\(conversacion\?\.ultimoMensaje\?\.idMensaje \?\? ''\)/
  );
});

// "Silenciar notificaciones" es de la conversacion: tiene que callar TODO lo
// suyo, tambien el sonido de enviar y el del archivo que se sube con el mensaje.
test('silenciar una conversación calla también sus sonidos al escribir', () => {
  const entrada = leer('src/sections/chat/chat-message-input.jsx');

  assert.match(entrada, /silenciarAvisos\(silenciada\);/);
  assert.match(entrada, /silenciarAvisos\(false\);/);
  assert.match(
    leer('src/sections/chat/view/chat-view.jsx'),
    /silenciada=\{Boolean\(conversation\?\.muted\)\}/
  );
  // Y el interruptor de verdad: con los avisos apagados, `sonarAviso` no suena.
  assert.match(
    leer('src/utils/sonidos-de-aviso.mjs'),
    /if \(avisosSilenciados \|\| !sonido \|\| sonido === SIN_SONIDO\) return false;/
  );
});

test('la elección se guarda para toda la organización y queda en Historial', () => {
  const servicio = leer('src/services/sonidos-service.js');

  assert.match(servicio, /ambito: AMBITOS_CAMBIO\.sonidosDeAviso/);
  assert.match(servicio, /aplicar: \(\) => escribirSonidosDeAviso\(limpia\)/);
  // Solo el Administrador Global escribe esa configuracion.
  assert.match(
    leer('firestore.rules'),
    /match \/configuracion_sonidos\/\{documento\} \{\s*allow read: if esUsuarioDelSistema\(\);\s*allow write: if esAdministradorGlobal\(\);/
  );
  assert.match(leer('firestore.rules'), /coleccion != 'configuracion_sonidos'/);
});

test('la pantalla vive en una pestaña de Administración', () => {
  assert.match(leer('src/routes/paths.js'), /sonidos: `\$\{ROOTS\.DASHBOARD\}\/admin\/sonidos`/);
  assert.match(
    leer('src/sections/admin/layout/admin-tabs-layout.jsx'),
    /label: 'Sonidos',[\s\S]*?href: paths\.dashboard\.admin\.sonidos/
  );
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/app/dashboard/admin/sonidos/page.jsx')));
});
