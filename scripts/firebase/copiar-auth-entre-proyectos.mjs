#!/usr/bin/env node

import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const directorioFirebaseTools = join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  'firebase-tools',
  'lib'
);
const binarioFirebase = join(directorioFirebaseTools, 'bin', 'firebase.js');
const { getGlobalDefaultAccount } = require(join(directorioFirebaseTools, 'auth.js'));
const { requireAuth } = require(join(directorioFirebaseTools, 'requireAuth.js'));
const { Client } = require(join(directorioFirebaseTools, 'apiv2.js'));

const argumentos = new Map(
  process.argv.slice(2).map((argumento) => {
    const [clave, ...partes] = argumento.replace(/^--/, '').split('=');
    return [clave, partes.length ? partes.join('=') : true];
  })
);
const proyectoOrigen = String(argumentos.get('origen') || 'systexploradores');
const proyectoDestino = String(argumentos.get('destino') || 'systexploradores-dev');
const confirmar = String(argumentos.get('confirmar') || '');

if (!/-(dev|qa)$/.test(proyectoDestino) || proyectoOrigen === proyectoDestino) {
  throw new Error(
    'La copia de Authentication solo acepta un destino -dev o -qa diferente del origen.'
  );
}
if (confirmar !== proyectoDestino) {
  throw new Error(`Agregue --confirmar=${proyectoDestino} para ejecutar la copia.`);
}

const cuenta = getGlobalDefaultAccount();
if (!cuenta) throw new Error('Firebase CLI no tiene una sesión activa.');
await requireAuth({ project: proyectoOrigen, user: cuenta.user, tokens: cuenta.tokens });

const cliente = new Client({
  urlPrefix: 'https://identitytoolkit.googleapis.com',
  apiVersion: 'admin/v2',
});
const configuracionOrigen = (await cliente.get(`projects/${proyectoOrigen}/config`)).body;
const hash = configuracionOrigen.signIn?.hashConfig;
if (!hash?.algorithm || !hash?.signerKey) {
  throw new Error('No se pudo obtener la configuración de hash del proyecto origen.');
}

await cliente.patch(
  `projects/${proyectoDestino}/config`,
  { signIn: { email: configuracionOrigen.signIn?.email || { enabled: true, passwordRequired: true } } },
  { queryParams: { updateMask: 'signIn.email' } }
);

const directorioRespaldos = join(process.cwd(), 'docs', 'backups');
await mkdir(directorioRespaldos, { recursive: true });
const marcaTiempo = new Date().toISOString().replace(/[:.]/g, '-');
const respaldoOrigen = join(directorioRespaldos, `auth-${proyectoOrigen}-${marcaTiempo}.json`);
const verificacionDestino = join(directorioRespaldos, `auth-${proyectoDestino}-${marcaTiempo}.json`);

function ejecutarFirebase(argumentosFirebase) {
  const resultado = spawnSync(process.execPath, [binarioFirebase, ...argumentosFirebase], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CI: '1', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' },
    shell: false,
  });
  if (resultado.status !== 0) {
    throw new Error(
      (resultado.error?.message || resultado.stderr || resultado.stdout || 'Firebase CLI falló').trim()
    );
  }
  if (resultado.stdout.trim()) console.log(resultado.stdout.trim());
}

ejecutarFirebase([
  'auth:export',
  respaldoOrigen,
  '--format=json',
  '--project',
  proyectoOrigen,
]);

const argumentosImportacion = [
  'auth:import',
  respaldoOrigen,
  '--project',
  proyectoDestino,
  '--hash-algo',
  hash.algorithm,
  '--hash-key',
  hash.signerKey,
  '--salt-separator',
  hash.saltSeparator || '',
  '--rounds',
  String(hash.rounds || 8),
  '--mem-cost',
  String(hash.memoryCost || 14),
];
ejecutarFirebase(argumentosImportacion);

ejecutarFirebase([
  'auth:export',
  verificacionDestino,
  '--format=json',
  '--project',
  proyectoDestino,
]);

const origen = JSON.parse(await readFile(respaldoOrigen, 'utf8'));
const destino = JSON.parse(await readFile(verificacionDestino, 'utf8'));
const usuariosOrigen = origen.users || [];
const usuariosDestino = destino.users || [];
if (usuariosOrigen.length !== usuariosDestino.length) {
  throw new Error(
    `La cantidad de usuarios no coincide: origen=${usuariosOrigen.length}, destino=${usuariosDestino.length}`
  );
}

const uidsOrigen = usuariosOrigen.map((usuario) => usuario.localId).sort();
const uidsDestino = usuariosDestino.map((usuario) => usuario.localId).sort();
if (JSON.stringify(uidsOrigen) !== JSON.stringify(uidsDestino)) {
  throw new Error('Los UID de Authentication no coinciden entre origen y destino.');
}

console.log(`AUTH VERIFICADO: ${usuariosOrigen.length} usuarios con los mismos UID.`);
console.log(`Respaldo local ignorado por Git: ${respaldoOrigen}`);

