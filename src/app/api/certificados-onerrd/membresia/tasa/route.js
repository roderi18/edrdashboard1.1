import { requireRole } from 'src/server/require-role';
import { getAdminDb } from 'src/server/firebase-admin';
import { actualizarTasaDeMembresia } from 'src/server/tareas/tasa-dolar-membresia.mjs';

import { ROLES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// "ACTUALIZAR AHORA" de la tasa automática del dólar (panel "Membresía 2027 ·
// landing"): lo mismo que la tarea de las 6:00 a. m., sin esperar a mañana.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const noAutorizado = await requireRole(req, [ROLES.ADMINISTRADOR_GLOBAL, ROLES.OFICINA_NACIONAL]);
  if (noAutorizado) return noAutorizado;
  const resultado = await actualizarTasaDeMembresia(getAdminDb());
  if (resultado.omitida) {
    return Response.json(
      { error: 'Primero enciende y guarda «Tasa automática».' },
      { status: 409 }
    );
  }
  return Response.json(resultado, { headers: { 'Cache-Control': 'private, no-store' } });
}
