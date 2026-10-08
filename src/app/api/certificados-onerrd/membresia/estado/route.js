import { requireRole } from 'src/server/require-role';
import { getAdminDb } from 'src/server/firebase-admin';
import { verificarTokenDeSesion } from 'src/server/verificar-token';
import { COLECCION_MEMBRESIAS, membresiaParaPantalla } from 'src/server/membresias-onerrd.mjs';
import {
  cambiarEstadoMembresia,
  ACCIONES_ESTADO_MEMBRESIA,
} from 'src/server/estado-membresia-onerrd.mjs';

import { ROLES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// POST { id, accion: confirmar | rechazar | revision, motivo? }: el estado de
// una membresía 2027 (desplegable "Membresías 2027 · pagos"). Devuelve la
// membresía como la pinta la tabla. Solo Administrador Global y Oficina Nacional.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

const ROLES_PERMITIDOS = [ROLES.ADMINISTRADOR_GLOBAL, ROLES.OFICINA_NACIONAL];

export async function POST(req) {
  const noAutorizado = await requireRole(req, ROLES_PERMITIDOS);
  if (noAutorizado) return noAutorizado;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const sesion = await verificarTokenDeSesion(token).catch(() => null);
  const entrada = await req.json().catch(() => null);
  const id = String(entrada?.id || '');
  if (!/^\d{1,12}$/.test(id) || !ACCIONES_ESTADO_MEMBRESIA[entrada?.accion]) {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const db = getAdminDb();
  try {
    const resultado = await cambiarEstadoMembresia(db, id, {
      accion: entrada.accion,
      motivo: entrada.motivo,
      actor: { uid: sesion?.uid || '', nombre: sesion?.name || sesion?.email || '' },
    });
    const actual = await db.collection(COLECCION_MEMBRESIAS).doc(id).get();
    return Response.json({ ...resultado, membresia: membresiaParaPantalla(id, actual.data()) });
  } catch (error) {
    return Response.json(
      { error: error.message || 'No se pudo cambiar el estado.' },
      { status: 409 }
    );
  }
}
