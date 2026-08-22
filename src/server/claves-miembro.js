import 'server-only';

import { randomInt, randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

import { getAdminDb, getAdminAuth } from 'src/server/firebase-admin';

import { PERMISOS } from 'src/auth/permissions/permissions';
import { PERMISOS_POR_ROL } from 'src/auth/permissions/role-permissions';

// ----------------------------------------------------------------------
// Claves de los miembros: quien puede tocarlas, como se guardan las huellas de
// las anteriores y como se genera una temporal.
//
// Las contraseñas NUNCA se guardan. De cada una queda una huella PBKDF2 con sal
// propia, que solo sirve para responder a una pregunta: "¿esta clave nueva es
// una de las que ya usaste?". De la huella no se puede volver a la clave.
// ----------------------------------------------------------------------

const COLECCION = 'usuarios_roles';
const DOMINIO_INTERNO = 'exploradores.app';

// Cuantas claves anteriores se recuerdan. Con cinco se cubre el reciclaje
// habitual sin guardar un rastro largo de nadie.
export const CLAVES_RECORDADAS = 5;

const ITERACIONES = 120000;
const LARGO_HUELLA = 32;

// Sin caracteres que se confunden al dictarla por telefono (O/0, I/l/1).
const ALFABETO_TEMPORAL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_CLAVE_TEMPORAL = 8;

export const normalizarCodigo = (codigo) =>
  String(codigo ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');

export const correoInternoDe = (codigo) => `${normalizarCodigo(codigo)}@${DOMINIO_INTERNO}`;

export const esCorreoInterno = (correo) =>
  String(correo ?? '')
    .trim()
    .toLowerCase()
    .endsWith(`@${DOMINIO_INTERNO}`);

// --- huellas ---

const calcularHuella = (clave, sal) =>
  pbkdf2Sync(String(clave), sal, ITERACIONES, LARGO_HUELLA, 'sha256').toString('hex');

export const crearHuellaClave = (clave) => {
  const sal = randomBytes(16).toString('hex');

  return { sal, huella: calcularHuella(clave, sal), creadaEn: new Date().toISOString() };
};

export const claveYaUsada = (clave, huellas = []) =>
  (Array.isArray(huellas) ? huellas : []).some((registro) => {
    if (!registro?.sal || !registro?.huella) return false;

    const calculada = Buffer.from(calcularHuella(clave, registro.sal), 'hex');
    const guardada = Buffer.from(String(registro.huella), 'hex');

    if (calculada.length !== guardada.length) return false;

    return timingSafeEqual(calculada, guardada);
  });

export const generarClaveTemporal = () =>
  Array.from(
    { length: LARGO_CLAVE_TEMPORAL },
    () => ALFABETO_TEMPORAL[randomInt(ALFABETO_TEMPORAL.length)]
  ).join('');

// --- perfil del miembro ---

/**
 * Documento de rol del miembro. Puede estar guardado con su id de miembro o con
 * el uid de su cuenta, segun quien lo creara.
 */
export const buscarPerfilMiembro = async ({ idMiembros, uid }) => {
  const db = getAdminDb();

  for (const id of [idMiembros, uid].filter(Boolean).map(String)) {
    // En serie: son dos lecturas y la primera suele bastar.

    const documento = await db.collection(COLECCION).doc(id).get();

    if (documento.exists) return documento;
  }

  return null;
};

/**
 * Cuenta de Firebase del miembro.
 *
 * Se busca por todos los caminos porque ninguno vale siempre: el perfil puede
 * estar guardado con el id del miembro o con el uid de la cuenta, puede no
 * llevar el uid dentro, y el correo interno deja de existir en cuanto el miembro
 * registra uno propio —justo cuando mas falta hace encontrarlo—.
 */
export const buscarCuentaMiembro = async ({ idMiembros, codigoMiembro, correo }) => {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const uids = new Set();

  const anotarUid = (documento) => {
    const datos = documento.data() || {};

    [datos.uid, datos.idUsuario, documento.id].filter(Boolean).forEach((valor) => uids.add(String(valor)));
  };

  const perfil = await buscarPerfilMiembro({ idMiembros });

  if (perfil) anotarUid(perfil);

  // Documentos que apuntan al miembro aunque no se llamen como el: son los que
  // crea la sesion, guardados con el uid por nombre.
  if (idMiembros) {
    await Promise.all(
      [COLECCION, 'users'].map(async (coleccion) => {
        const encontrados = await db
          .collection(coleccion)
          .where('idMiembros', '==', Number(idMiembros))
          .get()
          .catch(() => null);

        encontrados?.docs?.forEach(anotarUid);
      })
    );
  }

  for (const uid of uids) {
    // En serie: en cuanto una vale, no hay que probar la siguiente.

    const cuenta = await auth.getUser(uid).catch(() => null);

    if (cuenta) return cuenta;
  }

  const correos = [correo, codigoMiembro ? correoInternoDe(codigoMiembro) : '']
    .map((valor) => String(valor || '').trim().toLowerCase())
    .filter(Boolean);

  for (const direccion of correos) {
    // Idem: se prueban en orden.

    const cuenta = await auth.getUserByEmail(direccion).catch(() => null);

    if (cuenta) return cuenta;
  }

  return null;
};

/** Guarda la huella de la clave nueva y conserva solo las ultimas. */
export const registrarHuellaClave = async ({ idMiembros, uid, clave, extra = {} }) => {
  const db = getAdminDb();
  const documento = await buscarPerfilMiembro({ idMiembros, uid });
  const referencia = documento?.ref ?? db.collection(COLECCION).doc(String(idMiembros || uid));
  const anteriores = documento?.data()?.clavesAnteriores ?? [];

  await referencia.set(
    {
      ...extra,
      clavesAnteriores: [...anteriores, crearHuellaClave(clave)].slice(-CLAVES_RECORDADAS),
    },
    { merge: true }
  );
};

// --- permisos ---

const BEARER = /^Bearer\s+(.+)$/i;

export const leerToken = (req) => {
  const cabecera = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const coincidencia = cabecera.match(BEARER);

  return coincidencia ? coincidencia[1].trim() : '';
};

const rolDe = (datos) =>
  String(datos?.rolId || datos?.roleId || datos?.rol || datos?.role || '')
    .trim()
    .toLowerCase();

/** Quien llama: su uid, su id de miembro y si puede administrar a otros. */
export const identificarSolicitante = async (req) => {
  const token = leerToken(req);

  if (!token) return null;

  const decodificado = await getAdminAuth()
    .verifyIdToken(token)
    .catch(() => null);

  if (!decodificado?.uid) return null;

  const db = getAdminDb();
  const porUid = await db.collection(COLECCION).doc(decodificado.uid).get();
  let datos = porUid.exists ? porUid.data() : null;

  if (!datos) {
    const porCorreo = await db
      .collection(COLECCION)
      .where('uid', '==', decodificado.uid)
      .limit(1)
      .get()
      .catch(() => null);

    datos = porCorreo && !porCorreo.empty ? porCorreo.docs[0].data() : null;
  }

  const rol = rolDe(datos) || rolDe(decodificado);
  const permisos = PERMISOS_POR_ROL[rol] || [];

  return {
    uid: decodificado.uid,
    idMiembros: datos?.idMiembros ?? null,
    rol,
    // El Administrador Global esta por encima del catalogo; el resto entra por
    // el permiso de editar miembros, que es el que ya usa la ficha.
    puedeGestionarOtros:
      rol === 'administrador_global' || permisos.includes(PERMISOS.MIEMBROS_EDITAR),
  };
};
