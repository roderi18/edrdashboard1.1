import { secretoDeTareaValido, CABECERA_SECRETO_TAREAS } from 'src/utils/tareas-programadas.mjs';

import { responderRespaldoDiario } from 'src/server/tareas/respaldo-diario.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ----------------------------------------------------------------------
// Tarea "respaldo-diario", lanzada por Cloud Scheduler (horario en
// `src/utils/tareas-programadas.mjs`): Firestore, padrón de la API .NET, cuentas
// y archivos a `respaldos/` de Storage, y el resumen al chat de Administradores
// Globales. Solo responde con el secreto.
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

  return responderRespaldoDiario();
}
