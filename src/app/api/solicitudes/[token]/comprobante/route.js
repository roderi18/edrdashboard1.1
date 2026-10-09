import path from 'node:path';
import { jsPDF } from 'jspdf';
import { readFile } from 'node:fs/promises';

import { codigoDeSolicitud } from 'src/utils/solicitud.mjs';
import { tokenSolicitudValido } from 'src/utils/token-solicitud.mjs';

import { db } from 'src/server/firebase.mjs';

export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// EL COMPROBANTE DE LA SOLICITUD (PDF): lo que la persona guarda al terminar
// el paso 4. No es la factura ni el certificado: dice que la solicitud se
// recibió, con su código corto, el destacamento, el plan, el monto y cómo se
// pagó. Con el enlace de la solicitud (el token) basta; no lleva el correo.
// ----------------------------------------------------------------------

const ESTADOS = {
  pendiente_transferencia: 'Depósito pendiente de validación',
  pendiente_paypal: 'Esperando la confirmación de PayPal',
  pendiente_revision: 'Pagado · en revisión por la Oficina Nacional',
  confirmada: 'Pago confirmado',
  rechazada: 'Pago rechazado',
};

const rd = (n) => `RD$ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export async function GET(_request, { params }) {
  const { token } = await params;
  if (!tokenSolicitudValido(token)) {
    return Response.json({ error: 'Referencia inválida.' }, { status: 400 });
  }
  const snap = await db()
    .collection('membresiasOnerrd2027')
    .where('token', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return Response.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  const d = snap.docs[0].data();
  const codigo = codigoDeSolicitud(d.destacamento?.numero, d.referencia);
  const fecha = d.creadoEn?.toDate?.();

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const emblema = (await readFile(path.join(process.cwd(), 'public/marca/watermark.png'))).toString(
    'base64'
  );

  // El mismo emblema de la factura oficial, atenuado detrás del contenido.
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.08 }));
  doc.addImage(emblema, 'PNG', 59, 83, 98, 98);
  doc.restoreGraphicsState();

  doc.setFillColor(18, 42, 79);
  doc.rect(0, 0, 216, 34, 'F');
  doc.addImage(emblema, 'PNG', 15, 6, 22, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('OFICINA NACIONAL · EXPLORADORES DEL REY', 43, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Comprobante de solicitud · Membresía ONERRD 2027', 43, 24);

  doc.setTextColor(28, 37, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CÓDIGO DE LA SOLICITUD', 15, 50);
  doc.setFontSize(22);
  doc.text(codigo, 15, 60);

  const filas = [
    ['Destacamento', `#${d.destacamento?.numero ?? ''} ${d.destacamento?.nombre ?? ''}`.trim()],
    ['Registrado por', d.registradoPor?.nombre],
    ['Plan', d.plan?.nombre],
    ['Monto', rd(d.montoRd)],
    ['Medio de pago', d.tipoPago === 'paypal' ? 'PayPal' : 'Transferencia bancaria'],
    ['Estado', ESTADOS[d.estado] || d.estado],
    ['Código ONERRD', d.codigo],
    [
      'Fecha de la solicitud',
      fecha ? fecha.toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' }) : '',
    ],
    ['Referencia para consultas', codigo],
  ].filter(([, v]) => v);
  let y = 78;
  filas.forEach(([titulo, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(titulo, 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(String(valor), 120), 68, y);
    doc.setDrawColor(221, 231, 246);
    doc.line(15, y + 3, 201, y + 3);
    y += 11;
  });

  doc.setFontSize(9);
  doc.setTextColor(99, 115, 129);
  doc.text(
    doc.splitTextToSize(
      'Guarda este comprobante. Con el código de la solicitud puedes consultar el estado de tu membresía con la Oficina Nacional. Este documento no sustituye a la factura ni al certificado.',
      186
    ),
    15,
    y + 8
  );

  return new Response(Buffer.from(doc.output('arraybuffer')), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="comprobante-${codigo}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
