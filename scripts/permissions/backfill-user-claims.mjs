// Backfill de custom claims de autorización (rol + alcance) para los usuarios ya
// existentes en `usuarios_roles`. Los claims normalmente se setean al asignar el
// rol; este script los aplica de una vez a quienes ya tenían rol antes de A2.
//
// También sirve para VERIFICAR el pipeline: en dry-run reporta qué claims tendría
// cada usuario sin escribir nada.
//
//   Reporte:  node scripts/permissions/backfill-user-claims.mjs
//   Aplicar:  node scripts/permissions/backfill-user-claims.mjs --apply
//
// Requiere FIREBASE_SERVICE_ACCOUNT en el entorno (.env.local).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const logFile = path.join(__dirname, 'backfill-user-claims.log');

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

const loadEnv = () => ENV_FILES.forEach((f) => parseEnvFile(path.join(rootDir, f)));

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, `${line}\n`, 'utf8');
}

// Evalúa un módulo ES del catálogo sin bundler (mismo enfoque que los otros scripts).
function evaluateModule(filePath, returnExpression, args = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = source
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export const /gm, 'const ')
    .replace(/^export function /gm, 'function ');
  const factory = new Function(
    ...Object.keys(args),
    `${transformed}\nreturn ${returnExpression};`
  );
  return factory(...Object.values(args));
}

function loadClaimsDeriver() {
  const base = path.join(rootDir, 'src', 'auth', 'permissions');
  const permissions = evaluateModule(path.join(base, 'permissions.js'), `{ PERMISOS }`);
  const roles = evaluateModule(path.join(base, 'roles.js'), `{ ROLES, ALCANCES, ROLES_POR_CODIGO }`);
  const rolePermissions = evaluateModule(
    path.join(base, 'role-permissions.js'),
    `{ RESTRICCIONES_ROL, ALCANCE_PREDETERMINADO_ROL }`,
    { PERMISOS: permissions.PERMISOS, ROLES: roles.ROLES, ALCANCES: roles.ALCANCES }
  );
  const claims = evaluateModule(
    path.join(base, 'user-claims.js'),
    `{ deriveUserClaims, isKnownRole }`,
    {
      ROLES_POR_CODIGO: roles.ROLES_POR_CODIGO,
      RESTRICCIONES_ROL: rolePermissions.RESTRICCIONES_ROL,
      ALCANCE_PREDETERMINADO_ROL: rolePermissions.ALCANCE_PREDETERMINADO_ROL,
    }
  );
  return claims;
}

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT no está definido en el entorno.');
  const serviceAccount = JSON.parse(raw);
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  return { auth: getAuth(app), db: getFirestore(app) };
}

async function resolverAuthUid(auth, { docId, correo }) {
  if (docId) {
    try {
      return (await auth.getUser(String(docId))).uid;
    } catch {
      /* no era uid de Auth */
    }
  }
  if (correo) {
    try {
      return (await auth.getUserByEmail(String(correo))).uid;
    } catch {
      /* sin coincidencia */
    }
  }
  return '';
}

async function run() {
  fs.writeFileSync(logFile, '', 'utf8');
  loadEnv();

  const { deriveUserClaims, isKnownRole } = loadClaimsDeriver();
  const { auth, db } = initAdmin();

  writeLog(`Modo: ${APPLY ? 'APPLY (escribe claims)' : 'DRY-RUN (solo reporta)'}`);

  const snapshot = await db.collection('usuarios_roles').get();
  let total = 0;
  let aplicados = 0;
  let sinResolver = 0;

  for (const snap of snapshot.docs) {
    const data = snap.data();
    const rolId = data?.rolId || data?.roleId;
    if (!rolId) continue;
    total += 1;

    if (!isKnownRole(rolId)) {
      writeLog(`  ${snap.id}: rol desconocido "${rolId}" — omitido`);
      continue;
    }

    const claims = deriveUserClaims({ rolId, alcance: data?.alcance });
    const authUid = await resolverAuthUid(auth, { docId: snap.id, correo: data?.correo });

    if (!authUid) {
      sinResolver += 1;
      writeLog(`  ${snap.id} (${rolId}): SIN usuario de Auth (correo: ${data?.correo || '-'}) — omitido`);
      continue;
    }

    writeLog(`  ${snap.id} → authUid ${authUid} (${rolId}): ${JSON.stringify(claims)}`);

    if (APPLY) {
      await auth.setCustomUserClaims(authUid, claims);
      aplicados += 1;
    }
  }

  writeLog(
    `Total con rol: ${total}; ${APPLY ? 'claims aplicados' : 'a aplicar'}: ${
      APPLY ? aplicados : total - sinResolver
    }; sin resolver Auth: ${sinResolver}`
  );
  writeLog('Backfill finalizado.');
}

run().catch((error) => {
  writeLog(`ERROR: ${error.stack || error.message}`);
  process.exitCode = 1;
});
