import { crearNotificacionesCumpleanosMiembros } from 'src/services/notification-service';

// ----------------------------------------------------------------------

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const notificaciones = await crearNotificacionesCumpleanosMiembros({
    usuario: body.usuario || {},
    diasAviso: body.diasAviso || [0, 7],
  });

  return Response.json({
    ok: true,
    total: notificaciones.length,
  });
}
