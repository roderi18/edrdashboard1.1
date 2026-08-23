import 'server-only';

import { isAdminConfigured } from 'src/server/firebase-admin';
import { identificarSolicitante } from 'src/server/claves-miembro';
import { marcarSolicitudesRecuperacionAtendidas } from 'src/server/notificaciones-recuperacion';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// El miembro volvio a entrar: su peticion de ayuda queda atendida.
//
// La marca la pone el servidor y no el navegador porque quien entra no puede
// escribir en las notificaciones de sus coordinadores. Se llama al iniciar
// sesion; si no hay nada pendiente, no hace nada.
// ----------------------------------------------------------------------

export async function POST(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ atendidas: 0 });

    const solicitante = await identificarSolicitante(req);

    if (!solicitante?.idMiembros) return Response.json({ atendidas: 0 });

    const atendidas = await marcarSolicitudesRecuperacionAtendidas({
      idMiembros: solicitante.idMiembros,
      atendidaPor: solicitante.uid,
      motivo: 'volvio_a_entrar',
    });

    return Response.json({ atendidas });
  } catch (error) {
    console.error('[recuperacion-atendida] no se pudo marcar', error);

    return Response.json({ atendidas: 0 });
  }
}
