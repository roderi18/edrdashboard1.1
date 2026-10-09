import { tokenSolicitudValido } from 'src/utils/token-solicitud.mjs';

import { db } from 'src/server/firebase.mjs';
import { solicitarEmision } from 'src/server/emision.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ----------------------------------------------------------------------
// POST: la página del resultado de un pago con PayPal pide que se generen el
// certificado y la factura. Solo con la solicitud confirmada y pagada con
// PayPal: una transferencia la valida (y la emite) la Oficina Nacional desde
// su pestaña, y pedirlo aquí también podría emitirla dos veces.
// ----------------------------------------------------------------------

export async function POST(_request, { params }) {
  const { token } = await params;
  if (!tokenSolicitudValido(token))
    return Response.json({ error: 'Referencia inválida.' }, { status: 400 });
  const snap = await db()
    .collection('membresiasOnerrd2027')
    .where('token', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return Response.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  const membresia = snap.docs[0].data();
  if (membresia.certificadoEmitido?.numeroRegistro)
    return Response.json({ estado: 'listo' }, { headers: { 'Cache-Control': 'no-store' } });
  if (membresia.estado !== 'confirmada' || membresia.tipoPago !== 'paypal')
    return Response.json({ estado: 'espera' }, { headers: { 'Cache-Control': 'no-store' } });
  const { estado } = await solicitarEmision(snap.docs[0].id);
  return Response.json({ estado }, { headers: { 'Cache-Control': 'no-store' } });
}
