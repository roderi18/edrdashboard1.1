// ----------------------------------------------------------------------
// QUIEN PUEDE REESCRIBIR LA PORTADA, Y QUE QUEDA CONSTANCIA.
//
// Lo que se publica desde EVEREST Designer lo ve toda la organizacion al entrar.
// Tres cosas lo protegen, y las tres se comprueban aqui:
//
//   1. Las REGLAS: solo el Administrador Global escribe, y las colecciones estan
//      fuera del comodin del final —sin eso, cualquier sesion valida podria
//      reescribir la portada de todo el mundo—.
//   2. La PUERTA DE CAMBIOS: publicar pasa por `proponerCambio`, asi que queda en
//      Historial quien publico que bloque y cuando.
//   3. Los MEDIOS de hoy: los nuevos van a su propia carpeta y nunca pisan la
//      foto o el video que la portada esta usando.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { COLECCIONES_EVEREST, CARPETA_MEDIOS_EVEREST } =
  await import('src/utils/everest/colecciones.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const bloqueDeRegla = (reglas, encabezado) => {
  const inicio = reglas.indexOf(encabezado);

  assert.ok(inicio >= 0, `falta la regla ${encabezado}`);

  return reglas.slice(inicio, reglas.indexOf('\n    }', inicio));
};

// ----------------------------------------------------------------------
// 1. LAS REGLAS
// ----------------------------------------------------------------------

test('lo publicado lo lee cualquier sesion y lo escribe solo el Administrador Global', () => {
  const regla = bloqueDeRegla(
    leer('firestore.rules'),
    `match /${COLECCIONES_EVEREST.publicado}/{pantalla} {`
  );

  assert.match(regla, /allow read: if esUsuarioDelSistema\(\);/);
  assert.match(regla, /allow write: if esAdministradorGlobal\(\);/);
});

test('los borradores y las versiones son solo del Administrador Global', () => {
  const reglas = leer('firestore.rules');

  assert.match(
    bloqueDeRegla(reglas, `match /${COLECCIONES_EVEREST.borradores}/{pantalla} {`),
    /allow read, write: if esAdministradorGlobal\(\);/
  );

  const versiones = bloqueDeRegla(reglas, `match /${COLECCIONES_EVEREST.versiones}/{idVersion} {`);

  assert.match(versiones, /allow read, create: if esAdministradorGlobal\(\);/);
  // Una version es historia: no se reescribe ni se borra.
  assert.match(versiones, /allow update, delete: if false;/);
});

test('las tres colecciones estan fuera del comodin', () => {
  const reglas = leer('firestore.rules');

  Object.values(COLECCIONES_EVEREST).forEach((coleccion) => {
    assert.match(reglas, new RegExp(`&& coleccion != '${coleccion}'`), coleccion);
  });
});

test('los medios nuevos van a su carpeta, con las condiciones de las tarjetas de hoy', () => {
  const reglas = leer('storage.rules');
  const nuevos = bloqueDeRegla(reglas, `match /${CARPETA_MEDIOS_EVEREST}/{idBloque}/{archivo} {`);
  const deHoy = bloqueDeRegla(reglas, 'match /principal-tarjetas/{idTarjeta}/{archivo} {');

  // Mismas condiciones que la carpeta de hoy, y la de hoy intacta.
  assert.equal(
    nuevos.slice(nuevos.indexOf('allow read')),
    deHoy.slice(deHoy.indexOf('allow read'))
  );
  assert.match(nuevos, /allow delete: if false;/);
});

// ----------------------------------------------------------------------
// 2. LA PUERTA DE CAMBIOS
// ----------------------------------------------------------------------

test('publicar y volver al original pasan por la puerta y quedan en Historial', () => {
  const servicio = leer('src/services/everest-service.js');

  assert.match(
    leer('src/services/solicitudes-cambio-service.js'),
    /everestDesigner: 'everest_designer',/
  );
  assert.equal(servicio.match(/ambito: AMBITOS_CAMBIO\.everestDesigner/g)?.length, 2);
  assert.match(
    servicio,
    /aplicar: \(\) => escribirBloquePublicado\(pantalla, idBloque, publicacion\)/
  );
  assert.match(servicio, /aplicar: \(\) => quitarBloquePublicado\(pantalla, idBloque\)/);
  // Lo que se escribe ya salio del saneado.
  assert.match(
    servicio,
    /const publicacion = prepararPublicacion\(\{ idBloque, contenido, usuario \}\);/
  );
});

test('el ambito no espera a la Oficina Nacional: lo publica el Administrador Global', () => {
  const puerta = leer('src/services/solicitudes-cambio-service.js');
  const listaDeOficina = puerta.slice(
    puerta.indexOf('export const AMBITOS_QUE_APRUEBA_OFICINA_NACIONAL'),
    puerta.indexOf('];', puerta.indexOf('export const AMBITOS_QUE_APRUEBA_OFICINA_NACIONAL'))
  );

  assert.doesNotMatch(listaDeOficina, /everestDesigner/);
  assert.match(leer('src/services/everest-service.js'), /if \(!isAdminGlobal\(usuario\)\)/);
});

test('solo el brazo que aplica escribe, y esta en la lista de ESLint con su motivo', () => {
  assert.match(leer('eslint.config.mjs'), /'src\/services\/everest-apply\.js',/);
  // El servicio no escribe por su cuenta: todo pasa por la puerta.
  assert.doesNotMatch(leer('src/services/everest-service.js'), /\b(setDoc|updateDoc|deleteDoc)\(/);
});

test('publicar un bloque no borra los demas', () => {
  const brazo = leer('src/services/everest-apply.js');

  assert.match(
    brazo,
    /\{ bloques: \{ \[idBloque\]: publicacion \}, actualizadoEn: serverTimestamp\(\) \},\s*\{ merge: true \}/
  );
  assert.match(brazo, /new FieldPath\('bloques', idBloque\),\s*deleteField\(\)/);
});

// ----------------------------------------------------------------------
// 3. LA PORTADA SOLO LEE (desde la fase 2)
// ----------------------------------------------------------------------

test('la portada lee del Designer por un unico sitio, y no puede publicar nada', () => {
  const carpeta = path.join(process.cwd(), 'src/sections/principal');
  const importanDelDesigner = fs
    .readdirSync(carpeta, { recursive: true })
    .filter((archivo) => /\.(jsx?|mjs)$/.test(archivo))
    .filter((archivo) =>
      /from 'src\/(utils\/everest|services\/everest)/.test(
        fs.readFileSync(path.join(carpeta, archivo), 'utf8')
      )
    )
    .map((archivo) => archivo.replaceAll('\\', '/'));

  // Todo lo que la portada sabe del Designer entra por el lector.
  assert.deepEqual(importanDelDesigner, ['use-contenido-de-portada.js']);

  // Y el lector solo lee: publicar se hace desde el Designer, nunca al pintar.
  const lector = leer('src/sections/principal/use-contenido-de-portada.js');

  assert.match(lector, /import \{ obtenerPublicado \} from 'src\/services\/everest-service';/);
  assert.doesNotMatch(lector, /publicarBloque|volverBloqueAlOriginal|everest-apply/);
});
