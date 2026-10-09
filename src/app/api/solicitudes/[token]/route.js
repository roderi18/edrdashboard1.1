import { codigoDeSolicitud } from 'src/utils/solicitud.mjs';
import { tokenSolicitudValido } from 'src/utils/token-solicitud.mjs';

import { db } from 'src/server/firebase.mjs';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { token } = await params;
  if (!tokenSolicitudValido(token))
    return Response.json({ error: 'Referencia inválida.' }, { status: 400 });
  const snap = await db()
    .collection('membresiasOnerrd2027')
    .where('token', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return Response.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  const d = snap.docs[0].data();
  // Lo justo para pintar el resultado y su resumen: quien tiene el enlace de su
  // solicitud ve su destacamento, su plan y su estado; nada del contacto.
  const { numero, nombre } = d.destacamento || {};
  return Response.json(
    {
      estado: d.estado,
      codigo: d.codigo || null,
      // Ya emitidos en el dashboard: entonces se pueden descargar.
      documentosListos: Boolean(d.certificadoEmitido?.numeroRegistro),
      referencia: d.referencia,
      codigoSolicitud: codigoDeSolicitud(d.destacamento?.numero, d.referencia),
      creadoEn: d.creadoEn?.toDate?.().toISOString() || null,
      vigencia: d.vigencia || null,
      motivo: d.motivoRechazo || null,
      tipoPago: d.tipoPago,
      destacamento: { numero, nombre },
      plan: d.plan || null,
      montoRd: d.montoRd,
      montoUsd: d.paypal?.montoUsd || null,
      correcciones: d.correcciones || {},
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
