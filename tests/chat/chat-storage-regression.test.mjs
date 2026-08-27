import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storageRules = await readFile(new URL('../../storage.rules', import.meta.url), 'utf8');
const inputSource = await readFile(
  new URL('../../src/sections/chat/chat-message-input.jsx', import.meta.url),
  'utf8'
);
const uploadSource = await readFile(
  new URL('../../src/utils/firebase-file-storage.js', import.meta.url),
  'utf8'
);

test('Storage restringe archivos del chat a participantes de la conversación', () => {
  assert.match(storageRules, /function esParticipanteChat\(idConversacion\)/);
  assert.match(storageRules, /firestore\.get\(rutaConversacionChat\(idConversacion\)\)/);
  assert.match(storageRules, /match \/chat\/\{idConversacion\}\/imagenes\/\{archivo\}/);
  assert.match(storageRules, /match \/chat\/\{idConversacion\}\/archivos\/\{archivo\}/);
  assert.match(storageRules, /resource == null/g);
  assert.match(storageRules, /allow update: if false/g);
});

test('el administrador global puede crear o reemplazar imagenes en cualquier ruta', () => {
  assert.match(storageRules, /function esAdministradorGlobal\(\)/);
  assert.match(storageRules, /return rol in \['admin', 'administrador_global'\]/);
  assert.match(storageRules, /esRolAdministradorGlobal\(request\.auth\.token\.rol\)/);
  assert.doesNotMatch(storageRules, /\['admin', 'administrador', 'administrador_global'\]/);
  assert.match(storageRules, /match \/\{rutaImagen=\*\*\}/);
  assert.match(
    storageRules,
    /allow create, update: if esAdministradorGlobal\(\)\s*&& esImagenPermitida\(\)/
  );
  assert.match(
    storageRules,
    /allow read: if esAdministradorGlobal\(\)\s*&& resource\.contentType\.matches\('image\/\.\*'\)/
  );
  assert.doesNotMatch(storageRules, /allow (?:write|delete): if esAdministradorGlobal\(\)/);
});

// La UNICA excepcion al borrado, y acotada: la carpeta de fotos propuestas. Al
// rechazar una sugerencia hay que borrar el archivo que dejo subido, y eso lo
// hace quien resuelve (Administrador Global u Oficina Nacional). Se comprueba
// que sigue siendo eso —un permiso con nombre propio, dentro de esa carpeta— y
// no un borrado suelto por ser administrador.
test('el borrado solo existe en la carpeta de fotos propuestas', () => {
  assert.match(storageRules, /function puedeResolverPropuestaDeFoto\(\)/);
  assert.match(
    storageRules,
    /match \/propuestas\/destacamentos\/\{idDestacamento\}\/\{propuesta\}\/\{archivo\}[\s\S]*?allow delete: if puedeResolverPropuestaDeFoto\(\);/
  );

  // Y sigue sin haber un borrado suelto en la ruta comodin de imagenes, que es
  // la que abarca todo lo demas.
  assert.doesNotMatch(
    storageRules,
    /match \/\{rutaImagen=\*\*\}[\s\S]*?allow [^;]*delete/
  );
});

test('las cargas usan la conversación real y metadatos ligados al usuario autenticado', () => {
  assert.match(inputSource, /createConversation\(\s*\{ \.\.\.conversationData, messages: \[\] \}/);
  assert.match(inputSource, /chat\/\$\{activeConversationId\}\/imagenes/);
  assert.match(inputSource, /chat\/\$\{activeConversationId\}\/archivos/);
  assert.match(inputSource, /idConversacion: String\(activeConversationId\)/g);
  assert.doesNotMatch(inputSource, /idMiembros \|\| ['"]nuevo['"]/);
  assert.match(uploadSource, /AUTH\?\.currentUser\?\.uid/);
  assert.match(uploadSource, /uploaderUid/);
});

test('la carga de adjuntos ofrece progreso, cancelación, reintento y limpieza recuperable', () => {
  assert.match(uploadSource, /uploadBytesResumable/);
  assert.match(uploadSource, /onProgress\?\./);
  assert.match(uploadSource, /signal\?\.addEventListener\('abort'/);
  assert.match(uploadSource, /task\.cancel\(\)/);
  assert.match(uploadSource, /deleteUploadedFilesFromStorage/);
  assert.match(uploadSource, /Promise\.allSettled/);
  assert.match(inputSource, /Cancelar carga/);
  assert.match(inputSource, /Reintentar/);
  assert.match(inputSource, /LinearProgress/);
});

test('la selección muestra límites coherentes y vista previa para imagen y PDF', () => {
  assert.match(inputSource, /MAX_IMAGE_SIZE = 8 \* 1024 \* 1024/);
  assert.match(inputSource, /MAX_DOCUMENT_TOTAL_SIZE = 10 \* 1024 \* 1024/);
  assert.match(inputSource, /image\/jpeg,image\/png,image\/webp,image\/gif/);
  assert.match(inputSource, /component="iframe"/);
  assert.match(inputSource, /máximo 10 y 10 MB en conjunto/);
  assert.doesNotMatch(inputSource, /no pueden superar 1 MB/);
});
