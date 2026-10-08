import * as z from 'zod';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from 'src/server/firebase.mjs';
import { paypalRequest } from 'src/server/paypal.mjs';
import { leerElegibilidad } from 'src/server/elegibilidad.mjs';
import { paypalConfig, lanzamientoHabilitado } from 'src/server/configuracion.mjs';

export const dynamic = 'force-dynamic';

const schema = z.object({ destacamentoId: z.string().regex(/^\d{1,12}$/), planId: z.string().trim(), email: z.email(), phone: z.string().trim().max(30) });

export async function POST(request) {
  if (!lanzamientoHabilitado()) return Response.json({ error: 'La membresía todavía no está abierta para cobros.' }, { status: 503 });
  try {
    const input = schema.safeParse(await request.json());
    if (!input.success) return Response.json({ error: 'Revisa el destacamento y el correo.' }, { status: 400 });
    const config = await paypalConfig();
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!config || !site || !/^https?:\/\//.test(site)) return Response.json({ error: 'PayPal no está configurado con la tasa del día.' }, { status: 503 });
    const eligibility = await leerElegibilidad(input.data.destacamentoId);
    if (!eligibility.disponible) return Response.json({ error: eligibility.motivo }, { status: 409 });
    const plan = eligibility.planes.find((item) => item.id === input.data.planId);
    if (!plan) return Response.json({ error: 'El plan no corresponde a este destacamento.' }, { status: 409 });
    const reference = randomUUID();
    const token = randomUUID();
    const usd = config.usd(plan.precio);
    const order = await paypalRequest('/v2/checkout/orders', 'POST', {
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: reference, custom_id: input.data.destacamentoId, amount: { currency_code: 'USD', value: usd } }],
      payment_source: { paypal: { experience_context: {
        return_url: `${site.replace(/\/$/, '')}/api/paypal/retorno/`,
        cancel_url: `${site.replace(/\/$/, '')}/registro/pago/?paypal=cancelado`,
        user_action: 'PAY_NOW',
      } } },
    }, reference);
    const approve = order.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
    if (!order.id || !approve) throw new Error('PayPal no devolvió la aprobación del pedido.');
    await db().runTransaction(async (tx) => {
      const doc = db().collection('membresiasOnerrd2027').doc(input.data.destacamentoId);
      const previous = await tx.get(doc);
      if (previous.exists && previous.data()?.estado !== 'rechazada') throw new Error('Ya existe una membresía en trámite o confirmada.');
      tx.set(doc, {
        anio: 2027, estado: 'pendiente_paypal', tipoPago: 'paypal',
        destacamento: eligibility.destacamento, plan, montoRd: plan.precio,
        contacto: { email: input.data.email, telefono: input.data.phone },
        paypal: { orderId: order.id, montoUsd: usd, tasa: config.rate, fechaTasa: config.date },
        referencia: reference, token, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
      });
      tx.create(doc.collection('eventos').doc(), { de: null, a: 'pendiente_paypal', actor: 'solicitante', fecha: FieldValue.serverTimestamp(), referenciaPago: order.id });
    });
    return Response.json({ approve });
  } catch (error) {
    if (error.message?.includes('Ya existe una membresía')) return Response.json({ error: error.message }, { status: 409 });
    console.error('[paypal crear]', error);
    return Response.json({ error: 'No se pudo preparar el pedido de PayPal.' }, { status: 502 });
  }
}
