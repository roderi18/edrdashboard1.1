// ----------------------------------------------------------------------
// Segunda pasada de la migracion a EDR-NNNNN: perfiles de rol y claves.
//
// La primera pasada (scripts/migrar-codigos-edr.mjs) cambio el codigo en la API,
// el correo de acceso en Firebase Auth y el documento `users`. Faltaba lo de
// `usuarios_roles`, que tiene documentos guardados con TRES claves distintas
// segun quien los creara: el id del miembro, el uid de Auth, o el propio codigo.
//
// Este script:
//   1. Deja el perfil canonico en `usuarios_roles/<idMiembros>` y lo pone al dia.
//   2. Actualiza el perfil que cuelga del uid, que es el que lee la sesion.
//   3. Traslada los que estan guardados bajo el codigo antiguo.
//   4. Borra los que no pertenecen a ningun miembro vivo.
//   5. Devuelve la clave inicial (el codigo en MAYUSCULAS) a quien todavia no ha
//      entrado nunca, y le deja marcado que debe cambiarla.
//
// NUNCA toca los perfiles administrativos ni los borra: son la puerta de entrada
// al panel y un descuido aqui deja al administrador fuera.
//
// Uso:
//   node scripts/limpiar-perfiles-edr.mjs             simulacion, no escribe nada
//   node scripts/limpiar-perfiles-edr.mjs --aplicar   escribe
// ----------------------------------------------------------------------

import fs from 'node:fs';
import { getAuth } from 'firebase-admin/auth';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APLICAR = process.argv.includes('--aplicar');
const DOMINIO = 'exploradores.app';
const MIEMBROS = 'https://systexploradores.somee.com/api/Miembros';
const COLECCION = 'usuarios_roles';

// Cualquier perfil con uno de estos roles queda intocable, y tambien el
// documento que lleve por nombre su `idMiembros`.
const ROLES_PROTEGIDOS = new Set([
  'admin',
  'administrador',
  'administrador_global',
  'administrador_funcional',
]);

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

// El numero identifica al miembro entre las formas viejas y la nueva:
// `DO-SD-111111205` y `EDR-111111205` son la misma persona.
const numeroDe = (codigo) => {
  const partes = String(codigo ?? '')
    .trim()
    .split('-');

  return partes[partes.length - 1].replace(/\D/g, '');
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

const esProtegido = (datos) => {
  const rol = String(datos?.rolId || datos?.roleId || datos?.rol || datos?.role || '')
    .trim()
    .toLowerCase();

  return ROLES_PROTEGIDOS.has(rol);
};

// Todavia usa la clave inicial: no ha completado el primer acceso. Se mira el
// PERFIL, no la fecha del ultimo acceso: entrar y quedarse en la pantalla de
// "Crea tu contraseña" cuenta como acceso para Firebase, pero la clave sigue
// siendo la publica, que es justo la que hay que renovar.
const usaClaveInicial = (perfiles = []) =>
  !perfiles.some(
    (perfil) => perfil?.debeCambiarClave === false || Boolean(perfil?.claveCambiadaEn)
  );

const main = async () => {
  console.log(APLICAR ? '>>> MODO ESCRITURA <<<' : '>>> simulacion (no escribe nada) <<<');

  const miembros = await traerMiembros();
  const snapshot = await db.collection(COLECCION).get();

  // --- indice de miembros vivos ---
  const vivos = [];

  for (const miembro of miembros) {
    // En serie: una consulta a Auth por miembro.

    const codigo = String(miembro.codigoMiembro || '').trim();
    const usuario = await auth.getUserByEmail(correoDe(codigo)).catch(() => null);

    vivos.push({
      id: String(miembro.idMiembros),
      codigo,
      numero: numeroDe(codigo),
      nombre: `${miembro.nombres || ''} ${miembro.apellidos || ''}`.trim(),
      uid: usuario?.uid || '',
      usuario,
    });
  }

  const porId = new Map(vivos.map((m) => [m.id, m]));
  const porUid = new Map(vivos.filter((m) => m.uid).map((m) => [m.uid, m]));
  const porNumero = new Map(vivos.filter((m) => m.numero).map((m) => [m.numero, m]));

  // Ids de miembro de los perfiles administrativos: sus documentos tampoco se
  // tocan aunque el miembro ya no exista en la API.
  const idsProtegidos = new Set();

  snapshot.forEach((documento) => {
    const datos = documento.data() || {};

    if (esProtegido(datos) && datos.idMiembros) idsProtegidos.add(String(datos.idMiembros));
  });

  const camposAlDia = (miembro) => ({
    idMiembros: Number(miembro.id),
    codigoMiembro: miembro.codigo,
    correo: correoDe(miembro.codigo),
  });

  const acciones = [];

  // --- 1, 2 y 3: poner al dia y trasladar ---
  for (const documento of snapshot.docs) {
    const datos = documento.data() || {};

    if (esProtegido(datos) || idsProtegidos.has(documento.id)) {
      acciones.push(`PROTEGIDO  ${documento.id} (${datos.rolId || datos.rol || 'sin rol'})`);
      continue;
    }

    // Un documento cuyo nombre es un NUMERO es el id de un miembro. Si ese
    // miembro ya no existe, el perfil sobra aunque su codigo termine en el mismo
    // numero que el de otro (`RD-SD-10002` y `EDR-10002` no son la misma
    // persona: son dos altas distintas que reutilizaron el numero).
    const idEsNumerico = /^\d+$/.test(documento.id);
    const miembro =
      porId.get(documento.id) ||
      porUid.get(documento.id) ||
      (idEsNumerico ? null : porNumero.get(numeroDe(datos.codigoMiembro)));

    if (!miembro) continue;

    const esCanonico = documento.id === miembro.id;
    const esDeUid = miembro.uid && documento.id === miembro.uid;
    const alDia =
      String(datos.codigoMiembro || '') === miembro.codigo &&
      String(datos.idMiembros || '') === miembro.id;

    if (esCanonico || esDeUid) {
      if (alDia) continue;

      if (APLICAR) {
        await documento.ref.set(camposAlDia(miembro), { merge: true });
      }

      acciones.push(
        `AL DIA     ${documento.id} (${esDeUid ? 'por uid' : 'canonico'}) ${datos.codigoMiembro} -> ${miembro.codigo}`
      );
      continue;
    }

    // Guardado bajo el codigo antiguo: se copia al documento canonico —sin pisar
    // lo que ya haya— y el viejo se borra.
    const canonico = db.collection(COLECCION).doc(miembro.id);
    const yaExiste = (await canonico.get()).exists;

    if (APLICAR) {
      if (!yaExiste) {
        await canonico.set({ ...datos, ...camposAlDia(miembro) });
      }

      await documento.ref.delete();
    }

    acciones.push(
      `TRASLADADO ${documento.id} -> ${miembro.id}${yaExiste ? ' (el canonico ya existia: solo se borra el viejo)' : ''}`
    );
  }

  // --- 4: huerfanos ---
  for (const documento of snapshot.docs) {
    const datos = documento.data() || {};

    if (esProtegido(datos) || idsProtegidos.has(documento.id)) continue;

    const idEsNumerico = /^\d+$/.test(documento.id);
    const miembro =
      porId.get(documento.id) ||
      porUid.get(documento.id) ||
      (idEsNumerico ? null : porNumero.get(numeroDe(datos.codigoMiembro)));

    if (miembro) continue;

    if (APLICAR) {
      await documento.ref.delete();
    }

    acciones.push(
      `BORRADO    ${documento.id} (${datos.codigoMiembro || 'sin codigo'} / ${datos.correo || 'sin correo'})`
    );
  }

  // --- 5: clave inicial de quien no ha entrado nunca ---
  for (const miembro of vivos) {
    if (!miembro.usuario) {
      acciones.push(`SIN CUENTA ${miembro.codigo} (${miembro.nombre})`);
      continue;
    }

    const perfiles = await Promise.all(
      [miembro.id, miembro.uid]
        .filter(Boolean)
        .map((id) => db.collection(COLECCION).doc(id).get())
    );
    const datosPerfiles = perfiles.filter((doc) => doc.exists).map((doc) => doc.data());

    if (!usaClaveInicial(datosPerfiles)) {
      acciones.push(`YA LA CAMBIO ${miembro.codigo} (${miembro.nombre}): no se toca su clave`);
      continue;
    }

    if (APLICAR) {
      await auth.updateUser(miembro.usuario.uid, { password: miembro.codigo.toUpperCase() });
      await db
        .collection(COLECCION)
        .doc(miembro.id)
        .set({ ...camposAlDia(miembro), debeCambiarClave: true }, { merge: true });
    }

    acciones.push(`CLAVE      ${miembro.codigo} (${miembro.nombre}) -> ${miembro.codigo.toUpperCase()}`);
  }

  acciones.forEach((linea) => console.log(linea));
  console.log(`\n${acciones.length} acciones${APLICAR ? ' aplicadas' : ' (simuladas)'}.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
