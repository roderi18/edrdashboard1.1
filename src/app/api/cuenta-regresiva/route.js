import { inscripcionesCerradas } from 'src/utils/configuracion-membresia.mjs';

import { leerConfiguracion } from 'src/server/configuracion.mjs';

export const dynamic = 'force-dynamic';

// El cierre de las inscripciones que se eligió en el dashboard («Membresía 2027
// · landing» → Cierre de inscripciones), con la hora del servidor: la página
// cuenta con ella y no con el reloj del teléfono, que puede ir adelantado o
// atrasado. Sin caché de CDN: un cambio tiene que verse en segundos.
export async function GET() {
  const { config } = await leerConfiguracion();
  return Response.json(
    { ...config.cierre, cerrado: inscripcionesCerradas(config), ahora: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
