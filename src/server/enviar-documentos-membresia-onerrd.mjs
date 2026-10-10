import { FieldValue } from 'firebase-admin/firestore';

import { rutaPdfOnerrd, rutaFacturaPdfOnerrd } from 'src/utils/certificado-onerrd.mjs';

import { cuerpoDelCorreo, enviarDocumentosMembresia } from 'src/server/correo-membresia-onerrd.mjs';
import { notificarDocumentosMembresiaEnviados } from 'src/server/notificar-documentos-membresia-onerrd.mjs';

// ----------------------------------------------------------------------
// EL ENVÍO DEL CERTIFICADO Y LA FACTURA de una membresía por correo, para las
// dos entradas: la ruta `membresia/enviar` (el navegador acaba de emitirlos o
// pulsa «Reintentar envío») y la emisión automática de un pago con PayPal.
// Los PDF llegan en `pdfs` o, si no, se toman de Storage. Anota el resultado
// en `correos.confirmacion` y avisa a la campana cuando sale.
// ----------------------------------------------------------------------

const URL_LANDING =
  process.env.NEXT_PUBLIC_URL_MEMBRESIA_ONERRD ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3050' : '');

const nombreSeguro = (texto) =>
  String(texto || '')
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 80);

export const enlaceDeSolicitud = (membresia) =>
  URL_LANDING && membresia?.token
    ? `${URL_LANDING.replace(/\/$/, '')}/registro/resultado/?solicitud=${encodeURIComponent(membresia.token)}`
    : '';

export async function enviarDocumentosDeLaMembresia({
  db,
  bucket,
  id,
  membresia,
  config,
  numeroRegistro,
  facturaNumero,
  pdfs = {},
}) {
  const deStorage = async (ruta, nombre) => {
    try {
      const [contenido] = await bucket.file(ruta).download();
      return { filename: nombre, content: contenido, contentType: 'application/pdf' };
    } catch {
      return null;
    }
  };
  const aAdjunto = (contenido, nombre) =>
    contenido ? { filename: nombre, content: contenido, contentType: 'application/pdf' } : null;

  const nombreCertificado = `certificado-${nombreSeguro(numeroRegistro || id)}.pdf`;
  const nombreFactura = `factura-${nombreSeguro(facturaNumero || id)}.pdf`;
  const adjuntos = (
    await Promise.all([
      aAdjunto(pdfs.certificado, nombreCertificado) ||
        (numeroRegistro && deStorage(rutaPdfOnerrd(numeroRegistro), nombreCertificado)),
      aAdjunto(pdfs.factura, nombreFactura) ||
        (numeroRegistro && deStorage(rutaFacturaPdfOnerrd(numeroRegistro), nombreFactura)),
    ])
  ).filter(Boolean);
  if (!adjuntos.length) throw new Error('Faltan los PDF del certificado y la factura.');

  const registro = await enviarDocumentosMembresia({
    desde: config.correoRemitente,
    para: membresia.contacto?.email,
    copia: config.correoAvisos,
    asunto: `Membresía 2027 confirmada · ${membresia.codigo || `Destacamento ${membresia.destacamento?.numero ?? id}`}`,
    html: cuerpoDelCorreo({
      destacamento: membresia.destacamento,
      codigo: membresia.codigo,
      numeroRegistro,
      facturaNumero,
      enlaceSolicitud: enlaceDeSolicitud(membresia),
    }),
    adjuntos,
  });

  await db
    .collection('membresiasOnerrd2027')
    .doc(id)
    .update({ 'correos.confirmacion': registro, actualizadoEn: FieldValue.serverTimestamp() });
  if (registro.estado === 'enviado')
    await notificarDocumentosMembresiaEnviados(db, {
      id,
      membresia,
      registro,
      numeroRegistro,
      facturaNumero,
    }).catch((error) => console.error('[onerrd] no se pudo avisar el envío:', error));
  return registro;
}
