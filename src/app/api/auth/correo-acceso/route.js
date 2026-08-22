import 'server-only';

import { isAdminConfigured } from 'src/server/firebase-admin';
import { buscarCuentaMiembro } from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// Con que correo entra este miembro.
//
// La cuenta nace con un correo interno (`edr-10002@exploradores.app`) y pasa al
// personal en cuanto registra uno. Desde el navegador no hay forma de saber cual
// de los dos tiene, y probar el equivocado gasta un intento fallido contra
// Firebase —que acaba bloqueando por exceso de intentos— y hace que el acceso
// parezca fallar la primera vez.
//
// No se devuelve nada que el navegador no supiera ya: el listado de miembros,
// que esta pantalla consulta antes de entrar, incluye el correo de cada ficha.
// ----------------------------------------------------------------------

export async function POST(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ correo: '' });

    const { idMiembros, codigoMiembro, correo } = await req.json();

    if (!idMiembros && !codigoMiembro) {
      return Response.json({ error: 'Falta identificar al miembro.' }, { status: 400 });
    }

    const cuenta = await buscarCuentaMiembro({ idMiembros, codigoMiembro, correo });

    return Response.json({ correo: cuenta?.email || '' });
  } catch (error) {
    console.error('[correo-acceso] no se pudo resolver', error);

    // Sin respuesta, la pantalla prueba los correos que conoce.
    return Response.json({ correo: '' });
  }
}
