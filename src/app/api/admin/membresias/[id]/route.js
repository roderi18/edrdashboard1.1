import * as z from 'zod';
import { FieldValue } from 'firebase-admin/firestore';

import { bucket } from 'src/server/firebase.mjs';
import { authorized } from 'src/server/admin.mjs';
import { avisarRechazo, registrarCorreo } from 'src/server/correo.mjs';
import { membresias, confirmarMembresia } from 'src/server/confirmacion.mjs';

export const dynamic = 'force-dynamic';

const schema = z.object({
  accion: z.enum(['confirmar', 'rechazar']),
  oficialId: z.string().trim().min(2).max(100),
  motivo: z.string().trim().max(500).optional(),
});

export async function GET(request, { params }) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'ID inválido.' }, { status: 400 });
  const snap = await membresias().doc(id).get();
  if (!snap.exists) return Response.json({ error: 'No existe.' }, { status: 404 });
  const member = snap.data();
  if (new URL(request.url).searchParams.get('comprobante') === '1') {
    if (!member.deposito?.comprobanteRuta)
      return Response.json({ error: 'No hay comprobante.' }, { status: 404 });
    const [file] = await bucket().file(member.deposito.comprobanteRuta).download();
    return new Response(file, {
      headers: {
        'Content-Type': member.deposito.comprobanteTipo,
        'Cache-Control': 'private, no-store',
      },
    });
  }
  return Response.json(member, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(request, { params }) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'ID inválido.' }, { status: 400 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success || (input.data.accion === 'rechazar' && !input.data.motivo))
    return Response.json(
      { error: 'Indica una acción y, si rechazas, un motivo.' },
      { status: 400 }
    );
  try {
    if (input.data.accion === 'confirmar') {
      const member = await confirmarMembresia(
        id,
        ['pendiente_transferencia', 'pendiente_revision'],
        {
          proveedor: 'transferencia',
          validadaManual: true,
          oficialId: input.data.oficialId,
        }
      );
      return Response.json({ estado: 'confirmada', codigo: member.codigo });
    }
    const rejected = await membresias().firestore.runTransaction(async (tx) => {
      const doc = membresias().doc(id);
      const snap = await tx.get(doc);
      if (snap.data()?.estado !== 'pendiente_transferencia')
        throw new Error('La solicitud ya cambió de estado.');
      tx.update(doc, {
        estado: 'rechazada',
        motivoRechazo: input.data.motivo,
        actualizadoEn: FieldValue.serverTimestamp(),
      });
      tx.create(doc.collection('eventos').doc(), {
        de: 'pendiente_transferencia',
        a: 'rechazada',
        actor: input.data.oficialId,
        fecha: FieldValue.serverTimestamp(),
        motivo: input.data.motivo,
      });
      return snap.data();
    });
    await registrarCorreo(id, 'rechazo', await avisarRechazo(rejected, input.data.motivo));
    return Response.json({ estado: 'rechazada' });
  } catch (error) {
    if (error.message?.includes('cambió de estado'))
      return Response.json({ error: error.message }, { status: 409 });
    console.error('[admin membresia]', error);
    return Response.json({ error: 'No se pudo actualizar la solicitud.' }, { status: 502 });
  }
}
