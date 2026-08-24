// Deja a cada cuenta con su ficha en `usuarios_roles/{uid}`.
//
// POR QUE: las reglas nuevas ya no se fian de "tener sesion" —cualquiera puede
// crearse una cuenta— sino de estar dado de alta, y lo comprueban mirando si
// existe `usuarios_roles/{uid}` o `admins/{uid}`. Pero el perfil de muchos
// miembros esta guardado con su ID DE MIEMBRO por nombre (`usuarios_roles/342`),
// no con el uid de su cuenta: para esos, la comprobacion diria que no y se
// quedarian fuera de la aplicacion.
//
// Este script busca a cada cuenta su perfil por donde sea (por el campo `uid`,
// por `users/{uid}.idMiembros`) y le deja una ficha en `usuarios_roles/{uid}`.
// El documento original NO se toca ni se borra: se anade el que falta.
//
// A las cuentas SIN ficha no se les crea nada: son justo las que las reglas
// nuevas tienen que dejar fuera (registros abiertos, pruebas, desconocidos). Se
// listan al final para que puedas revisarlas y borrarlas.
//
//   Reporte:  node scripts/permissions/backfill-usuarios-roles-por-uid.mjs
//   Aplicar:  node scripts/permissions/backfill-usuarios-roles-por-uid.mjs --apply
//
// ORDEN IMPORTANTE: primero este script en modo reporte, luego --apply, y SOLO
// DESPUES `firebase deploy --only firestore:rules`.
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
const logFile = path.join(__dirname, 'backfill-usuarios-roles-por-uid.log');

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

/** El perfil de esa cuenta, esté guardado como esté. */
async function buscarPerfil(db, usuario) {
  const porUid = await db.collection('usuarios_roles').doc(usuario.uid).get();

  if (porUid.exists) return { documento: porUid, via: 'ya_existe' };

  const porCampo = await db
    .collection('usuarios_roles')
    .where('uid', '==', usuario.uid)
    .limit(1)
    .get()
    .catch(() => null);

  if (porCampo && !porCampo.empty) {
    return { documento: porCampo.docs[0], via: 'campo_uid' };
  }

  // Los documentos antiguos no llevan el uid dentro; su id de miembro sí lo
  // escribe la sesión en `users`.
  const enUsers = await db.collection('users').doc(usuario.uid).get().catch(() => null);
  const idMiembros = enUsers?.exists ? enUsers.data()?.idMiembros : null;

  if (idMiembros) {
    const porId = await db.collection('usuarios_roles').doc(String(idMiembros)).get();

    if (porId.exists) return { documento: porId, via: 'id_miembro' };
  }

  return { documento: null, via: 'sin_ficha' };
}

async function main() {
  ENV_FILES.forEach((archivo) => parseEnvFile(path.join(rootDir, archivo)));
  iniciarAdmin();

  const auth = getAuth();
  const db = getFirestore();

  let siguiente;
  let total = 0;
  let yaEstaban = 0;
  const creados = [];
  const sinFicha = [];

  registrar(`[${new Date().toISOString()}] modo: ${APPLY ? 'APLICAR' : 'reporte'}`);

  do {
    // eslint-disable-next-line no-await-in-loop
    const pagina = await auth.listUsers(1000, siguiente);

    siguiente = pagina.pageToken;

    for (const usuario of pagina.users) {
      total += 1;

      // eslint-disable-next-line no-await-in-loop
      const { documento, via } = await buscarPerfil(db, usuario);

      if (via === 'ya_existe') {
        yaEstaban += 1;
        continue;
      }

      if (!documento) {
        sinFicha.push({ uid: usuario.uid, correo: usuario.email || '(sin correo)' });
        continue;
      }

      const datos = documento.data() || {};

      creados.push({ uid: usuario.uid, correo: usuario.email || '', desde: documento.id, via });

      if (APPLY) {
        // eslint-disable-next-line no-await-in-loop
        await db
          .collection('usuarios_roles')
          .doc(usuario.uid)
          .set({ ...datos, uid: usuario.uid }, { merge: true });
      }
    }
  } while (siguiente);

  registrar('');
  registrar(`Cuentas revisadas: ${total}`);
  registrar(`Ya tenían ficha por uid: ${yaEstaban}`);
  registrar(`Fichas ${APPLY ? 'creadas' : 'que se crearían'}: ${creados.length}`);

  creados.forEach(({ uid, correo, desde, via }) =>
    registrar(`  + ${uid} (${correo || 'sin correo'}) <- usuarios_roles/${desde} [${via}]`)
  );

  registrar('');
  registrar(`Cuentas SIN ficha (las reglas nuevas las dejarán fuera): ${sinFicha.length}`);

  sinFicha.forEach(({ uid, correo }) => registrar(`  ! ${uid} (${correo})`));

  if (sinFicha.length) {
    registrar('');
    registrar('Revisa esa lista ANTES de desplegar las reglas: si alguna es de una');
    registrar('persona real, dale de alta; el resto son cuentas que no deberían existir.');
  }

  if (!APPLY) {
    registrar('');
    registrar('Nada se escribió. Vuelve a ejecutarlo con --apply cuando la lista cuadre.');
  }

  fs.writeFileSync(logFile, `${lineas.join('\n')}\n`, 'utf8');
  registrar(`\nRegistro en ${path.relative(rootDir, logFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
