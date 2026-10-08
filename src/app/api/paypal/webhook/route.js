import { db } from 'src/server/firebase.mjs';
import { paypalRequest } from 'src/server/paypal.mjs';
import { confirmarMembresia } from 'src/server/confirmacion.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return Response.json({ error: 'Webhook no configurado.' }, { status: 503 });
  try {
    const event = await request.json();
    const verified = await paypalRequest('/v1/notifications/verify-webhook-signature', 'POST', {
      auth_algo: request.headers.get('paypal-auth-algo'),
      cert_url: request.headers.get('paypal-cert-url'),
      transmission_id: request.headers.get('paypal-transmission-id'),
      transmission_sig: request.headers.get('paypal-transmission-sig'),
      transmission_time: request.headers.get('paypal-transmission-time'),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    });
    if (verified.verification_status !== 'SUCCESS') return Response.json({ error: 'Firma inválida.' }, { status: 401 });
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return Response.json({ ignored: true });
    const capture = event.resource;
    const orderId = capture?.supplementary_data?.related_ids?.order_id;
    if (!orderId || capture.status !== 'COMPLETED') return Response.json({ error: 'Evento incompleto.' }, { status: 400 });
    const snap = await db().collection('membresiasOnerrd2027').where('paypal.orderId', '==', orderId).limit(1).get();
    if (snap.empty) return Response.json({ ignored: true });
    const doc = snap.docs[0];
    const member = doc.data();
    if (member.estado === 'confirmada') return Response.json({ alreadyProcessed: true });
    if (member.estado !== 'pendiente_paypal' || capture.amount?.currency_code !== 'USD' || capture.amount?.value !== member.paypal.montoUsd) {
      return Response.json({ error: 'El pago no coincide.' }, { status: 409 });
    }
    const order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'GET');
    const unit = order.purchase_units?.[0];
    if (order.status !== 'COMPLETED' || unit?.reference_id !== member.referencia || unit?.custom_id !== doc.id || !unit?.payments?.captures?.some((item) => item.id === capture.id && item.status === 'COMPLETED')) {
      return Response.json({ error: 'El pedido no coincide.' }, { status: 409 });
    }
    await confirmarMembresia(doc.id, 'pendiente_paypal', { proveedor: 'paypal', orderId, captureId: capture.id, montoUsd: capture.amount.value, webhookId: event.id });
    return Response.json({ accepted: true });
  } catch (error) {
    console.error('[paypal webhook]', error);
    return Response.json({ error: 'No se pudo procesar el evento.' }, { status: 502 });
  }
}
