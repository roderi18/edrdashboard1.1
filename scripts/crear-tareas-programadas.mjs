// ----------------------------------------------------------------------
// LOS COMANDOS PARA CREAR (O ACTUALIZAR) LAS TAREAS DIARIAS EN CLOUD SCHEDULER.
//
// Las tareas eran funciones programadas de Netlify; ahora son rutas
// `/api/tareas/*` de App Hosting y alguien tiene que llamarlas a su hora. Este
// script NO toca nada: imprime los comandos `gcloud` a partir del registro de
// `src/utils/tareas-programadas.mjs`, para que el horario viva en un solo sitio.
//
// Uso:
//   node scripts/crear-tareas-programadas.mjs            -> comandos para crearlas
//   node scripts/crear-tareas-programadas.mjs --update   -> comandos para actualizarlas
//
// El secreto NO se escribe aquí: los comandos leen la variable de entorno
// TAREAS_PROGRAMADAS_SECRETO de la terminal donde se peguen, y debe ser el
// mismo valor guardado en Secret Manager para App Hosting.
// ----------------------------------------------------------------------

import { TAREAS_PROGRAMADAS, CABECERA_SECRETO_TAREAS } from '../src/utils/tareas-programadas.mjs';

const PROYECTO = 'systexploradores';
const REGION = 'us-central1';
const BASE = 'https://explora--systexploradores.us-central1.hosted.app';
const accion = process.argv.includes('--update') ? 'update' : 'create';

TAREAS_PROGRAMADAS.forEach((tarea) => {
  console.log(
    [
      `gcloud scheduler jobs ${accion} http ${tarea.id}`,
      `  --project=${PROYECTO}`,
      `  --location=${REGION}`,
      `  --schedule="${tarea.horario}"`,
      `  --time-zone="${tarea.zonaHoraria}"`,
      `  --uri="${BASE}${tarea.ruta}"`,
      '  --http-method=POST',
      // Las tareas leen el padrón de la API .NET, que tarda hasta 17 s.
      '  --attempt-deadline=300s',
      // `create` usa --headers; `update`, --update-headers.
      `  --${accion === 'update' ? 'update-headers' : 'headers'}="${CABECERA_SECRETO_TAREAS}=$TAREAS_PROGRAMADAS_SECRETO"`,
      `  --description="${tarea.descripcion}"`,
    ].join(' \\\n')
  );
  console.log('');
});
