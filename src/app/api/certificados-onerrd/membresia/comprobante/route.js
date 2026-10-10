import { requireRole } from 'src/server/require-role';
import { getAdminDb, getAdminBucket } from 'src/server/firebase-admin';
import { COLECCION_MEMBRESIAS } from 'src/server/membresias-onerrd.mjs';

import { ROLES } from 'src/auth/permissions/roles';

// El comprobante de una transferencia (imagen o PDF), para verlo en la
// ventana flotante. Nadie lo lee desde el navegador por Storage: sale por
// aquí, con sesión de Administrador Global u Oficina Nacional.

export const dynamic = 'force-dynamic';

const TIPOS = ['image/jpeg', 'image/png', 'application/pdf'];

export async function GET(req) {
  const noAutorizado = await requireRole(req, [ROLES.ADMINISTRADOR_GLOBAL, ROLES.OFICINA_NACIONAL]);
  if (noAutorizado) return noAutorizado;
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'Id inválido.' }, { status: 400 });
  const m = (await getAdminDb().collection(COLECCION_MEMBRESIAS).doc(id).get()).data();
  const ruta = m?.deposito?.comprobanteRuta;
  if (!ruta || !ruta.startsWith('membresias-onerrd/')) {
    return Response.json({ error: 'Esta membresía no tiene comprobante.' }, { status: 404 });
  }
  const [bytes] = await getAdminBucket().file(ruta).download();
  const tipo = TIPOS.includes(m.deposito.comprobanteTipo)
    ? m.deposito.comprobanteTipo
    : 'application/octet-stream';
  return new Response(bytes, {
    headers: {
      'Content-Type': tipo,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
