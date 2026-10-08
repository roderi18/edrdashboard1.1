import * as z from 'zod';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from 'src/server/firebase.mjs';
import { authorized } from 'src/server/admin.mjs';
import { leerDestacamento } from 'src/server/padron.mjs';

export const dynamic = 'force-dynamic';

const licencia = z.object({
  // El titular puede quedar vacío: lo que habilita la tarifa es `habilita2027`.
  titular: z.string().trim().max(160).default(''),
  fechaActivacion: z.iso.date().nullable(),
  estado: z.enum(['activa', 'sin_activar', 'vencida']),
  habilita2027: z.boolean(),
  nota: z.string().trim().max(500).optional(),
});
const schema = z.object({ licencias: z.array(licencia).max(20) });

export async function PUT(request, { params }) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'ID inválido.' }, { status: 400 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return Response.json({ error: 'Datos de licencia inválidos.' }, { status: 400 });
  if (!(await leerDestacamento(id)))
    return Response.json({ error: 'El destacamento no existe.' }, { status: 404 });
  await db()
    .collection('licenciasRriTrac')
    .doc(id)
    .set(
      { ...input.data, destacamentoId: id, actualizadoEn: FieldValue.serverTimestamp() },
      { merge: true }
    );
  return Response.json({ ok: true });
}
