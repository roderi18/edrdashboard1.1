import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import { exigirSesionRest, exigirPermisoDeCargoRest } from 'src/server/sesion-rest.mjs';

export const runtime = 'nodejs';

const COLECCION = 'notas_tutores_miembros';
const COLECCION_AUDITORIA = 'auditoria_sistema';
const TOPE_NOTA = 500;

const jsonError = (message, status) => Response.json({ error: message }, { status });

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const texto = (value) => String(value ?? '').trim().slice(0, TOPE_NOTA);

export async function GET(req) {
  if (!isAdminConfigured()) {
    return jsonError('El servidor no puede cargar la nota en este momento.', 503);
  }

  const noAutorizado = await exigirSesionRest(req);
  if (noAutorizado) return noAutorizado;

  const idMiembro = new URL(req.url).searchParams.get('idMiembro') || '';
  if (!idMiembro) return jsonError('Falta el miembro.', 400);

  const snapshot = await getAdminDb().collection(COLECCION).doc(String(idMiembro)).get();

  return Response.json({ nota: snapshot.exists ? String(snapshot.data()?.nota ?? '') : '' });
}

export async function PUT(req) {
  if (!isAdminConfigured()) {
    return jsonError('El servidor no puede guardar la nota en este momento.', 503);
  }

  const noAutorizado = await exigirPermisoDeCargoRest(req, ['padres.editar']);
  if (noAutorizado) return noAutorizado;

  let caller;
  try {
    caller = await getAdminAuth().verifyIdToken(getBearerToken(req));
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('Cuerpo inválido.', 400);
  }

  const idMiembro = String(body?.idMiembro ?? '').trim();
  if (!idMiembro) return jsonError('Falta el miembro.', 400);

  const nota = texto(body?.nota);
  const db = getAdminDb();
  const notaRef = db.collection(COLECCION).doc(idMiembro);

  await db.runTransaction(async (transaction) => {
    const actual = await transaction.get(notaRef);
    const notaAnterior = actual.exists ? String(actual.data()?.nota ?? '') : '';

    if (notaAnterior === nota) return;

    transaction.set(
      notaRef,
      {
        idMiembro,
        nota,
        actualizadoPorUid: caller.uid,
        actualizadoPorCorreo: caller.email || '',
        actualizadoEn: new Date().toISOString(),
        actualizadoEnServidor: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const auditoriaRef = db.collection(COLECCION_AUDITORIA).doc();
    transaction.set(auditoriaRef, {
      accion: 'cambio_aplicado',
      ambito: 'miembro',
      descripcion: 'Se actualizó automáticamente la nota de padres o tutores.',
      entidad: { tipo: 'miembro', id: idMiembro },
      antes: { notaTutores: notaAnterior },
      despues: { notaTutores: nota },
      realizadoPor: {
        idUsuario: caller.uid,
        correo: caller.email || '',
        nombre: caller.name || caller.email || '',
      },
      creadoEn: new Date().toISOString(),
      creadoEnServidor: FieldValue.serverTimestamp(),
    });
  });

  return Response.json({ ok: true, nota });
}
