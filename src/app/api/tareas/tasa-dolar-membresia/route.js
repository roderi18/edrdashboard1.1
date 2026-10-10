import { secretoDeTareaValido, CABECERA_SECRETO_TAREAS } from 'src/utils/tareas-programadas.mjs';

import { getAdminDb } from 'src/server/firebase-admin';
import { actualizarTasaDeMembresia } from 'src/server/tareas/tasa-dolar-membresia.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// Tarea "tasa-dolar-membresia", lanzada por Cloud Scheduler a las 6:00 a. m.
// (horario en `src/utils/tareas-programadas.mjs`): la tasa del dólar de la
// landing de membresía ONERRD 2027. Solo responde con el secreto.
// ----------------------------------------------------------------------

export async function POST(request) {
  if (
    !secretoDeTareaValido(
      request.headers.get(CABECERA_SECRETO_TAREAS),
      process.env.TAREAS_PROGRAMADAS_SECRETO
    )
  ) {
    return new Response('No autorizado.', { status: 401 });
  }

  return Response.json(await actualizarTasaDeMembresia(getAdminDb()));
}
