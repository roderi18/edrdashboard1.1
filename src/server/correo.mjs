import { generarDocumento } from './documentos.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function enviar({ to, subject, html, attachments = [], key, bcc }) {
  if (!process.env.RESEND_API_KEY || !process.env.CORREO_REMITENTE) {
    console.warn('[correo membresía] Falta configurar Resend y remitente.');
    return false;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ from: process.env.CORREO_REMITENTE, to: [to], ...(bcc ? { bcc: [bcc] } : {}), subject, html, attachments }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
    return true;
  } catch (error) {
    console.error('[correo membresía]', error);
    return false;
  }
}

export async function avisarConfirmacion(member) {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!url) return false;
  const [cert, invoice] = await Promise.all([generarDocumento(member, 'certificado'), generarDocumento(member, 'factura')]);
  return enviar({
    to: member.contacto.email,
    bcc: process.env.CORREO_AVISOS,
    key: `membresia-${member.codigo}-confirmada`,
    subject: `Membresía ONERRD 2027 confirmada · ${member.codigo}`,
    html: `<p>La membresía del destacamento #${escapeHtml(member.destacamento.numero)} está confirmada.</p><p>Código: <strong>${escapeHtml(member.codigo)}</strong></p><p>Adjuntamos el certificado y la factura. También puede consultarlos desde <a href="${url}/registro/resultado/?solicitud=${encodeURIComponent(member.token)}">su solicitud</a>.</p>`,
    attachments: [
      { filename: `certificado-${member.codigo.replaceAll(' ', '-')}.pdf`, content: cert.toString('base64') },
      { filename: `factura-${member.codigo.replaceAll(' ', '-')}.pdf`, content: invoice.toString('base64') },
    ],
  });
}

export async function avisarRechazo(member, motivo) {
  return enviar({
    to: member.contacto.email,
    key: `membresia-${member.referencia}-rechazada`,
    subject: `Depósito ONERRD 2027 rechazado · Destacamento #${member.destacamento.numero}`,
    html: `<p>La Oficina Nacional rechazó el comprobante de la solicitud ${escapeHtml(member.referencia)}.</p><p>Motivo: <strong>${escapeHtml(motivo)}</strong></p><p>Contacte a la Oficina Nacional para subsanar el depósito.</p>`,
  });
}
