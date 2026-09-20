import { FieldValue } from 'firebase-admin/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { enviarPushAUsuarios } from 'src/server/web-push';
import { identificarConSesionRest } from 'src/server/sesion-rest.mjs';
import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

const errorJson = (error, status) => Response.json({ error }, { status });

export async function POST(request) {
  const { error, quien } = await identificarConSesionRest(request);
  if (error) return error;
  if (!isAdminConfigured()) return errorJson('El envío push no está configurado.', 503);

  const { idNotificacion = '' } = await request.json().catch(() => ({}));
  const id = String(idNotificacion || '').trim();
  if (!id || id.length > 500) return errorJson('La notificación no es válida.', 400);

  const db = getAdminDb();
  const referencia = db.collection(COLECCIONES_NOTIFICACIONES.notificaciones).doc(id);
  const snapshot = await referencia.get();
  if (!snapshot.exists) return errorJson('No se encontró la notificación.', 404);

  const notificacion = snapshot.data() || {};
  const idsDestinatarios = Array.isArray(notificacion.idsDestinatarios)
    ? notificacion.idsDestinatarios.map(String)
    : [];
  const uid = String(quien.uid);
  if (
    String(notificacion.actorId || '') !== uid &&
    String(notificacion.creadoPorUid || '') !== uid &&
    !idsDestinatarios.includes(uid)
  ) {
    return errorJson('No puedes enviar esta notificación.', 403);
  }

  const puedeEnviar = await db.runTransaction(async (transaccion) => {
    const actual = await transaccion.get(referencia);
    const datos = actual.data() || {};
    if (datos.pushEnviadoEn || datos.pushEnviandoHasta > Date.now()) return false;

    transaccion.update(referencia, {
      pushEnviandoHasta: Date.now() + 60_000,
      pushIntentadoPor: uid,
    });
    return true;
  });

  if (!puedeEnviar) return Response.json({ enviado: false, duplicado: true });

  try {
    const resultado = await enviarPushAUsuarios({
      idsUsuarios: idsDestinatarios,
      titulo: notificacion.titulo || 'Nueva notificación',
      mensaje: notificacion.mensajeVisual || notificacion.mensaje || notificacion.titulo,
      ruta: notificacion.ruta || '/dashboard',
    });

    await referencia.update({
      pushEnviadoEn: FieldValue.serverTimestamp(),
      pushEnviandoHasta: FieldValue.delete(),
      pushDispositivosDestino: resultado.dispositivos,
      pushEnviados: resultado.enviados,
      pushFallidos: resultado.fallidos,
    });

    return Response.json({ enviado: resultado.enviados > 0, ...resultado });
  } catch (cause) {
    await referencia.update({ pushEnviandoHasta: FieldValue.delete() }).catch(() => {});
    console.error('[push/notificacion] no se pudo entregar la notificación', cause);
    return errorJson('No se pudo enviar la notificación push.', 502);
  }
}
