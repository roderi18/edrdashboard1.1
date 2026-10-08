import { randomUUID } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import * as z from 'zod';

import { bucket, db } from '@/server/firebase.mjs';
import { bankConfig, lanzamientoHabilitado } from '@/server/configuracion.mjs';
import { leerElegibilidad } from '@/server/elegibilidad.mjs';

export const dynamic = 'force-dynamic';

const schema = z.object({
  destacamentoId: z.string().regex(/^\d{1,12}$/),
  planId: z.string().trim(),
  email: z.email(),
  phone: z.string().trim().max(30),
  amount: z.coerce.number().positive(),
  date: z.iso.date(),
  reference: z.string().trim().min(4).max(80),
});

const types = {
  'image/jpeg': { ext: 'jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png': { ext: 'png', match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'application/pdf': { ext: 'pdf', match: (b) => b.subarray(0, 5).toString() === '%PDF-' },
};

export async function POST(request) {
  if (!lanzamientoHabilitado()) return Response.json({ error: 'La membresía todavía no está abierta para cobros.' }, { status: 503 });
  const bank = bankConfig();
  if (!bank.name || !bank.accountName || !bank.accountType || !bank.accountNumber) {
    return Response.json({ error: 'La transferencia todavía no está habilitada.' }, { status: 503 });
  }
  try {
    const form = await request.formData();
    const parsed = schema.safeParse(Object.fromEntries(['destacamentoId', 'planId', 'email', 'phone', 'amount', 'date', 'reference'].map((key) => [key, form.get(key)])));
    if (!parsed.success) return Response.json({ error: 'Revisa el contacto y los datos del depósito.' }, { status: 400 });
    const proof = form.get('proof');
    const format = proof && types[proof.type];
    if (!format || proof.size < 100 || proof.size > 5 * 1024 * 1024) return Response.json({ error: 'Adjunta un comprobante JPG, PNG o PDF de hasta 5 MB.' }, { status: 400 });
    const bytes = Buffer.from(await proof.arrayBuffer());
    if (!format.match(bytes)) return Response.json({ error: 'El comprobante no coincide con el tipo de archivo.' }, { status: 400 });
    const now = new Date();
    if (new Date(`${parsed.data.date}T23:59:59-04:00`) > now) return Response.json({ error: 'La fecha del depósito no puede ser futura.' }, { status: 400 });
    const eligibility = await leerElegibilidad(parsed.data.destacamentoId);
    const plan = eligibility.planes?.find((item) => item.id === parsed.data.planId);
    if (!eligibility.disponible || !plan || parsed.data.amount !== plan.precio) return Response.json({ error: eligibility.motivo || 'El monto no coincide con un plan permitido.' }, { status: 409 });
    const id = parsed.data.destacamentoId;
    const reference = randomUUID();
    const token = randomUUID();
    const storagePath = `membresias-onerrd/2027/${id}/${reference}.${format.ext}`;
    const file = bucket().file(storagePath);
    await file.save(bytes, { contentType: proof.type, resumable: false, metadata: { cacheControl: 'private, no-store' } });
    try {
      await db().runTransaction(async (tx) => {
        const doc = db().collection('membresiasOnerrd2027').doc(id);
        const prior = await tx.get(doc);
        if (prior.exists && prior.data()?.estado !== 'rechazada') throw new Error('Ya existe una membresía 2027 en trámite o confirmada.');
        tx.set(doc, {
          anio: 2027, estado: 'pendiente_transferencia', tipoPago: 'transferencia',
          destacamento: eligibility.destacamento,
          plan,
          montoRd: plan.precio,
          contacto: { email: parsed.data.email, telefono: parsed.data.phone },
          deposito: { fecha: parsed.data.date, referencia: parsed.data.reference, comprobanteRuta: storagePath, comprobanteTipo: proof.type },
          referencia: reference, token,
          creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
        });
        tx.create(doc.collection('eventos').doc(), { de: null, a: 'pendiente_transferencia', actor: 'solicitante', fecha: FieldValue.serverTimestamp(), referenciaPago: parsed.data.reference });
      });
    } catch (error) {
      await file.delete().catch(() => {});
      throw error;
    }
    return Response.json({ estado: 'pendiente_transferencia', referencia: reference, token });
  } catch (error) {
    if (error.message?.includes('Ya existe una membresía')) return Response.json({ error: error.message }, { status: 409 });
    console.error('[membresias POST]', error);
    return Response.json({ error: 'No se pudo guardar el depósito. Inténtalo de nuevo.' }, { status: 502 });
  }
}
