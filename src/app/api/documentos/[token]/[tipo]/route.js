import { generarDocumento } from '@/server/documentos.mjs';
import { db } from '@/server/firebase.mjs';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { token, tipo } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token) || !['certificado', 'factura'].includes(tipo)) return Response.json({ error: 'Documento inválido.' }, { status: 400 });
  try {
    const snap = await db().collection('membresiasOnerrd2027').where('token', '==', token).limit(1).get();
    if (snap.empty) return Response.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
    const member = snap.docs[0].data();
    if (member.estado !== 'confirmada') return Response.json({ error: 'El pago no está confirmado.' }, { status: 403 });
    const pdf = await generarDocumento(member, tipo);
    const filename = `${tipo}-${member.codigo.replaceAll(' ', '-')}.pdf`;
    return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[documentos]', error);
    return Response.json({ error: 'No se pudo generar el documento.' }, { status: 502 });
  }
}
