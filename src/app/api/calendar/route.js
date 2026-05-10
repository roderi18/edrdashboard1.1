import {
  guardarActividadCalendario,
  eliminarActividadCalendario,
  obtenerActividadesCalendario,
  sembrarActividadesCalendario,
  actualizarActividadCalendario,
} from 'src/utils/firebase-calendar';

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

  await actualizarActividadCalendario(body.eventData || body);

  return Response.json({ ok: true });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));

  await eliminarActividadCalendario(body.eventId || body.id);

  return Response.json({ ok: true });
}
