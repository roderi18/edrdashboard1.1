import { secretoDeTareaValido, CABECERA_SECRETO_TAREAS } from 'src/utils/tareas-programadas.mjs';

import { getAdminDb, getAdminBucket } from 'src/server/firebase-admin';
import { emitirDocumentosDeMembresia } from 'src/server/emision-membresia-onerrd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Generar dos PDF con fuentes e imágenes tarda unos segundos; con holgura.
export const maxDuration = 120;

// ----------------------------------------------------------------------
// POST { id }: emite el certificado y la factura de una membresía ya
// confirmada, sin navegador (pago con PayPal), los guarda y los envía por
// correo. Lo llama el servidor de la landing de membresía, con el secreto de
// las tareas del servidor en la cabecera; sin él, 401. Idempotente.
// ----------------------------------------------------------------------

export async function POST(request) {
  const recibido = request.headers.get(CABECERA_SECRETO_TAREAS);
  if (
    !secretoDeTareaValido(recibido, process.env.TAREAS_PROGRAMADAS_SECRETO) &&
    !secretoDeTareaValido(recibido, process.env.EMISION_MEMBRESIA_SECRETO)
  ) {
    return new Response('No autorizado.', { status: 401 });
  }
  const entrada = await request.json().catch(() => null);
  const id = String(entrada?.id || '');
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  return Response.json(
    await emitirDocumentosDeMembresia(id, { db: getAdminDb(), bucket: getAdminBucket() }),
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
