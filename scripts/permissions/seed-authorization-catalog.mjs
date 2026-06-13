import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeApp } from 'firebase/app';
import { doc, getFirestore, writeBatch, serverTimestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const logFile = path.join(__dirname, 'seed-authorization-catalog.log');

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
    const value = trimmed
      .slice(equalIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function loadEnv() {
  ENV_FILES.forEach((fileName) => parseEnvFile(path.join(rootDir, fileName)));
}

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, `${line}\n`, 'utf8');
}

function evaluateModule(filePath, returnExpression, args = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = source
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export const /gm, 'const ')
    .replace(/^export function /gm, 'function ');
  const argNames = Object.keys(args);
  const argValues = Object.values(args);
  const factory = new Function(...argNames, `${transformed}\nreturn ${returnExpression};`);

  return factory(...argValues);
}

function loadAuthorizationCatalog() {
  const permissionsPath = path.join(rootDir, 'src', 'auth', 'permissions', 'permissions.js');
  const rolesPath = path.join(rootDir, 'src', 'auth', 'permissions', 'roles.js');
  const rolePermissionsPath = path.join(
    rootDir,
    'src',
    'auth',
    'permissions',
    'role-permissions.js'
  );

  const permissions = evaluateModule(permissionsPath, `{
    COLECCIONES_AUTORIZACION,
    PERMISOS,
    PERMISOS_CATALOGO
  }`);

  const roles = evaluateModule(rolesPath, `{
    ROLES,
    ALCANCES,
    ROLES_CATALOGO
  }`);

  const rolePermissions = evaluateModule(
    rolePermissionsPath,
    `{
      crearDefinicionRol
    }`,
    {
      PERMISOS: permissions.PERMISOS,
      ROLES: roles.ROLES,
      ALCANCES: roles.ALCANCES,
    }
  );

  return {
    ...permissions,
    ...roles,
    ...rolePermissions,
  };
}

function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      process.env.NEXT_PUBLIC_FIREBASE_AUTHDOMAIN ||
      process.env.FIREBASE_AUTH_DOMAIN ||
      process.env.FIREBASE_AUTHDOMAIN,
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECTID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECTID,
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGEBUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGEBUCKET,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDERID ||
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      process.env.FIREBASE_MESSAGING_SENDERID,
    appId:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_APPID ||
      process.env.FIREBASE_APP_ID ||
      process.env.FIREBASE_APPID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Faltan variables Firebase: ${missing.join(', ')}`);
  }

  return config;
}

async function seedAuthorizationCatalog() {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(logFile, '', 'utf8');
  loadEnv();

  const config = getFirebaseConfig();
  const app = initializeApp(config);
  const db = getFirestore(app);
  const {
    COLECCIONES_AUTORIZACION,
    PERMISOS_CATALOGO,
    ROLES_CATALOGO,
    crearDefinicionRol,
  } = loadAuthorizationCatalog();
  const batch = writeBatch(db);
  const actor = 'script_seed_autorizacion';

  PERMISOS_CATALOGO.forEach((permiso) => {
    batch.set(
      doc(db, COLECCIONES_AUTORIZACION.permisos, permiso.codigo),
      {
        ...permiso,
        activo: true,
        creadoPor: actor,
        actualizadoPor: actor,
        actualizadoEn: new Date().toISOString(),
        actualizadoEnServidor: serverTimestamp(),
      },
      { merge: true }
    );
  });

  ROLES_CATALOGO.map(crearDefinicionRol).forEach((rol) => {
    batch.set(
      doc(db, COLECCIONES_AUTORIZACION.roles, rol.codigo),
      {
        ...rol,
        activo: true,
        creadoPor: actor,
        actualizadoPor: actor,
        actualizadoEn: new Date().toISOString(),
        actualizadoEnServidor: serverTimestamp(),
      },
      { merge: true }
    );
  });

  writeLog(`Proyecto Firebase: ${config.projectId}`);
  writeLog(`Permisos a sincronizar: ${PERMISOS_CATALOGO.length}`);
  writeLog(`Roles a sincronizar: ${ROLES_CATALOGO.length}`);

  await batch.commit();

  writeLog('Catalogo de autorizacion sincronizado correctamente.');

  return {
    projectId: config.projectId,
    permisos: PERMISOS_CATALOGO.length,
    roles: ROLES_CATALOGO.length,
    logFile,
  };
}

seedAuthorizationCatalog().catch((error) => {
  writeLog(`ERROR: ${error.stack || error.message}`);
  process.exitCode = 1;
});
