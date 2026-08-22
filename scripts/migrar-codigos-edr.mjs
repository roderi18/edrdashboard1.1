// ----------------------------------------------------------------------
// Migracion del codigo de miembro a EDR-NNNNN.
//
// Quita el pais y la provincia del codigo (`DO-SD-10002` -> `EDR-10002`) y deja
// el numero como estaba. Toca los tres sitios donde vive el codigo:
//
//   1. API .NET (`Miembros.codigoMiembro`).
//   2. Firebase Auth: el correo interno con el que entra
//      (`<codigo>@exploradores.app`) y, si todavia tiene la clave inicial,
//      tambien la clave.
//   3. Firestore: `users`, `usuarios_roles` y las copias del codigo en
//      `asignacionesDirectiva` y `organigrama_directiva_destacamentos`.
//
// Uso:
//   node scripts/migrar-codigos-edr.mjs             simulacion, no escribe nada
//   node scripts/migrar-codigos-edr.mjs --aplicar   escribe
// ----------------------------------------------------------------------

import fs from 'node:fs';
import { getAuth } from 'firebase-admin/auth';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APLICAR = process.argv.includes('--aplicar');
const PREFIJO = 'EDR';
const DOMINIO = 'exploradores.app';
const MIEMBROS = 'https://systexploradores.somee.com/api/Miembros';

const leerServiceAccount = () => {
  const texto = fs.readFileSync('.env.local', 'utf8');
  const linea = texto.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m);

  if (!linea) throw new Error('FIREBASE_SERVICE_ACCOUNT no esta en .env.local');

  const cuenta = JSON.parse(linea[1].replace(/^["']|["']$/g, ''));

  if (typeof cuenta.private_key === 'string') {
    cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n');
  }

  return cuenta;
};

const cuenta = leerServiceAccount();
const app = initializeApp({ credential: cert(cuenta), projectId: cuenta.project_id });
const auth = getAuth(app);
const db = getFirestore(app);

const normalizar = (codigo) =>
  String(codigo ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');

const correoDe = (codigo) => `${normalizar(codigo)}@${DOMINIO}`;

// El numero es el ultimo tramo del codigo: de `DO-SD-10002` sale 10002.
const numeroDe = (codigo) => {
  const partes = String(codigo ?? '')
    .trim()
    .split('-');

  return partes[partes.length - 1].replace(/\D/g, '');
};

const nuevoCodigo = (codigo) => {
  const numero = numeroDe(codigo);

  return numero ? `${PREFIJO}-${numero}` : '';
};

const filas = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;

  return [];
};

const traerMiembros = async () => {
  const res = await fetch(`${MIEMBROS}/GetAllMiembros?t=${Date.now()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`GetAllMiembros fallo (${res.status})`);

  return filas(await res.json());
};

const actualizarEnApi = async (miembro, codigo) => {
  const res = await fetch(`${MIEMBROS}/UpdateMiembros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...miembro, codigoMiembro: codigo }),
  });
  const texto = await res.text();

  if (!res.ok) throw new Error(`UpdateMiembros ${res.status}: ${texto.slice(0, 200)}`);

  return texto;
};

// Copias del codigo repartidas por las colecciones de directiva.
const actualizarCopias = async ({ coleccion, codigoViejo, codigoNuevo }) => {
  const snapshot = await db.collection(coleccion).where('codigoMiembro', '==', codigoViejo).get();

  if (snapshot.empty) return 0;

  if (APLICAR) {
    const lote = db.batch();

    snapshot.forEach((doc) => lote.update(doc.ref, { codigoMiembro: codigoNuevo }));
    await lote.commit();
  }

  return snapshot.size;
};

const migrarUno = async (miembro) => {
  const codigoViejo = String(miembro.codigoMiembro || '').trim();
  const codigoNuevo = nuevoCodigo(codigoViejo);
  const detalle = {
    id: miembro.idMiembros,
    nombre: `${miembro.nombres || ''} ${miembro.apellidos || ''}`.trim(),
    codigoViejo,
    codigoNuevo,
    api: 'sin cambios',
    auth: 'sin cuenta',
    firestore: [],
  };

  if (!codigoNuevo || codigoNuevo === codigoViejo) {
    return detalle;
  }

  if (APLICAR) {
    await actualizarEnApi(miembro, codigoNuevo);
  }

  detalle.api = APLICAR ? 'actualizado' : 'se actualizaria';

  const usuario = await auth.getUserByEmail(correoDe(codigoViejo)).catch(() => null);

  if (usuario) {
    // La clave inicial es el codigo en mayusculas. Solo se cambia a quien
    // todavia no ha elegido la suya: `debeCambiarClave` sigue puesto.
    const perfilRol = await db.collection('usuarios_roles').doc(String(miembro.idMiembros)).get();
    const conClaveInicial = perfilRol.exists && perfilRol.data()?.debeCambiarClave === true;

    if (APLICAR) {
      await auth.updateUser(usuario.uid, {
        email: correoDe(codigoNuevo),
        ...(conClaveInicial ? { password: codigoNuevo.toUpperCase() } : {}),
      });

      await db
        .collection('users')
        .doc(usuario.uid)
        .set(
          {
            email: correoDe(codigoNuevo),
            username: normalizar(codigoNuevo),
            codigoMiembro: codigoNuevo,
          },
          { merge: true }
        );

      if (perfilRol.exists) {
        await perfilRol.ref.set(
          { codigoMiembro: codigoNuevo, correo: correoDe(codigoNuevo) },
          { merge: true }
        );
      }
    }

    detalle.auth = `${APLICAR ? 'actualizado' : 'se actualizaria'}${
      conClaveInicial ? ' (+ clave inicial)' : ''
    }`;
  }

  for (const coleccion of ['asignacionesDirectiva', 'organigrama_directiva_destacamentos']) {
    // En serie: son dos consultas cortas por miembro.

    const total = await actualizarCopias({ coleccion, codigoViejo, codigoNuevo });

    if (total) detalle.firestore.push(`${coleccion}: ${total}`);
  }

  return detalle;
};

const main = async () => {
  const miembros = await traerMiembros();

  console.log(`Miembros en el API: ${miembros.length}`);
  console.log(APLICAR ? '>>> MODO ESCRITURA <<<' : '>>> simulacion (no escribe nada) <<<');

  // Colisiones: dos codigos distintos que acaben en el mismo numero se
  // convertirian en el mismo `EDR-...`. Si pasa, no se toca nada.
  const porNuevo = new Map();

  miembros.forEach((miembro) => {
    const codigo = nuevoCodigo(miembro.codigoMiembro);

    if (!codigo) return;

    porNuevo.set(codigo, [...(porNuevo.get(codigo) || []), miembro.codigoMiembro]);
  });

  const choques = [...porNuevo.entries()].filter(([, viejos]) => viejos.length > 1);

  if (choques.length) {
    console.error('COLISIONES: no se migra nada.');
    choques.forEach(([nuevo, viejos]) => console.error(`  ${nuevo} <- ${viejos.join(', ')}`));
    process.exit(1);
  }

  const resultados = [];

  for (const miembro of miembros) {
    // En serie: cada miembro toca el API y Firebase, y el API no lleva bien las
    // rafagas.

    resultados.push(await migrarUno(miembro));
  }

  resultados.forEach((r) => {
    console.log(
      `#${r.id} ${r.nombre}\n    ${r.codigoViejo} -> ${r.codigoNuevo || '(sin numero)'}\n    api: ${r.api} | auth: ${r.auth}${
        r.firestore.length ? ` | ${r.firestore.join(' | ')}` : ''
      }`
    );
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
