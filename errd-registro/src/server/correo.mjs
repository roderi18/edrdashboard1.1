import 'server-only';

// ----------------------------------------------------------------------
// AVISO POR CORREO DE CADA ENVÍO (solo servidor), con Resend.
//
// A tecnologia@errd.org.do le llega un correo por cada actualización recibida:
// asunto "Destacamento 18 Actualizado" y, dentro, la fecha, quién lo envió y
// qué cambia. Se manda DESPUÉS de guardar el envío y sus fallos no lo tocan:
// sin clave, sin dominio verificado o con Resend caído, el envío queda guardado
// igual y el error solo se registra en el servidor.
//
// Configuración (variables del servidor):
// - RESEND_API_KEY: la clave de API de Resend (secreto de App Hosting).
// - CORREO_REMITENTE: quién lo envía. Debe ser de un dominio verificado en
//   Resend; mientras errd.org.do no lo esté, Resend solo admite
//   onboarding@resend.dev y solo hacia el correo del dueño de la cuenta.
// - CORREO_AVISOS: a quién llega (por defecto tecnologia@errd.org.do).
// ----------------------------------------------------------------------

const DESTINO = process.env.CORREO_AVISOS || 'tecnologia@errd.org.do';
const REMITENTE =
  process.env.CORREO_REMITENTE || 'Registro de Destacamentos <notificaciones@errd.org.do>';

const escapar = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fechaSantoDomingo = (fecha = new Date()) =>
  new Intl.DateTimeFormat('es-DO', {
    timeZone: 'America/Santo_Domingo',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(fecha);

const siNo = (v) => (v === true ? 'Sí' : v === false ? 'No' : '—');

// Nombres legibles de los campos que aparecen en `cambios`.
const NOMBRES = {
  nombre: 'Nombre',
  numero: 'Número',
  iglesia: 'Iglesia',
  cantidadMiembros: 'Cantidad de miembros',
  'direccion.provincia': 'Provincia',
  'direccion.municipio': 'Municipio',
  'direccion.sector': 'Sector',
  'direccion.calle': 'Calle',
  'direccion.referencia': 'Referencia',
  'pastor.nombre': 'Pastor',
  'pastor.telefono': 'Teléfono del pastor',
  'coordinador.nombre': 'Coordinador',
  registradoOfnc: 'Registrado en Oficina Nacional',
  rritrackActivo: 'RRITrack activo',
  diaReunion: 'Día de reunión',
  horaReunion: 'Hora de inicio',
  horaReunionFin: 'Hora de fin',
};

/** Asunto: "Destacamento 18 Actualizado" (o por nombre si aún no tiene número). */
export const asuntoDelAviso = ({ numero, nombre, esNuevo }) => {
  const quien = numero ? `Destacamento ${numero}` : `Destacamento ${nombre || 'sin número'}`;
  return esNuevo ? `${quien} Registrado (nuevo)` : `${quien} Actualizado`;
};

const fila = (etiqueta, valor) =>
  `<tr><td style="padding:6px 12px;color:#637381;white-space:nowrap;vertical-align:top">${escapar(
    etiqueta
  )}</td><td style="padding:6px 12px;color:#1C252E">${escapar(valor) || '—'}</td></tr>`;

export function contenidoDelAviso(registro) {
  const { datos = {}, enviadoPor = {}, seccion = {}, region = {}, cambios = [] } = registro;
  const dir = datos.direccion || {};
  const fecha = fechaSantoDomingo(registro.fecha);

  const tablaCambios = cambios.length
    ? `<h3 style="margin:24px 0 8px;font-size:16px">Qué cambia</h3>
       <table style="border-collapse:collapse;width:100%;font-size:14px">
         <tr style="background:#F4F6F8"><th align="left" style="padding:6px 12px">Campo</th><th align="left" style="padding:6px 12px">Antes</th><th align="left" style="padding:6px 12px">Ahora</th></tr>
         ${cambios
           .map(
             (c) =>
               `<tr><td style="padding:6px 12px">${escapar(NOMBRES[c.campo] || c.campo)}</td><td style="padding:6px 12px;color:#919EAB">${escapar(
                 typeof c.antes === 'boolean' ? siNo(c.antes) : c.antes ?? '—'
               )}</td><td style="padding:6px 12px">${escapar(
                 typeof c.despues === 'boolean' ? siNo(c.despues) : c.despues ?? '—'
               )}</td></tr>`
           )
           .join('')}
       </table>`
    : registro.esNuevo
      ? ''
      : '<p style="color:#637381">No cambia ningún dato del padrón (se confirmó lo que ya había).</p>';

  const html = `<!doctype html><html><body style="margin:0;background:#F4F6F8;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#0B1F4B;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:12px;letter-spacing:1px;opacity:.8">EXPLORADORES DEL REY · REGISTRO DE DESTACAMENTOS</div>
      <div style="font-size:22px;font-weight:bold;margin-top:6px">${escapar(asuntoDelAviso({ numero: datos.numero, nombre: datos.nombre, esNuevo: registro.esNuevo }))}</div>
    </div>
    <div style="background:#fff;padding:20px 12px;border-radius:0 0 12px 12px">
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${fila('Fecha de actualización', fecha)}
        ${fila('Destacamento', [datos.numero && `#${datos.numero}`, datos.nombre].filter(Boolean).join(' · '))}
        ${fila('Tipo', registro.esNuevo ? 'Destacamento nuevo (no estaba en el padrón)' : 'Actualización')}
        ${fila('Región / sección', `${region.nombre || '—'} / ${seccion.nombre || '—'}`)}
        ${fila('Iglesia', datos.iglesia)}
        ${fila('Dirección', [dir.provincia, dir.municipio, dir.sector, dir.calle].filter(Boolean).join(', '))}
        ${fila('Reunión', `${datos.diaReunion || '—'} · ${datos.horaReunion || '—'}${datos.horaReunionFin ? ` a ${datos.horaReunionFin}` : ''}`)}
        ${fila('Enviado por', `${enviadoPor.nombre || '—'} · ${enviadoPor.posicion || '—'} · ${enviadoPor.telefono || '—'}`)}
        ${fila('Estado', 'Pendiente de revisión en la bandeja de actualizaciones del dashboard')}
        ${registro.logoUrl ? fila('Logo', 'Adjuntó un logo nuevo (ver enlace abajo)') : ''}
        ${registro.enRafaga ? fila('Aviso', 'Llegó junto a muchos otros desde la misma conexión') : ''}
      </table>
      ${tablaCambios}
      ${registro.logoUrl ? `<p style="margin-top:20px"><a href="${escapar(registro.logoUrl)}" style="color:#1F4FA6">Ver el logo enviado</a></p>` : ''}
      <p style="margin-top:24px;font-size:12px;color:#919EAB">Id del envío: ${escapar(registro.id)} · Firestore: actualizaciones_destacamentos/${escapar(registro.id)}</p>
    </div>
  </div></body></html>`;

  const texto = [
    asuntoDelAviso({ numero: datos.numero, nombre: datos.nombre, esNuevo: registro.esNuevo }),
    `Fecha de actualización: ${fecha}`,
    `Destacamento: ${[datos.numero && `#${datos.numero}`, datos.nombre].filter(Boolean).join(' · ')}`,
    `Región / sección: ${region.nombre || '—'} / ${seccion.nombre || '—'}`,
    `Enviado por: ${enviadoPor.nombre || '—'} · ${enviadoPor.posicion || '—'} · ${enviadoPor.telefono || '—'}`,
    ...cambios.map((c) => `- ${NOMBRES[c.campo] || c.campo}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`),
    `Id del envío: ${registro.id}`,
  ].join('\n');

  return { html, texto };
}

/** Manda el aviso. Nunca lanza: devuelve true si Resend lo aceptó. */
export async function avisarPorCorreo(registro) {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.warn('[correo] sin RESEND_API_KEY: no se avisa por correo');
    return false;
  }
  try {
    const { html, texto } = contenidoDelAviso(registro);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMITENTE,
        to: [DESTINO],
        subject: asuntoDelAviso({
          numero: registro.datos?.numero,
          nombre: registro.datos?.nombre,
          esNuevo: registro.esNuevo,
        }),
        html,
        text: texto,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[correo] Resend respondió', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[correo] no se pudo enviar', error?.message);
    return false;
  }
}
