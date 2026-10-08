import { db } from './firebase.mjs';
import { leerConfiguracion } from './configuracion.mjs';
import { describirCorrecciones } from './correcciones.mjs';

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );

// Desde dónde salen: el remitente de la configuración del dashboard (pestaña
// ONERRD → "Membresía 2027 · landing") o, si no hay, el del entorno.
async function remitente() {
  const { config } = await leerConfiguracion();
  return config.correoRemitente || process.env.CORREO_REMITENTE || '';
}

// Devuelve SIEMPRE el registro del envío (desde, a, estado, fecha, error): se
// guarda en la membresía y el dashboard lo enseña ("enviado", "falló", "sin
// configurar"). Nunca lanza: un correo que falla no deshace un pago.
async function enviar({ to, subject, html, attachments = [], key, bcc }) {
  const desde = await remitente().catch(() => '');
  const registro = {
    desde,
    para: to || '',
    copia: bcc || '',
    asunto: subject,
    adjuntos: attachments.map((a) => a.filename),
    enviadoEn: new Date().toISOString(),
  };
  if (!process.env.RESEND_API_KEY || !desde) {
    console.warn('[correo membresía] Falta configurar el servicio de correo o el remitente.');
    return {
      ...registro,
      estado: 'sin_configurar',
      error: 'Falta el servicio de correo o el remitente.',
    };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        from: desde,
        to: [to],
        ...(bcc ? { bcc: [bcc] } : {}),
        subject,
        html,
        attachments,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const detalle = await response.json().catch(() => ({}));
      throw new Error(
        `Servicio de correo ${response.status}${detalle.message ? `: ${detalle.message}` : ''}`
      );
    }
    return { ...registro, estado: 'enviado', error: '' };
  } catch (error) {
    console.error('[correo membresía]', error);
    return { ...registro, estado: 'fallido', error: String(error.message || error).slice(0, 300) };
  }
}

// Guarda en la membresía cómo fue cada correo (`correos.confirmacion`, `correos.rechazo`).
export async function registrarCorreo(idMembresia, tipo, registro) {
  if (!idMembresia || !registro) return;
  await db()
    .collection('membresiasOnerrd2027')
    .doc(String(idMembresia))
    .set({ correos: { [tipo]: registro } }, { merge: true })
    .catch((error) => console.error('[correo registro]', error));
}

export async function avisarConfirmacion(member) {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!url)
    return {
      estado: 'sin_configurar',
      error: 'Falta NEXT_PUBLIC_SITE_URL.',
      para: member.contacto.email,
    };
  // Sin adjuntos: el certificado y la factura son los que emite el dashboard,
  // que los envía por correo al emitirlos (antes iban unos hechos aquí, con
  // otro diseño).
  return enviar({
    to: member.contacto.email,
    bcc: member.correoAvisos || process.env.CORREO_AVISOS,
    key: `membresia-${member.codigo}-confirmada`,
    subject: `Membresía ONERRD 2027 confirmada · ${member.codigo}`,
    html: `<p>La membresía del destacamento #${escapeHtml(member.destacamento.numero)} está confirmada.</p><p>Código: <strong>${escapeHtml(member.codigo)}</strong></p><p>La Oficina Nacional le enviará el certificado y la factura por correo. También podrá descargarlos desde <a href="${url}/registro/resultado/?solicitud=${encodeURIComponent(member.token)}">su solicitud</a>.</p>`,
  });
}

export async function avisarRechazo(member, motivo) {
  return enviar({
    to: member.contacto.email,
    bcc: member.correoAvisos || process.env.CORREO_AVISOS,
    key: `membresia-${member.referencia}-rechazada`,
    subject: `Depósito ONERRD 2027 rechazado · Destacamento #${member.destacamento.numero}`,
    html: `<p>La Oficina Nacional rechazó el comprobante de la solicitud ${escapeHtml(member.referencia)}.</p><p>Motivo: <strong>${escapeHtml(motivo)}</strong></p><p>Contacte a la Oficina Nacional para subsanar el depósito.</p>`,
  });
}

// Un destacamento que no puede pagar avisa a la Oficina Nacional (botón
// "Avisar Oficina Nacional" del paso 1).
export async function avisarBloqueo(aviso, correoAvisos) {
  if (!correoAvisos) return false;
  const d = aviso.destacamento;
  return enviar({
    to: correoAvisos,
    key: `membresia-aviso-${aviso.id}`,
    subject: `Membresía 2027 · Destacamento #${d.numero} no puede pagar`,
    html: `<p>El destacamento <strong>#${escapeHtml(d.numero)} ${escapeHtml(d.nombre)}</strong> (${escapeHtml(d.region)} · ${escapeHtml(d.seccion)}) indica que no puede pagar su membresía 2027 y cree que es un error.</p>
<p>Motivo mostrado: <strong>${escapeHtml(aviso.motivo)}</strong></p>
${aviso.comentario ? `<p>Comentario: ${escapeHtml(aviso.comentario)}</p>` : ''}
<p>Contacto: ${escapeHtml(aviso.nombre)} · ${escapeHtml(aviso.correo)} · ${escapeHtml(aviso.telefono)}</p>`,
  });
}

// Pago recibido con datos del destacamento corregidos: queda en revisión hasta
// que la Oficina Nacional confirme los cambios. Se le explica a quien pagó.
export async function avisarRevision(member) {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';
  const d = member.destacamento || {};
  return enviar({
    to: member.contacto.email,
    bcc: member.correoAvisos || process.env.CORREO_AVISOS,
    key: `membresia-${member.referencia}-revision-${member.estado}`,
    subject: `Membresía ONERRD 2027 en revisión · Destacamento #${d.numero}`,
    html: `<p>Recibimos la solicitud de membresía 2027 del destacamento <strong>#${escapeHtml(d.numero)} ${escapeHtml(d.nombre)}</strong>.</p>
<p>Como corregiste datos del destacamento, el pago queda <strong>en revisión</strong> hasta que la Oficina Nacional confirme los cambios. Después recibirás el certificado y la factura.</p>
<p>Cambios indicados: ${escapeHtml(describirCorrecciones(member.correcciones))}</p>
${url ? `<p>Puedes ver el estado en <a href="${url}/registro/resultado/?solicitud=${encodeURIComponent(member.token)}">tu solicitud</a>.</p>` : ''}`,
  });
}
