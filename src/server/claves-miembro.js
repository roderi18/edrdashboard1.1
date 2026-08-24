import 'server-only';

import { randomInt, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

import { getAdminDb, getAdminAuth } from 'src/server/firebase-admin';
import { leerSecretos, guardarSecretos } from 'src/server/secretos-acceso';
import {
  ROLES_ASIGNADOS_A_MANO,
  resolverRolesPorAsignaciones,
} from 'src/catalogs/directiva-roles';

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

// Copia del NUMERO del miembro, solo para poder buscar su perfil sin sesion.
//
// El numero y no el codigo entero porque el prefijo depende de la provincia
// (`SD-`, `DO-SD-`...) y el miembro no se lo sabe: en el inicio de sesion
// escribe solo su numero. El campo original se deja como este, que cada
// documento lo trae de una procedencia distinta.
export const CAMPO_BUSQUEDA_NUMERO = 'numeroMiembroBusqueda';

// Cuantas claves anteriores se recuerdan. Con cinco se cubre el reciclaje
// habitual sin guardar un rastro largo de nadie.
export const CLAVES_RECORDADAS = 5;

const ITERACIONES = 120000;
const LARGO_HUELLA = 32;

// Sin caracteres que se confunden al dictarlo por telefono (O/0, I/l/1).
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO_UN_USO = 8;

// Cuanto vive el codigo de un solo uso. Un dia entero cubre el caso real: el
// coordinador lo genera cuando puede y el miembro lo usa cuando llega a un
// computador, aunque sea al dia siguiente y sin tener que coincidir con el.
//
// De aqui salen tambien el texto que ve el coordinador en pantalla y lo que
// devuelve la API: cambiar este numero cambia los tres a la vez.
export const HORAS_CODIGO_UN_USO = 24;
export const MINUTOS_CODIGO_UN_USO = HORAS_CODIGO_UN_USO * 60;

// Intentos de escribir el codigo antes de tirarlo. Ocho caracteres de un
// alfabeto de treinta y dos no se adivinan a mano, pero el limite cierra la
// puerta a probar en bucle.
export const INTENTOS_CODIGO_UN_USO = 5;

// El numero es la parte final del codigo: en `EDR-10011` es 10011.
export const numeroDeCodigoMiembro = (codigo) => {
  const partes = String(codigo ?? '').split('-');

  return partes[partes.length - 1].replace(/\D/g, '');
};

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

export const generarCodigoUnUso = () =>
  Array.from(
    { length: LARGO_CODIGO_UN_USO },
    () => ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
  ).join('');

// --- codigo de un solo uso ---
//
// El codigo NO es la contraseña del miembro: no toca la que tiene, solo da
// derecho a elegir otra. Del codigo se guarda una huella, igual que de las
// claves, asi que ni quien lea la base de datos puede usarlo.

/** Lo que queda guardado en el perfil al generar un codigo. */
export const crearCodigoUnUso = ({ uid, generadoPor }) => {
  const codigo = generarCodigoUnUso();
  const { sal, huella } = crearHuellaClave(codigo);
  const expiraEn = new Date(Date.now() + MINUTOS_CODIGO_UN_USO * 60 * 1000).toISOString();

  return {
    codigo,
    expiraEn,
    registro: {
      sal,
      huella,
      uid: String(uid || ''),
      generadoPor: generadoPor || null,
      creadoEn: new Date().toISOString(),
      expiraEn,
      intentos: 0,
    },
  };
};

export const codigoVigente = (registro) => {
  if (!registro?.sal || !registro?.huella) return false;
  if (Number(registro.intentos || 0) >= INTENTOS_CODIGO_UN_USO) return false;

  const expira = registro.expiraEn ? new Date(registro.expiraEn).getTime() : 0;

  return Number.isFinite(expira) && expira > Date.now();
};

/** ¿Es este el codigo guardado? Compara huellas, nunca el codigo en claro. */
export const codigoCoincide = (codigo, registro) =>
  claveYaUsada(String(codigo ?? '').trim().toUpperCase(), [registro]);

// --- la marca de "todavia no ha elegido contraseña" ---
//
// Vive en los claims del token y no solo en Firestore, porque el guarda del
// navegador (`auth-guard`) no vincula a nadie: quien entra con un codigo de un
// solo uso tiene un token perfectamente valido, y sin esta marca el SERVIDOR no
// tenia forma de negarle lo que no fuera elegir su clave.

export const marcarDebeCambiarClave = async (uid, debeCambiarClave) => {
  if (!uid) return;

  const auth = getAdminAuth();
  // Los claims se reemplazan enteros, no se mezclan: hay que traerse los que ya
  // tuviera (su rol, su id de miembro) o se pierden.
  const actuales = (await auth.getUser(String(uid)).catch(() => null))?.customClaims ?? {};

  await auth.setCustomUserClaims(String(uid), { ...actuales, debeCambiarClave });
};

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
 * Perfiles del miembro que tiene ese numero.
 *
 * Quien entra con un codigo de un solo uso todavia no tiene sesion, asi que no
 * hay uid por donde empezar: se busca por el numero que acaba de escribir. El
 * campo lo deja puesto el propio generador del codigo, para no depender de como
 * estuviera guardado antes en cada documento.
 */
export const buscarPerfilesPorNumeroMiembro = async (numero) => {
  const buscado = numeroDeCodigoMiembro(numero);

  if (!buscado) return [];

  const encontrados = await getAdminDb()
    .collection(COLECCION)
    .where(CAMPO_BUSQUEDA_NUMERO, '==', buscado)
    .get()
    .catch((error) => {
      console.error('[claves-miembro] no se pudo buscar el perfil por numero', error);

      return null;
    });

  return encontrados?.docs ?? [];
};

// Un uid de Firebase son 28 caracteres de letras y numeros. El id de un miembro
// (`342`) tambien acaba en la lista de candidatos, y preguntar por el gasta un
// viaje entero para que Firebase responda que no existe.
const pareceUid = (valor) => /^[A-Za-z0-9]{20,128}$/.test(valor) && !/^\d+$/.test(valor);

/**
 * La cuenta del miembro Y el perfil donde se encontro.
 *
 * Los dos juntos porque quien busca la cuenta casi siempre necesita despues el
 * perfil, y buscarlo dos veces son dos viajes a Firestore por nada.
 *
 * Se busca por todos los caminos porque ninguno vale siempre: el perfil puede
 * estar guardado con el id del miembro o con el uid de la cuenta, puede no
 * llevar el uid dentro, y el correo interno deja de existir en cuanto el miembro
 * registra uno propio —justo cuando mas falta hace encontrarlo—.
 */
export const buscarAccesoMiembro = async ({ idMiembros, codigoMiembro, correo }) => {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const uids = new Set();

  const anotarUid = (documento) => {
    const datos = documento.data() || {};

    [datos.uid, datos.idUsuario, documento.id].filter(Boolean).forEach((valor) => uids.add(String(valor)));
  };

  // El perfil y los documentos que apuntan al miembro, a la vez: son consultas
  // independientes y encadenarlas doblaba la espera.
  const [perfilPorId, porCampo] = await Promise.all([
    buscarPerfilMiembro({ idMiembros }),
    idMiembros
      ? Promise.all(
          // Documentos que apuntan al miembro aunque no se llamen como el: son
          // los que crea la sesion, guardados con el uid por nombre.
          [COLECCION, 'users'].map((coleccion) =>
            db
              .collection(coleccion)
              .where('idMiembros', '==', Number(idMiembros))
              .get()
              .catch(() => null)
          )
        )
      : [],
  ]);

  if (perfilPorId) anotarUid(perfilPorId);

  const [deRoles] = porCampo;

  porCampo.forEach((encontrados) => encontrados?.docs?.forEach(anotarUid));

  // El perfil: el que se llama como el miembro y, si no lo hay, el que le
  // apunta desde `usuarios_roles`.
  const perfil = perfilPorId ?? deRoles?.docs?.[0] ?? null;

  // En paralelo y solo los que pueden ser un uid. Se respeta el orden en que se
  // anotaron: el primero es el que trae el propio perfil.
  const candidatos = [...uids].filter(pareceUid);
  const cuentas = candidatos.length
    ? await Promise.all(candidatos.map((uid) => auth.getUser(uid).catch(() => null)))
    : [];
  const porUid = cuentas.find(Boolean);

  if (porUid) return { cuenta: porUid, perfil };

  const correos = [correo, codigoMiembro ? correoInternoDe(codigoMiembro) : '']
    .map((valor) => String(valor || '').trim().toLowerCase())
    .filter(Boolean);
  const porCorreo = correos.length
    ? (
        await Promise.all(correos.map((direccion) => auth.getUserByEmail(direccion).catch(() => null)))
      ).find(Boolean)
    : null;

  return { cuenta: porCorreo ?? null, perfil };
};

/** Solo la cuenta, para quien no necesita el perfil. */
export const buscarCuentaMiembro = async (datos) => (await buscarAccesoMiembro(datos)).cuenta;

/** Las huellas de las claves que ya uso ese miembro. */
export const huellasDeClavesAnteriores = async ({ idMiembros, uid, perfil = null }) => {
  const documento = perfil ?? (await buscarPerfilMiembro({ idMiembros, uid }));
  const id = documento?.id ?? String(idMiembros || uid || '');
  const { clavesAnteriores } = await leerSecretos(id, documento);

  return clavesAnteriores;
};

/**
 * Guarda la huella de la clave nueva y conserva solo las ultimas.
 *
 * La huella va a `secretos_acceso`, que el cliente no puede leer; en el perfil
 * queda solo lo que la sesion si necesita ver (`extra`).
 */
export const registrarHuellaClave = async ({ idMiembros, uid, clave, extra = {} }) => {
  const db = getAdminDb();
  const documento = await buscarPerfilMiembro({ idMiembros, uid });
  const referencia = documento?.ref ?? db.collection(COLECCION).doc(String(idMiembros || uid));
  const id = documento?.id ?? String(idMiembros || uid);
  const { clavesAnteriores } = await leerSecretos(id, documento);

  await Promise.all([
    referencia.set({ ...extra }, { merge: true }),
    guardarSecretos(id, {
      clavesAnteriores: [...clavesAnteriores, crearHuellaClave(clave)].slice(-CLAVES_RECORDADAS),
      // La clave nueva es suya: el codigo del Coordinador existia solo para
      // llegar hasta aqui.
      codigoRestablecimiento: null,
    }),
  ]);
};

// --- permisos ---

const BEARER = /^Bearer\s+(.+)$/i;

export const leerToken = (req) => {
  const cabecera = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const coincidencia = cabecera.match(BEARER);

  return coincidencia ? coincidencia[1].trim() : '';
};

const COLECCION_ASIGNACIONES = 'asignacionesDirectiva';

/**
 * Los cargos que la persona ocupa en el organigrama.
 *
 * El campo `rol` del perfil no basta: toda la directiva entra con sesion de
 * MIEMBRO, y el Coordinador de un destacamento lo es por la casilla que ocupa,
 * no por un rol guardado. Preguntando solo por el campo, el servidor le trataba
 * como un miembro comun y le negaba lo que la pantalla si le deja hacer.
 */
const cargosDelSolicitante = async (idMiembros) => {
  if (!idMiembros) return [];

  const encontrados = await getAdminDb()
    .collection(COLECCION_ASIGNACIONES)
    .where('idMiembro', '==', String(idMiembros))
    .get()
    .catch((error) => {
      // Sin cargos no se inventa nada, pero que se sepa por que: quedarse
      // callado aqui es lo que convierte a un Coordinador en "tu rol no puede".
      console.error('[claves-miembro] no se pudieron leer los cargos', error);

      return null;
    });

  return resolverRolesPorAsignaciones(
    // `activo` se filtra aqui y no en la consulta: las asignaciones antiguas no
    // llevan el campo, y pedirselo a Firestore las dejaba fuera.
    (encontrados?.docs ?? [])
      .map((documento) => ({ id: documento.id, ...documento.data() }))
      .filter((asignacion) => asignacion.activo !== false)
  );
};

/**
 * Su id de miembro. Del perfil casi siempre, pero hay documentos antiguos que no
 * lo llevan: entonces se busca en `users`, que la sesion si escribe.
 */
const idMiembrosDelSolicitante = async (datos, uid) => {
  if (datos?.idMiembros) return datos.idMiembros;

  const documento = await getAdminDb()
    .collection('users')
    .doc(uid)
    .get()
    .catch(() => null);

  return documento?.data()?.idMiembros ?? null;
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
  const idMiembros = await idMiembrosDelSolicitante(datos, decodificado.uid);

  // Los administradores se nombran a mano y no salen de ninguna casilla: para
  // ellos no hay nada que buscar en el organigrama.
  const cargos = ROLES_ASIGNADOS_A_MANO.includes(rol)
    ? []
    : await cargosDelSolicitante(idMiembros);

  // Los poderes se SUMAN, igual que en la sesion del navegador: el rol guardado
  // mas lo que le da cada uno de sus cargos.
  const permisos = new Set([
    ...(PERMISOS_POR_ROL[rol] || []),
    ...cargos.flatMap((cargo) => PERMISOS_POR_ROL[cargo.rol] || []),
  ]);

  const esAdministradorGlobal = rol === 'administrador_global';
  const puedeGestionarOtros = esAdministradorGlobal || permisos.has(PERMISOS.MIEMBROS_EDITAR);
  const puedeCrearMiembros = esAdministradorGlobal || permisos.has(PERMISOS.MIEMBROS_CREAR);

  if (!puedeGestionarOtros) {
    // Lo que hay que mirar cuando alguien dice "pero si soy Coordinador": casi
    // siempre es que su perfil no lleva el id de miembro con el que estan
    // guardadas sus asignaciones.
    console.warn('[claves-miembro] solicitante sin permiso para gestionar a otros', {
      uid: decodificado.uid,
      idMiembros,
      rol,
      cargos: cargos.map((cargo) => cargo.rol),
    });
  }

  return {
    uid: decodificado.uid,
    idMiembros,
    rol,
    cargos,
    puedeGestionarOtros,
    puedeCrearMiembros,
    // La marca viaja en los claims desde que se crea la cuenta: quien todavia no
    // ha elegido contraseña no puede hacer nada mas que elegirla.
    debeCambiarClave: decodificado.debeCambiarClave === true,
  };
};
