import nodemailer from 'nodemailer';

// ----------------------------------------------------------------------
// EL CORREO CON EL CERTIFICADO Y LA FACTURA de una membresía 2027.
//
// Sale del buzón remitente de la configuración ("Membresía 2027 · landing" →
// Correos), que es de errd.org.do y vive en Hostinger: se envía por su SMTP
// con la contraseña de ese buzón (`SMTP_PASSWORD`, solo en el entorno del
// servidor; nunca en Firestore ni en el navegador). Así el correo sale de
// verdad desde ese buzón y pasa el SPF del dominio.
//
// Nunca lanza: devuelve el registro del envío (desde, para, estado, error),
// que se guarda en la membresía y enseña la tabla de pagos.
// ----------------------------------------------------------------------

const escapar = (valor) =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

export const configuracionSmtp = (remitente) => ({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT || 465),
  usuario: process.env.SMTP_USER || remitente,
  clave: process.env.SMTP_PASSWORD || '',
});

export function cuerpoDelCorreo({ destacamento, codigo, numeroRegistro, facturaNumero }) {
  const nombre = `#${destacamento?.numero ?? ''} ${destacamento?.nombre ?? ''}`.trim();
  return `<div style="font-family:Arial,sans-serif;color:#1C252E;line-height:1.5">
<p>¡Saludos!</p>
<p>La Oficina Nacional de Exploradores del Rey confirmó la <strong>membresía 2027</strong> del
destacamento <strong>${escapar(nombre)}</strong>.</p>
<ul>
${codigo ? `<li>Código ONERRD: <strong>${escapar(codigo)}</strong></li>` : ''}
${numeroRegistro ? `<li>Certificado: <strong>${escapar(numeroRegistro)}</strong></li>` : ''}
${facturaNumero ? `<li>Factura: <strong>${escapar(facturaNumero)}</strong></li>` : ''}
</ul>
<p>Adjuntamos el certificado y la factura en PDF.</p>
<p style="color:#637381;font-size:12px">Oficina Nacional · Exploradores del Rey República Dominicana</p>
</div>`;
}

export async function enviarDocumentosMembresia({ desde, para, copia, asunto, html, adjuntos }) {
  const registro = {
    desde: desde || '',
    para: para || '',
    copia: copia || '',
    asunto,
    adjuntos: adjuntos.map((a) => a.filename),
    enviadoEn: new Date().toISOString(),
  };
  // Con SMTP_USER en el entorno, el que envía es ese buzón (el de la contraseña):
  // en desarrollo sale siempre de expedition.webapp@errd.org.do aunque el panel
  // diga otro, que Hostinger rechazaría con esa contraseña. Sin SMTP_USER, el
  // remitente es el del panel.
  const remitenteReal = process.env.SMTP_USER || desde;
  // SMTP_FROM: la dirección que ve quien recibe (From) cuando es otra que la
  // del buzón que entra (p. ej. oficinanacional@ saliendo por expedition.webapp@).
  // Hostinger solo la acepta si esa dirección es un alias de ese buzón.
  const mostrada = process.env.SMTP_FROM || remitenteReal;
  registro.desde = mostrada || '';
  const smtp = configuracionSmtp(remitenteReal);
  if (!remitenteReal || !smtp.clave) {
    return {
      ...registro,
      estado: 'sin_configurar',
      error: !remitenteReal
        ? 'Falta el correo remitente.'
        : 'Falta la contraseña del buzón remitente (SMTP_PASSWORD) en el servidor.',
    };
  }
  if (!para) return { ...registro, estado: 'fallido', error: 'La solicitud no tiene correo.' };
  try {
    const transporte = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.usuario, pass: smtp.clave },
      connectionTimeout: 15_000,
    });
    await transporte.sendMail({
      from: `"Oficina Nacional ERRD" <${mostrada}>`,
      ...(mostrada !== remitenteReal ? { sender: remitenteReal } : {}),
      to: para,
      ...(copia ? { bcc: copia } : {}),
      subject: asunto,
      html,
      attachments: adjuntos,
    });
    return { ...registro, estado: 'enviado', error: '' };
  } catch (error) {
    return { ...registro, estado: 'fallido', error: String(error?.message || error).slice(0, 300) };
  }
}
