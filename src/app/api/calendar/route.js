import { doc, getDoc } from 'firebase/firestore';

import {
  COLECCION_CALENDARIO,
  guardarActividadCalendario,
  eliminarActividadCalendario,
  obtenerActividadesCalendario,
  sembrarActividadesCalendario,
  actualizarActividadCalendario,
} from 'src/utils/firebase-calendar';

import { FIRESTORE } from 'src/lib/firebase';
import { crearNotificacionEventoReprogramado } from 'src/services/notification-service';

// ----------------------------------------------------------------------

export async function GET() {
  const events = await obtenerActividadesCalendario();

  return Response.json({ events });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  if (body.sembrar === true) {
    const total = await sembrarActividadesCalendario();

    return Response.json({ ok: true, total });
  }

  const id = await guardarActividadCalendario(body.eventData || body);

  return Response.json({ ok: true, id });
}

export async function PUT(request) {
  const body = await request.json().catch(() => ({}));
  const eventData = body.eventData || body;
  const eventId = eventData?.id;
  let previousData = null;

  if (eventId && FIRESTORE) {
    const snapshot = await getDoc(doc(FIRESTORE, COLECCION_CALENDARIO, String(eventId))).catch(
      () => null
    );
    previousData = snapshot?.exists() ? snapshot.data() : null;
  }

  await actualizarActividadCalendario(eventData);

  const previousStart = previousData?.fechaInicio?.toDate?.()?.toISOString?.() || null;
  const previousEnd = previousData?.fechaFin?.toDate?.()?.toISOString?.() || null;
  const nextStart = eventData?.start || eventData?.fechaInicio || null;
  const nextEnd = eventData?.end || eventData?.fechaFin || null;
  const wasRescheduled =
    previousData && (String(previousStart) !== String(nextStart) || String(previousEnd) !== String(nextEnd));

  if (wasRescheduled) {
    crearNotificacionEventoReprogramado({
      evento: eventData,
      usuario: body.usuario || eventData?.actualizadoPor || {},
      cambios: {
        fechaInicioAnterior: previousStart,
        fechaFinAnterior: previousEnd,
        fechaInicioNueva: nextStart,
        fechaFinNueva: nextEnd,
      },
    }).catch((error) => {
      console.error('[calendar api] no se pudo notificar evento reprogramado', error);
    });
  }

  return Response.json({ ok: true });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));

  await eliminarActividadCalendario(body.eventId || body.id);

  return Response.json({ ok: true });
}
