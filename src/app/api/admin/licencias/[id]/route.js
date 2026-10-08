import { FieldValue } from 'firebase-admin/firestore';
import * as z from 'zod';

import { authorized } from '@/server/admin.mjs';
import { db } from '@/server/firebase.mjs';
import { leerDestacamento } from '@/server/padron.mjs';

export const dynamic = 'force-dynamic';

const licencia = z.object({
  titular: z.string().trim().min(2).max(160),
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
  if (!input.success) return Response.json({ error: 'Datos de licencia inválidos.' }, { status: 400 });
  if (!await leerDestacamento(id)) return Response.json({ error: 'El destacamento no existe.' }, { status: 404 });
  await db().collection('licenciasRriTrac').doc(id).set({ ...input.data, destacamentoId: id, actualizadoEn: FieldValue.serverTimestamp() }, { merge: true });
  return Response.json({ ok: true });
}
