import { secretoDeTareaValido, CABECERA_SECRETO_TAREAS } from 'src/utils/tareas-programadas.mjs';

import { ejecutarResumenActualizacionesDiario } from 'src/server/tareas/resumen-actualizaciones-diario.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// Tarea diaria "resumen-actualizaciones-diario", lanzada por Cloud Scheduler (horario en
// `src/utils/tareas-programadas.mjs`). Antes era una funcion programada de
// Netlify. Solo responde con el secreto: sin el, cualquiera podria repetirla.
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

  return ejecutarResumenActualizacionesDiario();
}
