// Cierra el agujero de las contraseñas iniciales deducibles.
//
// POR QUE: hasta ahora la cuenta de un miembro nacia con la contraseña igual a
// su codigo en mayusculas (`EDR-10002`). Los codigos son correlativos, asi que
// cualquiera podia recorrerlos y entrar como todo el que aun no hubiera elegido
// la suya. Las cuentas nuevas ya nacen con una clave aleatoria; este script
// arregla las que se crearon antes.
//
// QUE HACE: a cada cuenta que siga con `debeCambiarClave: true` le pone una
// contraseña aleatoria que NADIE ve, le marca el token y tira sus sesiones. A
// partir de ese momento esa persona no puede entrar con su codigo: necesita que
// su coordinador le genere un codigo de un solo uso desde su ficha, con el boton
// "Restablecer contraseña".
//
// A quien ya eligio su contraseña NO se le toca.
//
//   Reporte:  node scripts/permissions/migrar-claves-iniciales.mjs
//   Aplicar:  node scripts/permissions/migrar-claves-iniciales.mjs --apply
//
// Requiere FIREBASE_SERVICE_ACCOUNT en el entorno (.env.local).

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const logFile = path.join(__dirname, 'migrar-claves-iniciales.log');

const APPLY = process.argv.includes('--apply');
const ENV_FILES = ['.env.local', '.env'];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) return;

    const equalIndex = trimmed.indexOf('=');

    if (equalIndex === -1) return;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();

    if (!process.env[key]) process.env[key] = value;
  });
}

const lineas = [];

function registrar(mensaje) {
  console.log(mensaje);
  lineas.push(mensaje);
}

function iniciarAdmin() {
  if (getApps().length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error('Falta FIREBASE_SERVICE_ACCOUNT en el entorno (.env.local).');
  }

  const credenciales = JSON.parse(raw);

  if (typeof credenciales.private_key === 'string') {
    credenciales.private_key = credenciales.private_key.replace(/\\n/g, '\n');
  }

  initializeApp({ credential: cert(credenciales), projectId: credenciales.project_id });
}

// Larga y aleatoria porque nadie la va a teclear: solo tiene que ser imposible
// de adivinar mientras el miembro no elija la suya.
const claveAleatoria = () => randomBytes(32).toString('base64url');

async function main() {
  ENV_FILES.forEach((archivo) => parseEnvFile(path.join(rootDir, archivo)));
  iniciarAdmin();

  const auth = getAuth();
  const db = getFirestore();

  registrar(`[${new Date().toISOString()}] modo: ${APPLY ? 'APLICAR' : 'reporte'}`);

  const pendientes = await db
    .collection('usuarios_roles')
    .where('debeCambiarClave', '==', true)
    .get();

  // Un mismo miembro puede tener dos documentos —uno por su id y otro por su
  // uid—: se cuenta una sola vez.
  const porUid = new Map();
  const sinUid = [];

  pendientes.docs.forEach((documento) => {
    const datos = documento.data() || {};
    const uid = String(datos.uid || datos.idUsuario || '').trim();

    if (!uid) {
      sinUid.push({ id: documento.id, codigo: datos.codigoMiembro || '(sin código)' });
      return;
    }

    if (!porUid.has(uid)) {
      porUid.set(uid, { uid, codigo: datos.codigoMiembro || '', nombre: datos.nombre || '' });
    }
  });

  registrar('');
  registrar(`Cuentas que siguen con la contraseña inicial: ${porUid.size}`);

  let migradas = 0;
  const fallidas = [];

  for (const { uid, codigo, nombre } of porUid.values()) {
    registrar(`  · ${codigo || uid} ${nombre ? `— ${nombre}` : ''}`);

    if (!APPLY) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      const usuario = await auth.getUser(uid);

      // eslint-disable-next-line no-await-in-loop
      await auth.updateUser(uid, { password: claveAleatoria() });

      // La marca en el token: sin ella el servidor no puede negarle nada.
      // eslint-disable-next-line no-await-in-loop
      await auth.setCustomUserClaims(uid, {
        ...(usuario.customClaims ?? {}),
        debeCambiarClave: true,
      });

      // Si alguien habia entrado con la clave deducible, deja de estar dentro.
      // eslint-disable-next-line no-await-in-loop
      await auth.revokeRefreshTokens(uid);

      migradas += 1;
    } catch (error) {
      fallidas.push({ uid, codigo, motivo: error?.message || String(error) });
    }
  }

  if (sinUid.length) {
    registrar('');
    registrar(`Perfiles sin uid, imposible tocarles la cuenta: ${sinUid.length}`);
    sinUid.forEach(({ id, codigo }) => registrar(`  ! usuarios_roles/${id} (${codigo})`));
    registrar('Revisa esos a mano: o no tienen cuenta, o su perfil no la referencia.');
  }

  if (fallidas.length) {
    registrar('');
    registrar(`Fallaron: ${fallidas.length}`);
    fallidas.forEach(({ uid, codigo, motivo }) => registrar(`  ! ${codigo || uid}: ${motivo}`));
  }

  registrar('');

  if (APPLY) {
    registrar(`Migradas: ${migradas}`);
    registrar('');
    registrar('AVISA A LOS COORDINADORES: esas personas ya no entran con su código.');
    registrar('Para darles acceso, cada una necesita un código de un solo uso desde');
    registrar('su ficha (botón "Restablecer contraseña").');
  } else {
    registrar('Nada se escribió. Vuelve a ejecutarlo con --apply cuando decidas.');
  }

  fs.writeFileSync(logFile, `${lineas.join('\n')}\n`, 'utf8');
  registrar(`\nRegistro en ${path.relative(rootDir, logFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
