import { secretoDeTareaValido, CABECERA_SECRETO_TAREAS } from 'src/utils/tareas-programadas.mjs';

import { responderRevisionDeSalud } from 'src/server/tareas/salud-sistema.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ----------------------------------------------------------------------
// Tarea "salud-sistema-cada-hora", lanzada por Cloud Scheduler (horario en
// `src/utils/tareas-programadas.mjs`). Revisa la salud del sistema sin que nadie
// abra la pantalla. Solo responde con el secreto.
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

  return responderRevisionDeSalud('cada-hora');
}
