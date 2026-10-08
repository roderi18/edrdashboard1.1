import { db } from '@/server/firebase.mjs';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ error: 'Referencia inválida.' }, { status: 400 });
  const snap = await db().collection('membresiasOnerrd2027').where('token', '==', token).limit(1).get();
  if (snap.empty) return Response.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  const d = snap.docs[0].data();
  return Response.json({ estado: d.estado, codigo: d.codigo || null, referencia: d.referencia, motivo: d.motivoRechazo || null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
