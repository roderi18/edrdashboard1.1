import { timingSafeEqual } from 'crypto';

// ----------------------------------------------------------------------
// LAS TAREAS DIARIAS DEL SERVIDOR.
//
// Eran funciones programadas de Netlify (`netlify/functions/`). Al dejar
// Netlify y quedarse solo en Firebase App Hosting no hay quien las lance, así
// que ahora son rutas `/api/tareas/*` y las llama Cloud Scheduler a su hora.
// Este es el único sitio con su horario: de aquí salen los comandos para
// crearlas (`scripts/crear-tareas-programadas.mjs`).
//
// Las rutas son públicas en internet, así que solo responden a quien trae el
// secreto `TAREAS_PROGRAMADAS_SECRETO` en la cabecera: sin él, cualquiera podría
// repetir los avisos de cumpleaños cuantas veces quisiera.
//
// Sin React ni Firebase, para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

export const TAREAS_PROGRAMADAS = [
  {
    id: 'cumpleanos-diarios',
    ruta: '/api/tareas/cumpleanos-diarios',
    // 11:00 UTC = 07:00 en Santo Domingo (UTC-4, sin horario de verano).
    horario: '0 7 * * *',
    zonaHoraria: 'America/Santo_Domingo',
    descripcion: 'Avisos de cumpleaños: campana, chat de Sistema y push.',
  },
  {
    id: 'resumen-actualizaciones-diario',
    ruta: '/api/tareas/resumen-actualizaciones-diario',
    // 13:00 UTC = 09:00 en Santo Domingo.
    horario: '0 9 * * *',
    zonaHoraria: 'America/Santo_Domingo',
    descripcion: 'Resumen de destacamentos actualizados para la Oficina Nacional.',
  },
];

export const CABECERA_SECRETO_TAREAS = 'x-tarea-secreto';

/** ¿Trae la petición el secreto correcto? Sin secreto configurado, nadie pasa. */
export const secretoDeTareaValido = (recibido, esperado) => {
  const a = Buffer.from(String(recibido ?? ''));
  const b = Buffer.from(String(esperado ?? ''));

  if (!b.length || a.length !== b.length) return false;

  return timingSafeEqual(a, b);
};
