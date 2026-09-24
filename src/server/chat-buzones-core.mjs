import { ChatAuthorizationError, CHAT_AUTHORIZATION_CODES } from './chat-authorization-core.mjs';
import { CHAT_AUTH_CODES, extractBearerToken, ChatAuthenticationError } from './chat-auth-core.mjs';
import {
  esUidDeBuzon,
  puedeAtenderBuzon,
  esIdReservadoDeBuzon,
  ejerceAdministracionGlobal,
} from '../utils/chat-buzones.mjs';

// ----------------------------------------------------------------------
// RESPONDER COMO UN BUZON COMPARTIDO, DESDE EL SERVIDOR.
//
// El chat escribe en Firestore con el token de quien pide, y las reglas solo le
// dejan tocar las conversaciones donde el es participante. Quien atiende un
// buzon no es participante de nada: el participante es el buzon.
//
// Asi que el servidor hace dos cosas, y en este orden:
//
//   1. Comprueba que la PERSONA que pide ejerce uno de los cargos de ESE buzon.
//   2. Solo entonces trabaja con la identidad del buzon: un token de Firebase a
//      su nombre (`tienda-virtual`, `oficina-nacional`), con su `idMiembros`,
//      que solo el servidor puede emitir porque hace falta la cuenta de servicio.
//
// Con ese token el resto del chat funciona igual que para cualquiera —listar,
// enviar, marcar leido, recibos— y las reglas de Firestore siguen vigilando cada
// escritura. No hay un "modo administrador" que se salte nada.
//
// Nacio para la Tienda Virtual (`chat-tienda-core.mjs` conserva sus nombres). Aqui
// vive la logica pura, con sus dependencias inyectadas, para poder probarla sin
// Firebase. El cableado real esta en `chat-buzones.js`.
// ----------------------------------------------------------------------

const MARGEN_DE_CADUCIDAD_MS = 5 * 60_000;

const exigirBuzon = (buzon) => {
  if (!buzon?.uid || !buzon?.idMiembros) {
    throw new TypeError('Hace falta el buzón compartido con el que se trabaja.');
  }
};

/**
 * Emite el token de un buzon: un token propio firmado con la cuenta de servicio
 * y canjeado en Firebase Auth por un ID token normal, que es lo que Firestore
 * entiende. El `idMiembros` va como claim, igual que en las sesiones de miembro.
 *
 * NO lleva `rol`: un buzon no ejerce ningun cargo. Solo es participante de sus
 * conversaciones, y las reglas no le dejan hacer nada mas.
 */
export const crearEmisorDeTokenDeBuzon = ({
  buzon,
  crearTokenPropio,
  apiKey,
  fetchImpl = fetch,
} = {}) => {
  exigirBuzon(buzon);

  if (typeof crearTokenPropio !== 'function' || typeof fetchImpl !== 'function') {
    throw new TypeError(`El emisor del token de ${buzon.nombre} requiere dependencias válidas.`);
  }

  return async () => {
    if (!apiKey) {
      throw new Error(
        `Falta NEXT_PUBLIC_FIREBASE_API_KEY para emitir el token de ${buzon.nombre}.`
      );
    }

    const tokenPropio = await crearTokenPropio(buzon.uid, { idMiembros: buzon.idMiembros });
    const respuesta = await fetchImpl(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenPropio, returnSecureToken: true }),
        cache: 'no-store',
      }
    );
    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !datos.idToken) {
      throw new Error(
        datos?.error?.message || `Firebase Auth no emitió el token de ${buzon.nombre}.`
      );
    }

    return { token: datos.idToken, expiraEnSegundos: Number(datos.expiresIn) || 3600 };
  };
};

/**
 * El token de un buzon, guardado mientras dura.
 *
 * Emitirlo son dos viajes (firmar el token propio y canjearlo en Firebase Auth):
 * sin guardarlo, cada "escribiendo..." de quien atiende los repetia.
 */
export const crearProveedorDeTokenDeBuzon = ({ emitirToken, now = () => Date.now() } = {}) => {
  if (typeof emitirToken !== 'function') {
    throw new TypeError('El token del buzón necesita una forma de emitirse.');
  }

  let guardado = null;
  let enCurso = null;

  return async () => {
    if (guardado && guardado.caducaEn - MARGEN_DE_CADUCIDAD_MS > now()) return guardado.token;
    if (enCurso) return enCurso;

    enCurso = Promise.resolve(emitirToken())
      .then(({ token, expiraEnSegundos = 3600 }) => {
        if (!token) throw new Error('Firebase no devolvio el token del buzón.');

        guardado = { token, caducaEn: now() + Number(expiraEnSegundos) * 1000 };

        return token;
      })
      .finally(() => {
        enCurso = null;
      });

    return enCurso;
  };
};

const nombreDelResponsable = (claims = {}, perfiles = []) => {
  const perfil = perfiles.find((item) => item?.nombre || item?.nombres) ?? {};

  return (
    String(perfil.nombre ?? '').trim() ||
    [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ').trim() ||
    String(claims.name ?? '').trim() ||
    String(claims.email ?? '').trim() ||
    'Administración'
  );
};

// EL USUARIO con el que entra quien contesto: su codigo de miembro si lo tiene
// —es lo que identifica a una persona en toda la aplicacion— y si no, su correo.
// El nombre solo no basta para auditar: hay nombres repetidos.
const usuarioDelResponsable = (claims = {}, perfiles = []) =>
  [
    ...perfiles.flatMap((item) => [item?.codigoMiembro, item?.codigoUsuario]),
    claims.codigoMiembro,
    claims.email,
    ...perfiles.flatMap((item) => [item?.correo, item?.email]),
  ]
    .map((valor) => String(valor ?? '').trim())
    .find(Boolean) || '';

const correoDelResponsable = (claims = {}, perfiles = []) =>
  [claims.email, ...perfiles.flatMap((item) => [item?.correo, item?.email])]
    .map((valor) => String(valor ?? '').trim())
    .find(Boolean) || '';

// La persona que contesto, nunca el numero de un buzon.
const idMiembrosDelResponsable = (claims = {}, perfiles = []) => {
  const candidato = [claims.idMiembros, ...perfiles.map((perfil) => perfil?.idMiembros)]
    .map(Number)
    .find((valor) => Number.isSafeInteger(valor) && valor > 0 && !esIdReservadoDeBuzon(valor));

  return candidato ?? null;
};

/**
 * Autentica una peticion que quiere actuar como un buzon compartido.
 *
 * Devuelve un actor del chat como los demas —`uid`, `idMiembros`, `token`—, pero
 * a nombre del buzon, y con `responsable`: la persona de verdad que contesto,
 * para dejar constancia sin que el miembro la vea.
 */
// El `uid` que dice traer un token, SIN verificarlo. Solo sirve para adelantar
// lecturas en el servidor: nada de lo leído se usa hasta que `verifyIdToken`
// confirma que el token es auténtico y es de ese mismo `uid`.
const uidSinVerificar = (token) => {
  try {
    const [, cuerpo] = String(token).split('.');
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));

    return String(datos?.user_id ?? datos?.sub ?? '').trim();
  } catch {
    return '';
  }
};

export const crearAutenticadorDeBuzon = ({
  buzon,
  verifyIdToken,
  cargarPerfiles,
  obtenerTokenDeBuzon,
} = {}) => {
  exigirBuzon(buzon);

  if (
    typeof verifyIdToken !== 'function' ||
    typeof cargarPerfiles !== 'function' ||
    typeof obtenerTokenDeBuzon !== 'function'
  ) {
    throw new TypeError(`El buzón de ${buzon.nombre} requiere dependencias válidas.`);
  }

  return async (request) => {
    const token = extractBearerToken(request?.headers);

    if (!token) {
      throw new ChatAuthenticationError('Falta el token Bearer de autorización.', {
        status: 401,
        code: CHAT_AUTH_CODES.MISSING_TOKEN,
      });
    }

    // EN PARALELO, SIN BAJAR LA GUARDIA. Antes iba en fila: verificar el token,
    // leer los perfiles, pedir el token del buzón (~600 ms la primera vez, y el
    // contador de no leídos esperaba a dos buzones). Ahora las tres cosas
    // arrancan a la vez, pero:
    //   - los perfiles adelantados solo valen si el token verificado es de ese
    //     mismo uid (si no, se leen otra vez con el bueno);
    //   - el token del buzón solo se entrega tras comprobar el cargo.
    const uidAdelantado = uidSinVerificar(token);
    const perfilesAdelantados = uidAdelantado
      ? Promise.resolve()
          .then(() => cargarPerfiles({ uid: uidAdelantado, claims: {} }))
          .catch(() => null)
      : Promise.resolve(null);
    const tokenDelBuzon = Promise.resolve().then(() => obtenerTokenDeBuzon());
    // Si al final no se entrega (token malo, sin cargo), que su fallo no quede
    // como promesa rechazada sin atender.
    tokenDelBuzon.catch(() => {});

    let claims;

    try {
      claims = await verifyIdToken(token);
    } catch (error) {
      throw new ChatAuthenticationError('El token Firebase es inválido, expiró o fue revocado.', {
        status: 401,
        code: CHAT_AUTH_CODES.INVALID_TOKEN,
        cause: error,
      });
    }

    const uid = String(claims?.uid ?? '').trim();

    // El token de un BUZON no sirve para pedir en nombre de nadie: solo lo tiene
    // el servidor, y si alguna vez se filtrara no debe abrir ningun buzon.
    if (!uid || esUidDeBuzon(uid) || esIdReservadoDeBuzon(claims?.idMiembros)) {
      throw new ChatAuthenticationError('El token Firebase no contiene una identidad válida.', {
        status: 401,
        code: CHAT_AUTH_CODES.INVALID_TOKEN,
      });
    }

    const adelantados = uid === uidAdelantado ? await perfilesAdelantados : null;
    const perfiles = adelantados ?? (await cargarPerfiles({ uid, claims }));

    if (!puedeAtenderBuzon(buzon, { claims, perfiles })) {
      throw new ChatAuthorizationError(
        `Solo quien tiene acceso puede atender los chats de ${buzon.nombre}.`,
        { code: CHAT_AUTHORIZATION_CODES.PERMISSION_DENIED }
      );
    }

    return {
      uid: buzon.uid,
      email: '',
      idMiembros: buzon.idMiembros,
      profile: {},
      claims: { idMiembros: buzon.idMiembros },
      token: await tokenDelBuzon,
      buzon: buzon.clave,
      esBuzonCompartido: true,
      esTiendaVirtual: buzon.clave === 'tienda',
      // QUIEN CONTESTA DE VERDAD, para la auditoria: nombre, usuario y correo.
      // Se guarda aparte del mensaje y en Historial; solo el Administrador
      // Global lo ve en la conversacion.
      responsable: {
        uid,
        nombre: nombreDelResponsable(claims, perfiles),
        usuario: usuarioDelResponsable(claims, perfiles),
        correo: correoDelResponsable(claims, perfiles),
        idMiembros: idMiembrosDelResponsable(claims, perfiles),
        esAdministradorGlobal: ejerceAdministracionGlobal({ claims, perfiles }),
      },
    };
  };
};
