import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { CUENTA_SISTEMA, participanteSistema } from 'src/utils/chat-sistema.mjs';

import { createChatMessageDocument } from 'src/server/chat-message-model.mjs';
import { getChatMemberDirectory } from 'src/server/chat-identity-directory.mjs';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

const MAX_REPORTE = 4000;
const ID_GRUPO = 'grupo_administradores_globales';
const NOMBRE_GRUPO = 'ADMINISTRADORES GLOBALES';
const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const limpiar = (valor, max = 240) => String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const bearer = (request) => (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';

const errorJson = (error, status) => Response.json({ error }, { status });

const getMiembro = async (db, uid, token) => {
  const [perfilUid, perfilPorUid] = await Promise.all([
    db.collection('usuarios_roles').doc(uid).get(),
    db.collection('usuarios_roles').where('uid', '==', uid).limit(1).get(),
  ]);
  const profile = perfilUid.exists ? perfilUid.data() : perfilPorUid.docs[0]?.data() || {};
  const idMiembros = Number(token.idMiembros || profile.idMiembros || profile.memberId);
  if (!Number.isSafeInteger(idMiembros) || idMiembros <= 0) return null;

  const miembros = await getChatMemberDirectory().catch(() => []);
  const row = miembros.find((item) => Number(item.idMiembros ?? item.id) === idMiembros) || {};
  const fotos = await db.collection('fotos').where('tipoEntidad', '==', 'miembro').get().catch(() => null);
  const foto = fotos?.docs.map((doc) => doc.data()).find((data) => String(data.idEntidad || '') === String(idMiembros) && data.tipoFoto === 'perfil' && data.estado === 'activo');
  const nombre = limpiar(row.nombre || row.name || [row.nombres || row.firstName, row.apellidos || row.lastName].filter(Boolean).join(' ') || profile.displayName || token.name || token.email || `Miembro ${idMiembros}`);

  return {
    idMiembros,
    uid,
    nombre,
    codigoMiembro: limpiar(row.codigoMiembro || row.memberId || profile.codigoMiembro || ''),
    fotoUrl: limpiar(foto?.urlFotoMiniatura || foto?.urlFoto || profile.photoURL || '', 2000),
    correo: limpiar(token.email || profile.correo || '', 320),
  };
};

const obtenerAdministradores = async (db) => {
  const snapshot = await db.collection('usuarios_roles').where('rolId', '==', 'administrador_global').get();
  const vistos = new Set();
  const admins = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const idMiembros = Number(data.idMiembros || data.memberId || doc.id);
    const uid = limpiar(data.uid || (doc.id.length > 20 ? doc.id : ''), 160);
    if (!Number.isSafeInteger(idMiembros) || idMiembros <= 0 || !uid || vistos.has(uid)) continue;
    vistos.add(uid);
    admins.push({
      idMiembros,
      uid,
      nombre: limpiar(data.nombre || data.displayName || [data.nombres, data.apellidos].filter(Boolean).join(' ') || `Administrador ${idMiembros}`),
      codigoMiembro: limpiar(data.codigoMiembro || data.codigoUsuario || ''),
      avatarUrl: limpiar(data.photoURL || data.avatarUrl || '', 2000),
    });
  }

  const idsFaltantes = admins.filter((admin) => !admin.avatarUrl).map((admin) => String(admin.idMiembros));
  if (idsFaltantes.length) {
    const fotos = await db.collection('fotos').where('tipoEntidad', '==', 'miembro').where('estado', '==', 'activo').get().catch(() => null);
    const mapa = new Map((fotos?.docs || []).map((doc) => [String(doc.data()?.idEntidad || ''), doc.data()]));
    admins.forEach((admin) => {
      const foto = mapa.get(String(admin.idMiembros));
      if (foto?.tipoFoto === 'perfil') admin.avatarUrl = limpiar(foto.urlFotoMiniatura || foto.urlFoto || '', 2000);
    });
  }
  return admins;
};

const publicarMensaje = async ({ db, conversationRef, participantes, destinatarios, texto, reporte, idMensaje, ahora }) => {
  const participantesIds = [...new Set(participantes.map((item) => Number(item.idMiembros)).filter(Boolean))].sort((a, b) => a - b);
  const message = createChatMessageDocument({
    message: {
      idMensaje,
      texto,
      remitenteIdMiembros: CUENTA_SISTEMA.idMiembros,
      enviadoEn: ahora,
      metadatos: { reporteProblema: reporte },
    },
    fallbackSender: participanteSistema(),
    conversationId: conversationRef.id,
  });
  const messageRef = conversationRef.collection('mensajes').doc(idMensaje);
  const conversation = await conversationRef.get();
  const anterioresNoLeidos = conversation.data()?.noLeidosPorIdMiembros || {};
  const noLeidosPorIdMiembros = Object.fromEntries(participantesIds.map((id) => [
    String(id),
    destinatarios.includes(id)
      ? Number(anterioresNoLeidos[String(id)] || 0) + 1
      : Number(anterioresNoLeidos[String(id)] || 0),
  ]));
  const batch = db.batch();
  batch.set(messageRef, message);
  batch.set(conversationRef, {
    idConversacion: conversationRef.id,
    tipoConversacion: participantesIds.length > 2 ? 'GRUPAL' : 'INDIVIDUAL',
    nombreGrupo: participantesIds.length > 2 ? NOMBRE_GRUPO : null,
    avatarGrupoUrl: null,
    participantesIds,
    participantes: participantes.sort((a, b) => a.idMiembros - b.idMiembros),
    creadoPorIdMiembros: CUENTA_SISTEMA.idMiembros,
    administradoresIds: destinatarios,
    creadoEn: conversation.exists ? conversation.data()?.creadoEn || ahora : ahora,
    actualizadoEn: ahora,
    ultimoMensaje: {
      idMensaje: message.idMensaje,
      texto: message.texto,
      tipoContenido: message.tipoContenido,
      remitenteIdMiembros: message.remitenteIdMiembros,
      enviadoEn: message.enviadoEn,
    },
    noLeidosPorIdMiembros,
    activa: true,
    eliminada: false,
  }, { merge: true });
  await batch.commit();
};

export async function POST(request) {
  if (!isAdminConfigured()) return errorJson('El servidor no puede enviar reportes en este momento.', 503);
  const token = bearer(request);
  if (!token) return errorJson('Inicia sesión para reportar un problema.', 401);

  let caller;
  try {
    caller = await getAdminAuth().verifyIdToken(token);
  } catch {
    return errorJson('La sesión expiró. Vuelve a iniciar sesión.', 401);
  }

  let body;
  try { body = await request.json(); } catch { return errorJson('El reporte está vacío.', 400); }
  const texto = limpiar(body?.mensaje, MAX_REPORTE);
  if (!texto) return errorJson('Describe brevemente el problema.', 400);

  const db = getAdminDb();
  const reporter = await getMiembro(db, caller.uid, caller);
  if (!reporter) return errorJson('No se pudo asociar tu cuenta con un miembro.', 403);
  const admins = await obtenerAdministradores(db);
  if (!admins.length) return errorJson('No hay Administradores Globales configurados para recibir el reporte.', 503);

  const ahora = new Date().toISOString();
  const reportId = db.collection('reportes_problemas').doc().id;
  const reporte = {
    id: reportId,
    miembroId: reporter.idMiembros,
    nombre: reporter.nombre,
    fotoUrl: reporter.fotoUrl,
    fecha: ahora,
    ruta: limpiar(body?.ruta, 500),
    mensaje: texto,
  };
  const cuerpoMensaje = `Reporte de problema\n${reporter.nombre}${reporter.codigoMiembro ? ` (${reporter.codigoMiembro})` : ''}\n${new Date(ahora).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santo_Domingo' })}\n\n${texto}${reporte.ruta ? `\n\nPantalla: ${reporte.ruta}` : ''}`;

  const grupoQuery = await db.collection(COLECCION_CONVERSACIONES).where('nombreGrupo', '==', NOMBRE_GRUPO).limit(1).get();
  const grupoRef = grupoQuery.empty
    ? db.collection(COLECCION_CONVERSACIONES).doc(ID_GRUPO)
    : grupoQuery.docs[0].ref;
  const grupoActual = grupoQuery.empty ? null : grupoQuery.docs[0].data();
  const grupoIds = new Set([CUENTA_SISTEMA.idMiembros, ...admins.map((admin) => admin.idMiembros), ...(grupoActual?.participantesIds || []).map(Number)]);
  const porId = new Map([[CUENTA_SISTEMA.idMiembros, participanteSistema()]]);
  admins.forEach((admin) => porId.set(admin.idMiembros, { ...admin, id: String(admin.idMiembros), nombres: admin.nombre, avatarUrl: admin.avatarUrl }));
  (grupoActual?.participantes || []).forEach((participant) => {
    const id = Number(participant.idMiembros);
    if (id && !porId.has(id)) porId.set(id, participant);
  });
  const miembrosGrupo = [...grupoIds].map((id) => porId.get(id)).filter(Boolean);
  const idsAdmins = admins.map((admin) => admin.idMiembros);

  try {
    await publicarMensaje({
      db,
      conversationRef: grupoRef,
      participantes: miembrosGrupo,
      destinatarios: idsAdmins,
      texto: cuerpoMensaje,
      reporte,
      idMensaje: `reporte_${reportId}`,
      ahora,
    });

    const notificationRef = db.collection('notificaciones').doc(`reporte_problema_${reportId}`);
    await notificationRef.set({
      id: notificationRef.id,
      tipoNotificacion: 'reporte_problema',
      modulo: 'administradores',
      titulo: `${reporter.nombre} reportó un problema.`,
      mensaje: `${reporter.nombre} reportó un problema.`,
      mensajeVisual: `${reporter.nombre} reportó un problema.`,
      rolDestinatario: 'admin',
      idsDestinatarios: admins.map((admin) => admin.uid),
      prioridad: 'critica',
      estado: 'no_leida',
      fechaCreacion: ahora,
      fechaEnvio: ahora,
      actorId: String(reporter.idMiembros),
      actorTipo: 'usuario',
      actorNombre: reporter.nombre,
      actorFotoURL: reporter.fotoUrl || null,
      entidadTipo: 'reporte_problema',
      entidadId: reportId,
      ruta: `/dashboard/chat?id=${grupoRef.id}`,
      imagenTipo: reporter.fotoUrl ? 'foto' : 'icono',
      imagenURL: reporter.fotoUrl || null,
      miniaturaURL: reporter.fotoUrl || null,
      leidaPor: [],
      metadatos: { reporteProblema: reporte, idConversacion: grupoRef.id },
      creadoEnServidor: FieldValue.serverTimestamp(),
      actualizadoEnServidor: FieldValue.serverTimestamp(),
    });
    await db.collection('reportes_problemas').doc(reportId).set({ ...reporte, uidReportante: caller.uid, idConversacion: grupoRef.id, estado: 'nuevo', creadoEnServidor: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, reportId });
  } catch (error) {
    console.error('[reportar-problema] no se pudo distribuir', error);
    return errorJson('El reporte no pudo llegar a todos los administradores. Inténtalo de nuevo.', 500);
  }
}
