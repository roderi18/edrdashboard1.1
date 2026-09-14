import 'server-only';

import { UID_TIENDA_VIRTUAL, CARGOS_DEL_BUZON_DE_TIENDA } from 'src/utils/chat-tienda-virtual.mjs';

import { getAdminDb, getAdminAuth } from 'src/server/firebase-admin';

import {
  crearEmisorDeTokenDeTienda,
  crearProveedorDeTokenDeTienda,
  crearAutenticadorDeBuzonDeTienda,
} from './chat-tienda-core.mjs';

// ----------------------------------------------------------------------
// El cableado con Firebase del buzon de la Tienda. La logica —y el porque— esta
// en `chat-tienda-core.mjs`.
// ----------------------------------------------------------------------

const COLECCION_RESPUESTAS = 'respuestas_tienda';

export const obtenerTokenDeTienda = crearProveedorDeTokenDeTienda({
  emitirToken: crearEmisorDeTokenDeTienda({
    crearTokenPropio: (uid, claims) => getAdminAuth().createCustomToken(uid, claims),
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  }),
});

/** Los perfiles de los que se fia el servidor: `usuarios_roles` y `admins`. */
const cargarPerfilesDeConfianza = async ({ uid }) => {
  const db = getAdminDb();
  const perfiles = [];
  const vistos = new Set();

  const anadir = (coleccion, snapshot) => {
    if (!snapshot?.exists) return;

    const clave = `${coleccion}/${snapshot.id}`;

    if (vistos.has(clave)) return;

    vistos.add(clave);
    perfiles.push({ collection: coleccion, id: snapshot.id, ...(snapshot.data() ?? {}) });
  };

  await Promise.all(
    ['usuarios_roles', 'admins'].map(async (coleccion) => {
      const referencia = db.collection(coleccion);
      const [directo, ...porCampo] = await Promise.all([
        referencia.doc(uid).get(),
        ...['uid', 'uidUsuario', 'idUsuario'].map((campo) =>
          referencia.where(campo, '==', uid).limit(2).get()
        ),
      ]);

      anadir(coleccion, directo);
      porCampo.forEach((consulta) => consulta.docs.forEach((doc) => anadir(coleccion, doc)));
    })
  );

  return perfiles;
};

const autenticarSinCache = crearAutenticadorDeBuzonDeTienda({
  verifyIdToken: (token) => getAdminAuth().verifyIdToken(token, true),
  cargarPerfiles: cargarPerfilesDeConfianza,
  obtenerTokenDeTienda,
});

// Mismo motivo que la cache de `authenticateChatRequest`: el chat manda señales
// seguidas (escribiendo, entregado, leido) y cada una releeria los perfiles. Un
// minuto basta; si a alguien le quitan el cargo, lo pierde en ese minuto.
const cacheDeBuzon = new Map();
const TTL_BUZON_MS = 60_000;

export const autenticarBuzonDeTienda = async (request) => {
  const clave = request?.headers?.get?.('authorization') || '';
  const guardado = clave ? cacheDeBuzon.get(clave) : null;

  if (guardado && guardado.hasta > Date.now()) {
    const actor = await guardado.promesa;

    // El token de la Tienda puede haberse renovado mientras tanto.
    return { ...actor, token: await obtenerTokenDeTienda() };
  }

  const promesa = autenticarSinCache(request);

  if (clave) {
    if (cacheDeBuzon.size > 200) cacheDeBuzon.clear();
    cacheDeBuzon.set(clave, { hasta: Date.now() + TTL_BUZON_MS, promesa });
    promesa.catch(() => cacheDeBuzon.delete(clave));
  }

  return promesa;
};

// ----------------------------------------------------------------------
// QUIEN CONTESTO DE VERDAD.
//
// El miembro solo ve "Tienda Virtual". Quien contesto se guarda APARTE, en
// `conversaciones_chat/<id>/respuestas_tienda/<idMensaje>`, y no dentro del
// mensaje: el miembro es participante y puede leer sus mensajes enteros
// directamente de Firestore, asi que un campo escondido en la pantalla no
// estaria escondido de verdad. Esa subcoleccion la escribe y la lee solo el
// servidor.
// ----------------------------------------------------------------------

export const registrarRespuestaDeTienda = async ({ idConversacion, idMensaje, responsable }) => {
  if (!idConversacion || !idMensaje || !responsable?.uid) return;

  await getAdminDb()
    .collection('conversaciones_chat')
    .doc(String(idConversacion))
    .collection(COLECCION_RESPUESTAS)
    .doc(String(idMensaje))
    .set({
      idMensaje: String(idMensaje),
      responsable: {
        uid: responsable.uid,
        nombre: responsable.nombre || '',
        idMiembros: responsable.idMiembros ?? null,
      },
      registradoEn: new Date().toISOString(),
    });
};

/** Quien contesto cada mensaje de la Tienda de una conversacion: idMensaje -> nombre. */
export const leerRespuestasDeTienda = async (idConversacion) => {
  if (!idConversacion) return new Map();

  const snapshot = await getAdminDb()
    .collection('conversaciones_chat')
    .doc(String(idConversacion))
    .collection(COLECCION_RESPUESTAS)
    .get();

  return new Map(
    snapshot.docs.map((doc) => [doc.id, String(doc.data()?.responsable?.nombre ?? '')])
  );
};

/**
 * Las cuentas que reciben el aviso cuando alguien escribe a la Tienda: quien
 * ejerce uno de los cargos del buzon.
 */
export const perfilesDelBuzonDeTienda = async () => {
  const db = getAdminDb();
  const [porRol, heredados, admins] = await Promise.all([
    db
      .collection('usuarios_roles')
      .where('rolId', 'in', [...CARGOS_DEL_BUZON_DE_TIENDA])
      .get(),
    db.collection('usuarios_roles').where('rol', '==', 'administrador').get(),
    db.collection('admins').get(),
  ]);
  const porUid = new Map();

  [...porRol.docs, ...heredados.docs].forEach((doc) => {
    const datos = doc.data() ?? {};
    const uid = String(datos.uid ?? datos.uidUsuario ?? doc.id).trim();

    if (uid) porUid.set(uid, { uid, rolDestinatario: 'admin' });
  });

  admins.docs.forEach((doc) => {
    const uid = String(doc.data()?.uid ?? doc.id).trim();

    if (uid) porUid.set(uid, { uid, rolDestinatario: 'admin' });
  });

  porUid.delete(UID_TIENDA_VIRTUAL);

  return [...porUid.values()];
};
