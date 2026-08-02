// Migración: los cargos regionales pasan al perfil de consulta de solo lectura
// del Consejo Nacional (Director Nacional), manteniendo su alcance regional.
//
// Hace dos cosas:
//   1. Re-sincroniza el catálogo de ROLES en Firestore con el código actual
//      (permisos + restricciones), para que el catálogo sea la única fuente de
//      verdad y no queden claves viejas en los roles afectados.
//   2. Limpia los "residuos" en `usuarios_roles` de los usuarios cuyos rol es uno
//      de los cargos regionales: elimina permisos directos, permisos excluidos,
//      metadata de permisos y restricciones override, para que su acceso quede
//      determinado 100% por el catálogo del rol.
//
// Seguridad: por defecto corre en DRY-RUN (solo reporta). Para aplicar los
// cambios reales hay que pasar --apply.
//
//   Reporte (no escribe nada):  node scripts/permissions/migrate-regional-readonly.mjs
//   Aplicar:                    node scripts/permissions/migrate-regional-readonly.mjs --apply

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeApp } from 'firebase/app';
import {
  doc,
  getDocs,
  updateDoc,
  writeBatch,
  deleteField,
  collection,
  getFirestore,
  serverTimestamp,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const logFile = path.join(__dirname, 'migrate-regional-readonly.log');

const APPLY = process.argv.includes('--apply');
const ENV_FILES = ['.env.local', '.env'];

// Cargos regionales afectados (deben coincidir con CARGOS_REGIONALES_PERFIL_DIRECTOR
// en role-permissions.js y con REGION_SCOPED_MEMBER_VIEW_ROLE_IDS en member-access.js).
const REGIONAL_ROLE_CODES = [
  'usuario_region',
  'usuario_region_asistente',
  'coordinador_adiestramiento_region',
  'coordinador_promocion_region',
  'coordinador_produccion_region',
  'coordinador_programa_region',
];

// Campos de "residuo" de autorización que se limpian en usuarios_roles.
const RESIDUE_FIELDS = ['permisos', 'permisosExcluidos', 'permisosMetadata', 'restricciones'];

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
    if (!process.env[key]) process.env[key] = value;
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

// Evalúa un módulo ES del catálogo sin bundler (mismo enfoque que el seed).
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
  const rolePermissionsPath = path.join(rootDir, 'src', 'auth', 'permissions', 'role-permissions.js');

  const permissions = evaluateModule(permissionsPath, `{ COLECCIONES_AUTORIZACION, PERMISOS }`);
  const roles = evaluateModule(rolesPath, `{ ROLES, ALCANCES, ROLES_CATALOGO }`);
  const rolePermissions = evaluateModule(rolePermissionsPath, `{ crearDefinicionRol }`, {
    PERMISOS: permissions.PERMISOS,
    ROLES: roles.ROLES,
    ALCANCES: roles.ALCANCES,
  });

  return { ...permissions, ...roles, ...rolePermissions };
}

function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      process.env.NEXT_PUBLIC_FIREBASE_AUTHDOMAIN ||
      process.env.FIREBASE_AUTH_DOMAIN,
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECTID ||
      process.env.FIREBASE_PROJECT_ID,
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGEBUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDERID ||
      process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_APPID ||
      process.env.FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Faltan variables Firebase: ${missing.join(', ')}`);
  return config;
}

// Devuelve el rolId almacenado en un doc de usuarios_roles (varias variantes).
function getDocRoleId(data = {}) {
  return String(data.rolId || data.roleId || data.rolCodigo || data.roleCodigo || '')
    .trim()
    .toLowerCase();
}

async function syncAffectedRoles(db, catalog) {
  const { COLECCIONES_AUTORIZACION, ROLES_CATALOGO, crearDefinicionRol } = catalog;
  const actor = 'script_migracion_regional_readonly';
  const batch = writeBatch(db);
  let count = 0;

  ROLES_CATALOGO.map(crearDefinicionRol).forEach((rol) => {
    if (!REGIONAL_ROLE_CODES.includes(rol.codigo)) return;
    count += 1;
    writeLog(
      `  rol ${rol.codigo}: permisos=${rol.permisos.length} restricciones=${JSON.stringify(
        rol.restricciones
      )}`
    );
    if (!APPLY) return;
    batch.set(
      doc(db, COLECCIONES_AUTORIZACION.roles, rol.codigo),
      {
        ...rol,
        activo: true,
        actualizadoPor: actor,
        actualizadoEn: new Date().toISOString(),
        actualizadoEnServidor: serverTimestamp(),
      },
      { merge: true }
    );
  });

  if (APPLY && count) await batch.commit();
  writeLog(`Roles regionales sincronizados: ${count}${APPLY ? '' : ' (dry-run, no escrito)'}`);
}

async function cleanUserResidues(db, catalog) {
  const { COLECCIONES_AUTORIZACION } = catalog;
  const snapshot = await getDocs(collection(db, COLECCIONES_AUTORIZACION.usuariosRoles));

  let affected = 0;
  let cleaned = 0;

  for (const snap of snapshot.docs) {
    const data = snap.data();
    const roleId = getDocRoleId(data);
    if (!REGIONAL_ROLE_CODES.includes(roleId)) continue;

    affected += 1;

    // Solo se limpian los campos de residuo que estén presentes y con contenido.
    const present = RESIDUE_FIELDS.filter((field) => {
      const value = data[field];
      if (value === undefined || value === null) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return Boolean(value);
    });

    if (!present.length) {
      writeLog(`  usuario ${snap.id} (rol ${roleId}): sin residuos`);
      continue;
    }

    cleaned += 1;
    writeLog(`  usuario ${snap.id} (rol ${roleId}): limpia [${present.join(', ')}]`);

    if (!APPLY) continue;

    const updates = {};
    present.forEach((field) => {
      updates[field] = deleteField();
    });
    updates.permisosMigracionRegional = {
      limpiadoPor: 'script_migracion_regional_readonly',
      limpiadoEn: new Date().toISOString(),
      camposLimpiados: present,
    };
    await updateDoc(doc(db, COLECCIONES_AUTORIZACION.usuariosRoles, snap.id), updates);
  }

  writeLog(
    `Usuarios regionales encontrados: ${affected}; con residuos ${
      APPLY ? 'limpiados' : 'a limpiar'
    }: ${cleaned}`
  );
}

async function run() {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(logFile, '', 'utf8');
  loadEnv();

  const config = getFirebaseConfig();
  const app = initializeApp(config);
  const db = getFirestore(app);
  const catalog = loadAuthorizationCatalog();

  writeLog(`Proyecto Firebase: ${config.projectId}`);
  writeLog(`Modo: ${APPLY ? 'APPLY (escribe cambios)' : 'DRY-RUN (solo reporta)'}`);
  writeLog('--- 1. Sincronizando catálogo de roles regionales ---');
  await syncAffectedRoles(db, catalog);
  writeLog('--- 2. Limpiando residuos en usuarios_roles ---');
  await cleanUserResidues(db, catalog);
  writeLog('Migración finalizada.');
}

run().catch((error) => {
  writeLog(`ERROR: ${error.stack || error.message}`);
  process.exitCode = 1;
});
