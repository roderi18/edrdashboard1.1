import { tokenSolicitudValido } from 'src/utils/token-solicitud.mjs';

import { db, bucket } from 'src/server/firebase.mjs';

export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// EL CERTIFICADO Y LA FACTURA DE UNA MEMBRESÍA: los MISMOS PDF que emite el
// dashboard (pestaña ONERRD), que los guarda en Storage al emitir
// (`certificados-onerrd/AAAA-NNN.pdf` y `certificados-onerrd/facturas/…`).
// Antes la landing pintaba los suyos con otro diseño (y fallaba): ahora solo
// los entrega. Sin emitir todavía, lo dice.
// ----------------------------------------------------------------------

const rutaEnStorage = (tipo, numeroRegistro) =>
  tipo === 'factura'
    ? `certificados-onerrd/facturas/${numeroRegistro}.pdf`
    : `certificados-onerrd/${numeroRegistro}.pdf`;

export async function GET(_request, { params }) {
  const { token, tipo } = await params;
  if (!tokenSolicitudValido(token) || !['certificado', 'factura'].includes(tipo))
    return Response.json({ error: 'Documento inválido.' }, { status: 400 });
  try {
    const snap = await db()
      .collection('membresiasOnerrd2027')
      .where('token', '==', token)
      .limit(1)
      .get();
    if (snap.empty) return Response.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
    const member = snap.docs[0].data();
    if (member.estado !== 'confirmada')
      return Response.json({ error: 'El pago no está confirmado.' }, { status: 403 });
    const numeroRegistro = member.certificadoEmitido?.numeroRegistro;
    if (!/^\d{4}-\d{3,6}$/.test(String(numeroRegistro || ''))) {
      return Response.json(
        { error: 'La Oficina Nacional aún está preparando tu certificado y tu factura.' },
        { status: 404 }
      );
    }
    const archivo = bucket().file(rutaEnStorage(tipo, numeroRegistro));
    const [existe] = await archivo.exists();
    if (!existe) {
      return Response.json({ error: 'El documento aún no está disponible.' }, { status: 404 });
    }
    const [pdf] = await archivo.download();
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${tipo}-onerrd-${numeroRegistro}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[documentos]', error);
    return Response.json({ error: 'No se pudo descargar el documento.' }, { status: 502 });
  }
}
