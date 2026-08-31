import { exigirSesionRest } from 'src/server/sesion-rest.mjs';
import { crearNotificacionesCumpleanosMiembros } from 'src/services/notification-service';

// ----------------------------------------------------------------------

export async function POST(request) {
  // Crear avisos de cumpleanos escribe notificaciones a otros: sin sesion, no.
  // Si algun dia lo llama un programador de tareas externo, necesitara token.
  const sinSesion = await exigirSesionRest(request);

  if (sinSesion) return sinSesion;

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
