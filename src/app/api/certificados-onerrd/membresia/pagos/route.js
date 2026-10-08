import { FieldValue } from 'firebase-admin/firestore';

import { requireRole } from 'src/server/require-role';
import { getAdminDb } from 'src/server/firebase-admin';
import {
  COLECCION_MEMBRESIAS,
  membresiaParaPantalla,
  leerPadronDeDestacamentos,
} from 'src/server/membresias-onerrd.mjs';

import { ROLES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// GET: las membresías 2027 de la landing y el padrón de destacamentos activos
// (para el avance por región y sección). POST: anota en una membresía el
// certificado que se le emitió desde la pestaña ONERRD.
// Solo Administrador Global y Oficina Nacional.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

const ROLES_PERMITIDOS = [ROLES.ADMINISTRADOR_GLOBAL, ROLES.OFICINA_NACIONAL];

export async function GET(req) {
  const noAutorizado = await requireRole(req, ROLES_PERMITIDOS);
  if (noAutorizado) return noAutorizado;
  const db = getAdminDb();
  const [instantanea, padron] = await Promise.all([
    db.collection(COLECCION_MEMBRESIAS).get(),
    leerPadronDeDestacamentos(db).catch(() => []),
  ]);
  const membresias = instantanea.docs
    .map((d) => membresiaParaPantalla(d.id, d.data()))
    .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')));
  return Response.json(
    { membresias, padron },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(req) {
  const noAutorizado = await requireRole(req, ROLES_PERMITIDOS);
  if (noAutorizado) return noAutorizado;
  const entrada = await req.json().catch(() => null);
  const id = String(entrada?.id || '');
  const numeroRegistro = String(entrada?.numeroRegistro || '');
  if (!/^\d{1,12}$/.test(id) || !/^\d{4}-\d{3,6}$/.test(numeroRegistro)) {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const ref = getAdminDb().collection(COLECCION_MEMBRESIAS).doc(id);
  if (!(await ref.get()).exists) return Response.json({ error: 'No existe.' }, { status: 404 });
  await ref.set(
    {
      certificadoEmitido: {
        numeroRegistro,
        facturaNumero: String(entrada?.facturaNumero || '').slice(0, 40),
        emitidoEn: new Date().toISOString(),
      },
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return Response.json({ ok: true });
}
