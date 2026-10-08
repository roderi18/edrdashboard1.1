import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const azul = [31, 79, 166];
const oscuro = [14, 37, 80];

export function firmaVerificacion(codigo, id) {
  const secret = process.env.ONERRD_QR_SECRET;
  if (!secret || secret.length < 32) throw new Error('Falta ONERRD_QR_SECRET para emitir certificados verificables.');
  return createHmac('sha256', secret).update(`2027:${codigo}:${id}`).digest('hex');
}

export async function generarDocumento(member, tipo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const d = member.destacamento;
  const logo = await readFile(path.join(process.cwd(), 'public/marca/logo-oficina-nacional.png'));
  doc.setFillColor(...oscuro); doc.rect(0, 0, 210, 30, 'F');
  doc.addImage(logo.toString('base64'), 'PNG', 13, 6, 20, 20);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('OFICINA NACIONAL DE EXPLORADORES DEL REY', 38, 14);
  doc.setFontSize(10); doc.text('REPÚBLICA DOMINICANA · MEMBRESÍA 2027', 38, 21);
  doc.setTextColor(...oscuro);
  doc.setFontSize(19); doc.text(tipo === 'certificado' ? 'CERTIFICADO OFICIAL' : 'FACTURA DE MEMBRESÍA', 15, 46);
  doc.setDrawColor(...azul); doc.setLineWidth(0.7); doc.line(15, 51, 195, 51);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const row = (label, value, y) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, 15, y);
    doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(String(value || 'No registrado'), 120), 72, y);
  };
  row('Código oficial', member.codigo, 65);
  row('Destacamento', `#${d.numero} · ${d.nombre}`, 74);
  row('Región / sección', `${d.region} / ${d.seccion}`, 83);
  row('Iglesia', d.iglesia, 92);
  row('Coordinador(a)', d.coordinador, 101);
  row('Pastor(a)', d.pastor, 110);

  if (tipo === 'certificado') {
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('MEMBRESÍA ACTIVA', 15, 127);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Vigencia: 01/01/2027 - 31/12/2027', 15, 136);
    const date = member.confirmadoEn?.toDate?.() || new Date();
    doc.text(`Expedido: ${date.toISOString().slice(0, 10)}`, 15, 145);
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
    if (!base) throw new Error('Falta NEXT_PUBLIC_SITE_URL.');
    const signature = firmaVerificacion(member.codigo, d.id);
    const url = `${base}/verificar/${encodeURIComponent(member.codigo)}/?s=${signature}`;
    const qr = await QRCode.toDataURL(url, { width: 512, errorCorrectionLevel: 'H' });
    doc.addImage(qr, 'PNG', 145, 122, 44, 44);
    doc.setFontSize(8); doc.text('Escanee para verificar este certificado.', 137, 174);
    doc.setTextColor(...azul); doc.text(url, 15, 191, { maxWidth: 180 });
  } else {
    doc.setFillColor(239, 245, 255); doc.rect(15, 120, 180, 54, 'F');
    row('Cuota de registro', `RD$ ${member.plan.cuotaRegistro.toLocaleString('es-DO')}`, 131);
    row('RRI TRaC', `RD$ ${member.plan.rriTrac.toLocaleString('es-DO')}`, 141);
    row('Descuento', `- RD$ ${member.plan.descuento.toLocaleString('es-DO')}`, 151);
    doc.setFont('helvetica', 'bold'); row('TOTAL PAGADO', `RD$ ${member.montoRd.toLocaleString('es-DO')}`, 164);
    row('Medio de pago', member.tipoPago === 'paypal' ? 'PayPal' : 'Transferencia bancaria', 189);
    if (member.tipoPago === 'paypal') {
      row('Total en USD', `US$ ${member.paypal.montoUsd}`, 199);
      row('Tasa aplicada', `RD$ ${member.paypal.tasa} = US$ 1`, 209);
      row('Transacción', member.pagoConfirmado?.captureId, 219);
    } else row('Referencia', member.deposito?.referencia, 199);
  }
  doc.setFontSize(8); doc.setTextColor(110, 125, 145);
  doc.text('Oficina Nacional de Exploradores del Rey · República Dominicana', 15, 278);
  return Buffer.from(doc.output('arraybuffer'));
}
