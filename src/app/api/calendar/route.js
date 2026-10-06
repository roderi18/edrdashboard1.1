import {
  toCalendarEvent,
  toFirestoreCalendarDoc,
  COLECCION_CALENDARIO,
} from 'src/utils/firebase-calendar';

import { createChatFirestoreRestClient } from 'src/server/chat-firestore-rest.mjs';
import {
  identificarConSesionRest,
  exigirPermisoDeCargoRest,
} from 'src/server/sesion-rest.mjs';

export const runtime = 'nodejs';

const permisosDeEdicion = ['asistencia.editar', 'organizacion.aprobar_cambios'];
const errorJson = (message, status) => Response.json({ message }, { status });
const idValido = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(id);

const clienteDe = (request) => {
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const projectId = String(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
  ).trim();

  if (!token || !projectId) return null;
  return createChatFirestoreRestClient({ projectId, token });
};

const documentoDe = (eventData, includeCreatedFields = false) => {
  const data = toFirestoreCalendarDoc(eventData, { includeCreatedFields });
  return {
    ...data,
    fechaInicio: data.fechaInicio?.toDate() ?? null,
    fechaFin: data.fechaFin?.toDate() ?? null,
    actualizadoEn: new Date(),
    ...(includeCreatedFields ? { creadoEn: new Date() } : {}),
  };
};

const escribir = async (request, method) => {
  const noAutorizado = await exigirPermisoDeCargoRest(request, permisosDeEdicion);
  if (noAutorizado) return noAutorizado;

  const client = clienteDe(request);
  if (!client) return errorJson('No se pudo conectar con el calendario.', 503);

  const body = await request.json().catch(() => ({}));
  const eventData = body.eventData || body;
  const id = method === 'POST' ? globalThis.crypto.randomUUID() : eventData?.id;
  if (!idValido(id)) return errorJson('El identificador del evento no es válido.', 400);

  const start = new Date(eventData?.start || eventData?.fechaInicio);
  const end = new Date(eventData?.end || eventData?.fechaFin);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    return errorJson('Las fechas del evento no son válidas.', 400);
  }

  try {
    const path = `${COLECCION_CALENDARIO}/${id}`;
    if (method === 'PUT' && !(await client.getDocument(path))) {
      return errorJson('El evento no existe.', 404);
    }
    await client.setDocument(path, documentoDe(eventData, method === 'POST'), {
      merge: method === 'PUT',
    });
    return Response.json({ ok: true, id });
  } catch (error) {
    console.error('[calendar api] error al guardar', error);
    return errorJson('No se pudo guardar el evento.', 502);
  }
};

export async function GET(request) {
  const { error: authError } = await identificarConSesionRest(request);
  if (authError) return authError;

  const client = clienteDe(request);
  if (!client) return errorJson('No se pudo conectar con el calendario.', 503);

  try {
    const documents = await client.listCollection(COLECCION_CALENDARIO);
    const events = documents
      .map(toCalendarEvent)
      .filter((event) => event.extendedProps.estado === 'publicado' && event.extendedProps.visibleParaTodos)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return Response.json({ events });
  } catch (error) {
    console.error('[calendar api] error al consultar', error);
    return errorJson('No se pudo consultar el calendario.', 502);
  }
}

export const POST = (request) => escribir(request, 'POST');
export const PUT = (request) => escribir(request, 'PUT');

export async function PATCH(request) {
  const noAutorizado = await exigirPermisoDeCargoRest(request, permisosDeEdicion);
  if (noAutorizado) return noAutorizado;

  const client = clienteDe(request);
  if (!client) return errorJson('No se pudo conectar con el calendario.', 503);

  const body = await request.json().catch(() => ({}));
  const id = body.eventId || body.id;
  if (!idValido(id)) return errorJson('El identificador del evento no es válido.', 400);

  try {
    const path = `${COLECCION_CALENDARIO}/${id}`;
    if (!(await client.getDocument(path))) return errorJson('El evento no existe.', 404);
    await client.deleteDocument(path);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[calendar api] error al eliminar', error);
    return errorJson('No se pudo eliminar el evento.', 502);
  }
}
