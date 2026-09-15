import 'server-only';

import {
  esUidDeBuzon,
  buzonPorClave,
  contactoDeBuzon,
  BUZONES_COMPARTIDOS,
  avatarDeBuzonValido,
  COLECCION_BUZONES_CHAT,
} from 'src/utils/chat-buzones.mjs';

import { getAdminDb, getAdminAuth } from 'src/server/firebase-admin';

import {
  crearAutenticadorDeBuzon,
  crearEmisorDeTokenDeBuzon,
  crearProveedorDeTokenDeBuzon,
} from './chat-buzones-core.mjs';

// La misma coleccion que `audit-log-service.js`: lo que se escribe aqui sale en
// Historial junto a todo lo demas.
const COLECCION_AUDITORIA_SISTEMA = 'auditoria_sistema';

// ----------------------------------------------------------------------
// El cableado con Firebase de los buzones compartidos del chat. La logica —y el
// porque— esta en `chat-buzones-core.mjs`; la lista de buzones, en
// `src/utils/chat-buzones.mjs`.
// ----------------------------------------------------------------------

const proveedoresDeToken = new Map(
  BUZONES_COMPARTIDOS.map((buzon) => [
    buzon.clave,
    crearProveedorDeTokenDeBuzon({
      emitirToken: crearEmisorDeTokenDeBuzon({
        buzon,
        crearTokenPropio: (uid, claims) => getAdminAuth().createCustomToken(uid, claims),
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      }),
    }),
  ])
);

export const obtenerTokenDeBuzon = (buzon) => proveedoresDeToken.get(buzon.clave)();

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

const autenticadores = new Map(
  BUZONES_COMPARTIDOS.map((buzon) => [
    buzon.clave,
    crearAutenticadorDeBuzon({
      buzon,
      verifyIdToken: (token) => getAdminAuth().verifyIdToken(token, true),
      cargarPerfiles: cargarPerfilesDeConfianza,
      obtenerTokenDeBuzon: () => obtenerTokenDeBuzon(buzon),
    }),
  ])
);

// Mismo motivo que la cache de `authenticateChatRequest`: el chat manda señales
// seguidas (escribiendo, entregado, leido) y cada una releeria los perfiles. Un
// minuto basta; si a alguien le quitan el cargo, lo pierde en ese minuto.
// La clave lleva el buzon: tener acceso a uno no abre el otro.
const cacheDeBuzon = new Map();
const TTL_BUZON_MS = 60_000;

export const autenticarBuzon = async (buzon, request) => {
  const autorizacion = request?.headers?.get?.('authorization') || '';
  const clave = autorizacion ? `${buzon.clave}:${autorizacion}` : '';
  const guardado = clave ? cacheDeBuzon.get(clave) : null;

  if (guardado && guardado.hasta > Date.now()) {
    const actor = await guardado.promesa;

    // El token del buzon puede haberse renovado mientras tanto.
    return { ...actor, token: await obtenerTokenDeBuzon(buzon) };
  }

  const promesa = autenticadores.get(buzon.clave)(request);

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
// El miembro solo ve "Tienda Virtual" u "Oficina Nacional". Quien contesto se
// guarda APARTE, en `conversaciones_chat/<id>/<coleccionRespuestas>/<idMensaje>`,
// y no dentro del mensaje: el miembro es participante y puede leer sus mensajes
// enteros directamente de Firestore, asi que un campo escondido en la pantalla
// no estaria escondido de verdad. Esa subcoleccion la escribe y la lee solo el
// servidor.
// ----------------------------------------------------------------------

export const registrarRespuestaDeBuzon = async ({
  buzon,
  idConversacion,
  idMensaje,
  responsable,
}) => {
  if (!buzon || !idConversacion || !idMensaje || !responsable?.uid) return;

  const db = getAdminDb();
  const registradoEn = new Date().toISOString();
  const quien = {
    uid: responsable.uid,
    nombre: responsable.nombre || '',
    usuario: responsable.usuario || '',
    correo: responsable.correo || '',
    idMiembros: responsable.idMiembros ?? null,
  };
  const etiqueta = [quien.nombre || 'Alguien', quien.usuario ? '(' + quien.usuario + ')' : '']
    .filter(Boolean)
    .join(' ');

  await Promise.all([
    db
      .collection('conversaciones_chat')
      .doc(String(idConversacion))
      .collection(buzon.coleccionRespuestas)
      .doc(String(idMensaje))
      .set({ idMensaje: String(idMensaje), buzon: buzon.clave, responsable: quien, registradoEn }),

    // Y EN HISTORIAL, para la auditoria: cada mensaje que sale en nombre de la
    // Tienda o de la Oficina deja constancia de la persona y el usuario que lo
    // escribio. Sin esto habia que abrir la conversacion para saberlo, y solo
    // mientras existiera. El texto del mensaje no se copia: basta con saber
    // quien, cuando y en que conversacion.
    db
      .collection(COLECCION_AUDITORIA_SISTEMA)
      .doc()
      .set({
        modulo: 'chat',
        accion: 'respuesta_buzon_compartido',
        descripcion: etiqueta + ' respondió como ' + buzon.nombre + '.',
        resultado: 'exitoso',
        severidad: 'informativa',
        entidad: {
          tipo: 'buzon_chat',
          id: buzon.clave,
          nombre: buzon.nombre,
          ruta: '/dashboard/chat?id=' + idConversacion + '&bandeja=' + buzon.clave,
        },
        antes: null,
        despues: null,
        realizadoPor: {
          idUsuario: quien.uid,
          idMiembros: quien.idMiembros,
          codigoMiembro: quien.usuario || null,
          nombre: quien.nombre || quien.correo || 'Sin nombre',
          correo: quien.correo || null,
          rol: null,
        },
        origen: 'chat',
        metadatos: {
          buzon: buzon.clave,
          idConversacion: String(idConversacion),
          idMensaje: String(idMensaje),
        },
        fecha: registradoEn,
        fechaServidor: new Date(),
      }),
  ]);
};

/** Quien contesto cada mensaje del buzon en una conversacion: idMensaje -> { nombre, usuario }. */
export const leerRespuestasDeBuzon = async (buzon, idConversacion) => {
  if (!buzon || !idConversacion) return new Map();

  const snapshot = await getAdminDb()
    .collection('conversaciones_chat')
    .doc(String(idConversacion))
    .collection(buzon.coleccionRespuestas)
    .get();

  return new Map(
    snapshot.docs.map((doc) => [
      doc.id,
      {
        nombre: String(doc.data()?.responsable?.nombre ?? ''),
        usuario: String(doc.data()?.responsable?.usuario ?? ''),
      },
    ])
  );
};

/**
 * Las cuentas que reciben el aviso cuando alguien escribe a un buzon: quien
 * ejerce uno de sus cargos. El Administrador Global de las cuentas antiguas
 * (`rol: 'administrador'` y la coleccion `admins`) cuenta en todos, como en las
 * reglas.
 */
export const perfilesDelBuzon = async (buzon) => {
  const db = getAdminDb();
  const incluyeGlobal = buzon.cargos.includes('administrador_global');
  const [porRol, porCargoSecundario, heredados, admins] = await Promise.all([
    db
      .collection('usuarios_roles')
      .where('rolId', 'in', [...buzon.cargos])
      .get(),
    // Quien tiene el cargo del buzon en CUALQUIER posicion —el segundo, el
    // cuarto...—, no solo como principal: sin esto, la Oficina Nacional que ademas
    // coordina algo no recibia el aviso de su buzon.
    db
      .collection('usuarios_roles')
      .where('rolesQueEjerce', 'array-contains-any', [...buzon.cargos])
      .get()
      .catch(() => ({ docs: [] })),
    incluyeGlobal
      ? db.collection('usuarios_roles').where('rol', '==', 'administrador').get()
      : { docs: [] },
    incluyeGlobal ? db.collection('admins').get() : { docs: [] },
  ]);
  const porUid = new Map();

  [...porRol.docs, ...porCargoSecundario.docs, ...heredados.docs].forEach((doc) => {
    const datos = doc.data() ?? {};
    const uid = String(datos.uid ?? datos.uidUsuario ?? doc.id).trim();

    if (uid) porUid.set(uid, { uid, rolDestinatario: 'admin' });
  });

  admins.docs.forEach((doc) => {
    const uid = String(doc.data()?.uid ?? doc.id).trim();

    if (uid) porUid.set(uid, { uid, rolDestinatario: 'admin' });
  });

  [...porUid.keys()].filter(esUidDeBuzon).forEach((uid) => porUid.delete(uid));

  return [...porUid.values()];
};

// ----------------------------------------------------------------------
// LA FOTO DE CADA BUZON, para que el servidor la ponga en todo lo que devuelve:
// contactos, participantes de las conversaciones y avisos.
//
// Se guarda un minuto: la lista de contactos se pide a menudo y la foto casi
// nunca cambia. Quien la cambia la ve al momento en su pantalla (la escucha en
// tiempo real del navegador); el resto, en ese minuto.
// ----------------------------------------------------------------------

const TTL_AVATARES_MS = 60_000;
let avataresGuardados = null;

export const leerAvataresDeBuzones = async () => {
  if (avataresGuardados && avataresGuardados.hasta > Date.now()) return avataresGuardados.promesa;

  const promesa = getAdminDb()
    .collection(COLECCION_BUZONES_CHAT)
    .get()
    .then(
      (snapshot) =>
        new Map(
          snapshot.docs
            .map((doc) => [doc.id, avatarDeBuzonValido(doc.data()?.avatarUrl)])
            .filter(([clave, url]) => buzonPorClave(clave) && url)
        )
    )
    .catch(() => new Map());

  avataresGuardados = { hasta: Date.now() + TTL_AVATARES_MS, promesa };

  return promesa;
};

/** La foto actual de un buzon: la elegida por el Administrador Global o la de siempre. */
export const avatarActualDeBuzon = async (buzon) =>
  (await leerAvataresDeBuzones()).get(buzon.clave) || buzon.avatarPorDefecto;

/** Todos los buzones como contactos, cada uno con su foto actual. */
export const contactosDeBuzones = async () => {
  const avatares = await leerAvataresDeBuzones();

  return BUZONES_COMPARTIDOS.map((buzon) => contactoDeBuzon(buzon, avatares.get(buzon.clave)));
};
