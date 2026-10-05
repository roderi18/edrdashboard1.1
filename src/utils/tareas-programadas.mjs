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
  {
    id: 'salud-sistema-diaria',
    ruta: '/api/tareas/salud-sistema-diaria',
    // 20:00 UTC = 16:00 (4:00 p. m.) en Santo Domingo.
    horario: '0 16 * * *',
    zonaHoraria: 'America/Santo_Domingo',
    descripcion: 'Salud del sistema: revisión completa y resumen en el chat de Administradores Globales.',
  },
  {
    id: 'salud-sistema-cada-hora',
    ruta: '/api/tareas/salud-sistema-cada-hora',
    // Cada hora en punto menos a las 4:00 p. m., que ya la hace la diaria.
    horario: '0 0-15,17-23 * * *',
    zonaHoraria: 'America/Santo_Domingo',
    descripcion: 'Salud del sistema: revisión silenciosa; solo avisa si algo falla.',
  },
  {
    id: 'respaldo-diario',
    ruta: '/api/tareas/respaldo-diario',
    // 03:00 UTC = 23:00 (11:00 p. m.) en Santo Domingo, cuando nadie usa la app.
    horario: '0 23 * * *',
    zonaHoraria: 'America/Santo_Domingo',
    descripcion: 'Respaldo diario: Firestore, padrón de la API .NET, cuentas y archivos a Storage.',
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
