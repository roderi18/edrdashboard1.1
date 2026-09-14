import { ChatAuthorizationError, CHAT_AUTHORIZATION_CODES } from './chat-authorization-core.mjs';
import { CHAT_AUTH_CODES, extractBearerToken, ChatAuthenticationError } from './chat-auth-core.mjs';
import {
  ID_TIENDA_VIRTUAL,
  UID_TIENDA_VIRTUAL,
  puedeAtenderBuzonDeTienda,
} from '../utils/chat-tienda-virtual.mjs';

// ----------------------------------------------------------------------
// RESPONDER COMO TIENDA VIRTUAL, DESDE EL SERVIDOR.
//
// El chat escribe en Firestore con el token de quien pide, y las reglas solo le
// dejan tocar las conversaciones donde el es participante. Quien atiende el
// buzon no es participante de nada: la participante es la Tienda.
//
// Asi que el servidor hace dos cosas, y en este orden:
//
//   1. Comprueba que la PERSONA que pide ejerce uno de los cargos del buzon.
//   2. Solo entonces trabaja con la identidad de la Tienda: un token de Firebase
//      a nombre de `tienda-virtual`, con su `idMiembros`, que solo el servidor
//      puede emitir porque hace falta la cuenta de servicio.
//
// Con ese token el resto del chat funciona igual que para cualquiera —listar,
// enviar, marcar leido, recibos— y las reglas de Firestore siguen vigilando cada
// escritura. No hay un "modo administrador" que se salte nada.
//
// Aqui vive la logica pura, con sus dependencias inyectadas, para poder
// probarla sin Firebase. El cableado real esta en `chat-tienda.js`.
// ----------------------------------------------------------------------

const MARGEN_DE_CADUCIDAD_MS = 5 * 60_000;

/**
 * Emite el token de la Tienda: un token propio firmado con la cuenta de servicio
 * y canjeado en Firebase Auth por un ID token normal, que es lo que Firestore
 * entiende. El `idMiembros` va como claim, igual que en las sesiones de miembro.
 *
 * NO lleva `rol`: la Tienda no ejerce ningun cargo. Solo es participante de sus
 * conversaciones, y las reglas no le dejan hacer nada mas.
 */
export const crearEmisorDeTokenDeTienda = ({
  crearTokenPropio,
  apiKey,
  fetchImpl = fetch,
} = {}) => {
  if (typeof crearTokenPropio !== 'function' || typeof fetchImpl !== 'function') {
    throw new TypeError('El emisor del token de la Tienda requiere dependencias válidas.');
  }

  return async () => {
    if (!apiKey) {
      throw new Error('Falta NEXT_PUBLIC_FIREBASE_API_KEY para emitir el token de la Tienda.');
    }

    const tokenPropio = await crearTokenPropio(UID_TIENDA_VIRTUAL, {
      idMiembros: ID_TIENDA_VIRTUAL,
    });
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
      throw new Error(datos?.error?.message || 'Firebase Auth no emitió el token de la Tienda.');
    }

    return { token: datos.idToken, expiraEnSegundos: Number(datos.expiresIn) || 3600 };
  };
};

/**
 * El token de la Tienda, guardado mientras dura.
 *
 * Emitirlo son dos viajes (firmar el token propio y canjearlo en Firebase Auth):
 * sin guardarlo, cada "escribiendo..." del administrador los repetia.
 */
export const crearProveedorDeTokenDeTienda = ({ emitirToken, now = () => Date.now() } = {}) => {
  if (typeof emitirToken !== 'function') {
    throw new TypeError('El token de la Tienda necesita una forma de emitirse.');
  }

  let guardado = null;
  let enCurso = null;

  return async () => {
    if (guardado && guardado.caducaEn - MARGEN_DE_CADUCIDAD_MS > now()) return guardado.token;
    if (enCurso) return enCurso;

    enCurso = Promise.resolve(emitirToken())
      .then(({ token, expiraEnSegundos = 3600 }) => {
        if (!token) throw new Error('Firebase no devolvio el token de la Tienda.');

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
    'Administración de la tienda'
  );
};

const idMiembrosDelResponsable = (claims = {}, perfiles = []) => {
  const candidato = [claims.idMiembros, ...perfiles.map((perfil) => perfil?.idMiembros)]
    .map(Number)
    .find((valor) => Number.isSafeInteger(valor) && valor > 0 && valor !== ID_TIENDA_VIRTUAL);

  return candidato ?? null;
};

/**
 * Autentica una peticion que quiere actuar como la Tienda Virtual.
 *
 * Devuelve un actor del chat como los demas —`uid`, `idMiembros`, `token`—, pero
 * a nombre de la Tienda, y con `responsable`: la persona de verdad que contesto,
 * para dejar constancia sin que el miembro la vea.
 */
export const crearAutenticadorDeBuzonDeTienda = ({
  verifyIdToken,
  cargarPerfiles,
  obtenerTokenDeTienda,
} = {}) => {
  if (
    typeof verifyIdToken !== 'function' ||
    typeof cargarPerfiles !== 'function' ||
    typeof obtenerTokenDeTienda !== 'function'
  ) {
    throw new TypeError('El buzón de la Tienda requiere dependencias válidas.');
  }

  return async (request) => {
    const token = extractBearerToken(request?.headers);

    if (!token) {
      throw new ChatAuthenticationError('Falta el token Bearer de autorización.', {
        status: 401,
        code: CHAT_AUTH_CODES.MISSING_TOKEN,
      });
    }

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

    // El token de la PROPIA Tienda no sirve para pedir en su nombre: solo lo
    // tiene el servidor, y si alguna vez se filtrara no debe abrir el buzon.
    if (!uid || uid === UID_TIENDA_VIRTUAL) {
      throw new ChatAuthenticationError('El token Firebase no contiene una identidad válida.', {
        status: 401,
        code: CHAT_AUTH_CODES.INVALID_TOKEN,
      });
    }

    const perfiles = await cargarPerfiles({ uid, claims });

    if (!puedeAtenderBuzonDeTienda({ claims, perfiles })) {
      throw new ChatAuthorizationError(
        'Solo quien administra la tienda puede atender los chats de la Tienda Virtual.',
        { code: CHAT_AUTHORIZATION_CODES.PERMISSION_DENIED }
      );
    }

    return {
      uid: UID_TIENDA_VIRTUAL,
      email: '',
      idMiembros: ID_TIENDA_VIRTUAL,
      profile: {},
      claims: { idMiembros: ID_TIENDA_VIRTUAL },
      token: await obtenerTokenDeTienda(),
      esTiendaVirtual: true,
      responsable: {
        uid,
        nombre: nombreDelResponsable(claims, perfiles),
        idMiembros: idMiembrosDelResponsable(claims, perfiles),
      },
    };
  };
};
