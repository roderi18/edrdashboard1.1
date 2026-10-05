// ----------------------------------------------------------------------
// CADA ENTORNO DE APP HOSTING HABLA CON SU PROPIO FIREBASE.
//
// Que se rompia: desarrollo y QA no tenian archivo de entorno, asi que se
// compilaban con `apphosting.yaml`, que es el de PRODUCCION: la web de pruebas
// habria leido y escrito los datos reales de `systexploradores`. Y la clave
// publica VAPID estaba escrita a mano con la de produccion: en dev y QA no
// casaba con su clave privada, y los avisos push no llegaban.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');

// Lector minimo de `- variable: X` / `value: Y` (sin dependencias de YAML).
const variablesDe = (yaml) => {
  const variables = {};
  let actual = null;

  for (const linea of yaml.split(/\r?\n/)) {
    const variable = linea.match(/^\s*- variable:\s*(\S+)/);
    const valor = linea.match(/^\s*value:\s*'?([^'\s]+)'?\s*$/);
    const secreto = linea.match(/^\s*secret:\s*(\S+)/);

    if (variable) actual = variable[1];
    else if (valor && actual) variables[actual] = valor[1];
    else if (secreto && actual) variables[actual] = `secreto:${secreto[1]}`;
  }

  return variables;
};

const ENTORNOS = {
  dev: { proyecto: 'systexploradores-dev', backend: 'expedition-dev' },
  qa: { proyecto: 'systexploradores-qa', backend: 'expedition-qa' },
};

test('dev y QA apuntan a su propio proyecto de Firebase, nunca a produccion', async () => {
  for (const [entorno, { proyecto, backend }] of Object.entries(ENTORNOS)) {
    const v = variablesDe(await leer(`apphosting.${entorno}.yaml`));

    assert.equal(v.NEXT_PUBLIC_FIREBASE_PROJECT_ID, proyecto, entorno);
    assert.equal(v.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, `${proyecto}.firebaseapp.com`, entorno);
    assert.equal(v.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, `${proyecto}.firebasestorage.app`, entorno);
    assert.match(v.NEXT_PUBLIC_FIREBASE_APPID, new RegExp(`^1:${v.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}:web:`));
    assert.equal(
      v.WEB_PUSH_VAPID_SUBJECT,
      `https://${backend}--${proyecto}.us-central1.hosted.app`,
      entorno
    );

    for (const [nombre, valor] of Object.entries(v)) {
      assert.doesNotMatch(String(valor), /^systexploradores(\.|$)|385574507135/, `${entorno}: ${nombre} es de produccion`);
    }
  }
});

test('los archivos de entorno no llevan secretos: esos viven en Secret Manager', async () => {
  for (const entorno of Object.keys(ENTORNOS)) {
    const yaml = await leer(`apphosting.${entorno}.yaml`);

    assert.doesNotMatch(yaml, /PRIVATE KEY|private_key|WEB_PUSH_VAPID_PRIVATE_KEY:|TAREAS_PROGRAMADAS_SECRETO/);
    // Solo sobrescriben lo publico; los secretos los declara `apphosting.yaml`.
    assert.doesNotMatch(yaml, /^\s*secret:/m);
  }

  const base = variablesDe(await leer('apphosting.yaml'));

  assert.equal(base.FIREBASE_SERVICE_ACCOUNT, 'secreto:FIREBASE_SERVICE_ACCOUNT');
  assert.equal(base.WEB_PUSH_VAPID_PRIVATE_KEY, 'secreto:WEB_PUSH_VAPID_PRIVATE_KEY');
  assert.equal(base.TAREAS_PROGRAMADAS_SECRETO, 'secreto:TAREAS_PROGRAMADAS_SECRETO');
});

test('cada entorno tiene su clave publica VAPID, distinta de la de produccion', async () => {
  const fuente = await leer('src/utils/web-push-key.js');
  const produccion = fuente.match(/'(B[A-Za-z0-9_-]{80,})'/)[1];
  const claves = [];

  for (const entorno of Object.keys(ENTORNOS)) {
    const clave = variablesDe(await leer(`apphosting.${entorno}.yaml`))
      .NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;

    // Una clave publica VAPID: 65 bytes en base64url, empieza por "B".
    assert.match(clave, /^B[A-Za-z0-9_-]{86}$/, entorno);
    assert.notEqual(clave, produccion, `${entorno} usa la de produccion`);
    claves.push(clave);
  }

  assert.notEqual(claves[0], claves[1], 'dev y QA no comparten clave');
});

test('la clave publica sale de la variable del entorno y, sin ella, la de produccion', async () => {
  const fuente = await leer('src/utils/web-push-key.js');

  assert.match(
    fuente,
    /process\.env\.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY \|\| CLAVE_PUBLICA_DE_PRODUCCION/
  );

  // Produccion no declara la variable: sigue con la de siempre.
  const base = variablesDe(await leer('apphosting.yaml'));

  assert.equal(base.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY, undefined);
  assert.equal(base.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'systexploradores');
});
