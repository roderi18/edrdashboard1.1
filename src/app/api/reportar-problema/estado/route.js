import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import {
  ESTADOS_REPORTE,
  esEstadoDeReporte,
  etiquetaEstadoReporte,
} from 'src/utils/estado-reporte-problema.mjs';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// CAMBIAR EL ESTADO DE UN REPORTE DE PROBLEMA (En progreso / Resuelto / Abierto).
//
// Lo hace un Administrador Global desde la tarjeta del chat. Se escribe en los
// TRES sitios donde vive el reporte —su ficha, el mensaje del grupo y el aviso
// de la campana—, así que el cambio se ve al momento para todos. Además se avisa
// a quien lo envió (salvo al reabrirlo: eso es cosa interna).
// ----------------------------------------------------------------------

const errorJson = (error, status) => Response.json({ error }, { status });
const bearer = (request) =>
  (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';

const esAdministradorGlobal = async (db, uid) => {
  const [porId, porUid] = await Promise.all([
    db.collection(COLECCIONES.usuariosRoles).doc(uid).get(),
    db.collection(COLECCIONES.usuariosRoles).where('uid', '==', uid).limit(1).get(),
  ]);
  const perfil = porId.exists ? porId.data() : porUid.docs[0]?.data();
  if (!perfil) return null;
  const cargos = Array.isArray(perfil.cargos) ? perfil.cargos : [];
  const lo =
    perfil.rolId === 'administrador_global' ||
    cargos.some((c) => (c?.rol ?? c?.rolId ?? c) === 'administrador_global');
  return lo ? perfil : null;
};

export async function POST(request) {
  if (!isAdminConfigured()) return errorJson('El servidor no puede cambiar reportes ahora.', 503);
  const token = bearer(request);
  if (!token) return errorJson('Inicia sesión.', 401);

  let caller;
  try {
    caller = await getAdminAuth().verifyIdToken(token);
  } catch {
    return errorJson('La sesión expiró. Vuelve a iniciar sesión.', 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Falta el reporte.', 400);
  }
  const idReporte = String(body?.idReporte || '').trim().slice(0, 160);
  const estado = String(body?.estado || '').trim();
  if (!idReporte || !esEstadoDeReporte(estado)) return errorJson('Estado no válido.', 400);

  const db = getAdminDb();
  const perfil = await esAdministradorGlobal(db, caller.uid);
  if (!perfil) return errorJson('Solo el Administrador Global cambia el estado de un reporte.', 403);

  const reporteRef = db.collection(COLECCIONES.reportesProblemas).doc(idReporte);
  const reporteSnap = await reporteRef.get();
  if (!reporteSnap.exists) return errorJson('Ese reporte no existe.', 404);
  const reporte = reporteSnap.data();

  const ahora = new Date().toISOString();
  const nombre =
    String(
      perfil.nombre ||
        perfil.displayName ||
        [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ') ||
        caller.name ||
        'Administrador Global'
    ).trim() || 'Administrador Global';
  const cambio = { estado, estadoPorNombre: nombre, estadoEn: ahora };

  const batch = db.batch();
  batch.set(reporteRef, { ...cambio, estadoPorUid: caller.uid }, { merge: true });
  if (reporte.idConversacion) {
    batch.set(
      db
        .collection(COLECCIONES.conversacionesChat)
        .doc(reporte.idConversacion)
        .collection(COLECCIONES.mensajes)
        .doc(`reporte_${idReporte}`),
      { metadatos: { reporteProblema: cambio } },
      { merge: true }
    );
  }
  batch.set(
    db.collection(COLECCIONES.notificaciones).doc(`reporte_problema_${idReporte}`),
    { metadatos: { reporteProblema: cambio }, actualizadoEnServidor: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // Aviso a quien lo reportó (En progreso y Resuelto; reabrir no se le avisa).
  if (estado !== ESTADOS_REPORTE.abierto && reporte.uidReportante) {
    const texto =
      estado === ESTADOS_REPORTE.resuelto
        ? 'Tu reporte de problema fue resuelto. ¡Gracias por avisar!'
        : 'Estamos trabajando en tu reporte de problema.';
    const avisoRef = db.collection(COLECCIONES.notificaciones).doc(`reporte_problema_${idReporte}_${estado}`);
    batch.set(avisoRef, {
      id: avisoRef.id,
      tipoNotificacion: 'reporte_problema_estado',
      rolDestinatario: 'usuario',
      modulo: 'administradores',
      titulo: `Reporte: ${etiquetaEstadoReporte(estado)}`,
      mensaje: texto,
      mensajeVisual: texto,
      idsDestinatarios: [reporte.uidReportante],
      prioridad: 'normal',
      estado: 'no_leida',
      fechaCreacion: ahora,
      fechaEnvio: ahora,
      actorId: String(perfil.idMiembros || ''),
      actorTipo: 'usuario',
      actorNombre: nombre,
      entidadTipo: 'reporte_problema',
      entidadId: idReporte,
      ruta: reporte.ruta || '/dashboard',
      imagenTipo: 'icono',
      leidaPor: [],
      metadatos: { reporteProblema: { id: idReporte, mensaje: reporte.mensaje, ...cambio } },
      creadoEnServidor: FieldValue.serverTimestamp(),
      actualizadoEnServidor: FieldValue.serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return Response.json({ ok: true, ...cambio });
  } catch (error) {
    console.error('[reportar-problema/estado]', error);
    return errorJson('No se pudo cambiar el estado.', 500);
  }
}
