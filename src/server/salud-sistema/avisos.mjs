import { createChatMessageDocument } from '../chat-message-model.mjs';
import { CUENTA_SISTEMA, participanteSistema } from '../../utils/chat-sistema.mjs';
import {
  ESTADOS_SALUD,
  avisosDeSalud,
  fechaClaveSalud,
  idAvisoDeChequeoSalud,
  textoAvisoDeFallasSalud,
  ID_GRUPO_ADMINISTRADORES,
  NOMBRE_GRUPO_ADMINISTRADORES,
} from '../../utils/salud-sistema.mjs';

// ----------------------------------------------------------------------
// SISTEMA AVISA A LOS ADMINISTRADORES GLOBALES DE LA SALUD DEL SISTEMA.
//
// Dos sitios: la campana de cada uno (una notificación por chequeo y día, con
// el MISMO id que creaba la pantalla de Salud, así no salen dos) y el chat del
// grupo "ADMINISTRADORES GLOBALES" (el mismo de "Reportar un problema"), donde
// escribe Sistema. Recibe `db` y `FieldValue` para usarse igual desde una ruta,
// una tarea o la prueba a mano.
// ----------------------------------------------------------------------

const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const COLECCION_NOTIFICACIONES = 'notificaciones';
const ADMINISTRADOR_GLOBAL = 'administrador_global';

const limpiar = (valor, max = 240) =>
  String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Los Administradores Globales de hoy: los que lo tienen como rol principal y
 * los que lo ejercen entre otros cargos (`rolesQueEjerce`). Una persona tiene a
 * veces dos fichas (por id de miembro y por uid): se cuenta una vez.
 */
export async function leerAdministradoresGlobales(db) {
  const [porRol, porCargos] = await Promise.all([
    db.collection('usuarios_roles').where('rolId', '==', ADMINISTRADOR_GLOBAL).get(),
    db
      .collection('usuarios_roles')
      .where('rolesQueEjerce', 'array-contains', ADMINISTRADOR_GLOBAL)
      .get(),
  ]);
  const porMiembro = new Map();

  [...porRol.docs, ...porCargos.docs].forEach((documento) => {
    const datos = documento.data() || {};
    const idMiembros = Number(datos.idMiembros || datos.memberId || documento.id);
    const uid = limpiar(datos.uid || (documento.id.length > 20 ? documento.id : ''), 160);

    if (!Number.isSafeInteger(idMiembros) || idMiembros <= 0 || datos.activo === false) return;

    const anterior = porMiembro.get(idMiembros) || {};

    porMiembro.set(idMiembros, {
      idMiembros,
      uid: anterior.uid || uid,
      nombre:
        anterior.nombre ||
        limpiar(
          datos.nombre ||
            [datos.nombres, datos.apellidos].filter(Boolean).join(' ') ||
            `Administrador ${idMiembros}`
        ),
      codigoMiembro: anterior.codigoMiembro || limpiar(datos.codigoMiembro || ''),
      avatarUrl: anterior.avatarUrl || limpiar(datos.photoURL || datos.avatarUrl || '', 2000),
    });
  });

  return [...porMiembro.values()].filter((admin) => admin.uid);
}

/** El grupo de chat de los Administradores Globales: el que ya existe o uno nuevo con id fijo. */
const grupoDeAdministradores = async (db) => {
  const existente = await db
    .collection(COLECCION_CONVERSACIONES)
    .where('nombreGrupo', '==', NOMBRE_GRUPO_ADMINISTRADORES)
    .limit(1)
    .get();

  return existente.empty
    ? {
        referencia: db.collection(COLECCION_CONVERSACIONES).doc(ID_GRUPO_ADMINISTRADORES),
        datos: null,
      }
    : { referencia: existente.docs[0].ref, datos: existente.docs[0].data() };
};

/**
 * Sistema escribe en el grupo de Administradores Globales. Suma al grupo a los
 * que hoy lo son y no estaban, y cuenta el mensaje como no leído para cada uno.
 * `idMensaje` fijo: si la tarea corre dos veces, no se repite.
 */
export async function escribirEnGrupoDeAdministradores({
  db,
  administradores,
  texto,
  idMensaje,
  metadatos = {},
  ahora = new Date().toISOString(),
}) {
  const { referencia, datos } = await grupoDeAdministradores(db);
  const referenciaMensaje = referencia.collection('mensajes').doc(idMensaje);

  if ((await referenciaMensaje.get()).exists)
    return { enviado: false, idConversacion: referencia.id };

  const porId = new Map([[CUENTA_SISTEMA.idMiembros, participanteSistema()]]);

  (datos?.participantes || []).forEach((p) => {
    const id = Number(p?.idMiembros);
    if (id) porId.set(id, p);
  });
  administradores.forEach((admin) => {
    if (porId.has(admin.idMiembros)) return;
    porId.set(admin.idMiembros, {
      idMiembros: admin.idMiembros,
      id: String(admin.idMiembros),
      codigoMiembro: admin.codigoMiembro,
      nombres: admin.nombre,
      apellidos: '',
      avatarUrl: admin.avatarUrl,
    });
  });

  const participantes = [...porId.values()].sort((a, b) => a.idMiembros - b.idMiembros);
  const participantesIds = participantes.map((p) => Number(p.idMiembros));
  const destinatarios = administradores.map((admin) => admin.idMiembros);
  const mensaje = createChatMessageDocument({
    message: {
      idMensaje,
      texto,
      remitenteIdMiembros: CUENTA_SISTEMA.idMiembros,
      enviadoEn: ahora,
      metadatos,
    },
    fallbackSender: participanteSistema(),
    conversationId: referencia.id,
  });
  const anteriores = datos?.noLeidosPorIdMiembros || {};
  const lote = db.batch();

  lote.set(referenciaMensaje, mensaje);
  lote.set(
    referencia,
    {
      idConversacion: referencia.id,
      tipoConversacion: 'GRUPAL',
      nombreGrupo: NOMBRE_GRUPO_ADMINISTRADORES,
      participantesIds,
      participantes,
      creadoPorIdMiembros: datos?.creadoPorIdMiembros ?? CUENTA_SISTEMA.idMiembros,
      administradoresIds: [...new Set([...(datos?.administradoresIds || []), ...destinatarios])],
      creadoEn: datos?.creadoEn || ahora,
      actualizadoEn: ahora,
      ultimoMensaje: {
        idMensaje: mensaje.idMensaje,
        texto: mensaje.texto,
        tipoContenido: mensaje.tipoContenido,
        remitenteIdMiembros: mensaje.remitenteIdMiembros,
        enviadoEn: mensaje.enviadoEn,
      },
      noLeidosPorIdMiembros: Object.fromEntries(
        participantesIds.map((id) => [
          String(id),
          Number(anteriores[String(id)] || 0) + (destinatarios.includes(id) ? 1 : 0),
        ])
      ),
      activa: true,
      eliminada: false,
    },
    { merge: true }
  );
  await lote.commit();

  return { enviado: true, idConversacion: referencia.id };
}

/**
 * Las alertas de un lote de chequeos: a la campana las advertencias y los
 * fallos; al chat, solo los fallos. Cada chequeo, una vez por día (la
 * notificación se crea con `create`, que falla si ya estaba).
 *
 * Devuelve qué salió de nuevo, para el registro.
 */
export async function avisarDeLaSalud({
  db,
  FieldValue,
  chequeos = [],
  origen = 'revision_automatica',
  ahora = new Date(),
  administradores = null,
}) {
  const { campana, chat } = avisosDeSalud(chequeos);

  if (!campana.length) return { nuevos: [], chat: false };

  const admins = administradores ?? (await leerAdministradoresGlobales(db));

  if (!admins.length) return { nuevos: [], chat: false };

  const fechaClave = fechaClaveSalud(ahora);
  const fechaIso = ahora.toISOString();
  const nuevos = [];

  for (const item of campana) {
    const id = idAvisoDeChequeoSalud(item.id, fechaClave);
    const critico = item.status === ESTADOS_SALUD.critico;

    try {
      await db
        .collection(COLECCION_NOTIFICACIONES)
        .doc(id)
        .create({
          id,
          tipoNotificacion: 'salud_sistema_alerta',
          modulo: 'salud_sistema',
          titulo: `${critico ? 'Fallo' : 'Alerta'} de salud del sistema: ${item.name}`,
          tituloHtml: `<p>${critico ? 'Fallo' : 'Alerta'} en <strong>${limpiar(item.name, 120).replace(/[<>&"]/g, '')}</strong></p>`,
          mensaje: `${item.name}: ${item.detail}`,
          mensajeVisual: `${item.name}: ${item.detail}`,
          rolDestinatario: 'admin',
          idsDestinatarios: admins.map((admin) => admin.uid),
          prioridad: critico ? 'critica' : 'importante',
          estado: 'no_leida',
          creadoPorUid: null,
          fechaCreacion: fechaIso,
          fechaEnvio: fechaIso,
          actorId: String(CUENTA_SISTEMA.idMiembros),
          actorTipo: 'sistema',
          actorNombre: CUENTA_SISTEMA.nombre,
          actorFotoURL: null,
          entidadTipo: 'chequeo_salud',
          entidadId: item.id,
          ruta: '/dashboard/admin/health',
          imagenTipo: 'icono',
          imagenURL: null,
          miniaturaURL: null,
          tipoAccion: 'ver',
          etiquetaAccion: 'Ver salud del sistema',
          leidaPor: [],
          metadatos: {
            area: item.area || null,
            nombreChequeo: item.name,
            detalle: item.detail,
            valor: item.value ?? null,
            estado: item.status,
            origen,
          },
          creadoEnServidor: FieldValue.serverTimestamp(),
          actualizadoEnServidor: FieldValue.serverTimestamp(),
        });
      nuevos.push(item);
    } catch (error) {
      // Ya avisado hoy (código 6, ALREADY_EXISTS): no se repite.
      if (error?.code !== 6 && !/already exists/i.test(String(error?.message))) throw error;
    }
  }

  // Al chat, solo los fallos que no se habían avisado hoy.
  const fallasNuevas = nuevos.filter((item) => chat.includes(item));
  let enviadoAlChat = false;

  if (fallasNuevas.length) {
    const resultado = await escribirEnGrupoDeAdministradores({
      db,
      administradores: admins,
      texto: textoAvisoDeFallasSalud({ fallas: fallasNuevas, fecha: ahora, origen }),
      idMensaje: `salud_fallo_${fechaClave}_${fallasNuevas.map((f) => f.id).join('_')}`.slice(
        0,
        700
      ),
      metadatos: { saludSistema: { tipo: 'fallo', chequeos: fallasNuevas.map((f) => f.id) } },
      ahora: fechaIso,
    });

    enviadoAlChat = resultado.enviado;
  }

  return { nuevos, chat: enviadoAlChat };
}
