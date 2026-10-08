import { db } from 'src/server/firebase.mjs';
import { paypalRequest } from 'src/server/paypal.mjs';
import { confirmarMembresia } from 'src/server/confirmacion.mjs';
import { leerConfiguracion, credencialesPaypal } from 'src/server/configuracion.mjs';

export const dynamic = 'force-dynamic';

const go = (request, status, token = '') =>
  Response.redirect(
    new URL(
      `/registro/resultado/?paypal=${status}${token ? `&solicitud=${token}` : ''}`,
      request.url
    )
  );

export async function GET(request) {
  const orderId = new URL(request.url).searchParams.get('token');
  if (!orderId || !/^[A-Z0-9-]{8,40}$/i.test(orderId)) return go(request, 'error');
  try {
    const snap = await db()
      .collection('membresiasOnerrd2027')
      .where('paypal.orderId', '==', orderId)
      .limit(1)
      .get();
    if (snap.empty) return go(request, 'error');
    const doc = snap.docs[0];
    const member = doc.data();
    if (['confirmada', 'pendiente_revision'].includes(member.estado))
      return go(request, 'confirmada', member.token);
    if (member.estado !== 'pendiente_paypal') return go(request, 'error');
    const credenciales = credencialesPaypal(await leerConfiguracion());
    if (!credenciales) throw new Error('PayPal sin credenciales.');
    const captured = await paypalRequest(
      credenciales,
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      'POST',
      {},
      member.referencia
    );
    const unit = captured.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    if (
      captured.status !== 'COMPLETED' ||
      capture?.status !== 'COMPLETED' ||
      capture.amount?.currency_code !== 'USD' ||
      capture.amount?.value !== member.paypal.montoUsd ||
      unit.reference_id !== member.referencia ||
      unit.custom_id !== doc.id
    ) {
      throw new Error('Los detalles del cobro no coinciden con la solicitud.');
    }
    await confirmarMembresia(doc.id, 'pendiente_paypal', {
      proveedor: 'paypal',
      orderId,
      captureId: capture.id,
      montoUsd: capture.amount.value,
    });
    return go(request, 'confirmada', member.token);
  } catch (error) {
    console.error('[paypal retorno]', error);
    const snap = await db()
      .collection('membresiasOnerrd2027')
      .where('paypal.orderId', '==', orderId)
      .limit(1)
      .get()
      .catch(() => null);
    if (snap && !snap.empty && snap.docs[0].data().estado === 'confirmada')
      return go(request, 'confirmada', snap.docs[0].data().token);
    return go(request, 'error');
  }
}
