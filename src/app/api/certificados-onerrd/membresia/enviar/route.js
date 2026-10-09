import { FieldValue } from 'firebase-admin/firestore';

import { rutaPdfOnerrd, rutaFacturaPdfOnerrd } from 'src/utils/certificado-onerrd.mjs';
import {
  COLECCION_MEMBRESIA,
  DOC_CONFIGURACION_MEMBRESIA,
  sanearConfiguracionMembresia,
} from 'src/utils/membresia-onerrd.mjs';

import { requireRole } from 'src/server/require-role';
import { getAdminDb, getAdminBucket } from 'src/server/firebase-admin';
import { COLECCION_MEMBRESIAS, membresiaParaPantalla } from 'src/server/membresias-onerrd.mjs';
import { cuerpoDelCorreo, enviarDocumentosMembresia } from 'src/server/correo-membresia-onerrd.mjs';
import { notificarDocumentosMembresiaEnviados } from 'src/server/notificar-documentos-membresia-onerrd.mjs';

import { ROLES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// POST (multipart): id, numeroRegistro, facturaNumero y los dos PDF
// (certificado y factura) que el dashboard acaba de generar al emitir. Los
// envía por correo a quien pagó, con copia al correo de avisos, y anota el
// resultado en `correos.confirmacion` de la membresía. Solo con la membresía
// confirmada. Solo Administrador Global y Oficina Nacional.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLES_PERMITIDOS = [ROLES.ADMINISTRADOR_GLOBAL, ROLES.OFICINA_NACIONAL];
const MAXIMO_PDF = 10 * 1024 * 1024;
const URL_LANDING =
  process.env.NEXT_PUBLIC_URL_MEMBRESIA_ONERRD ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3050' : '');

const pdfDe = async (archivo, nombre) => {
  if (!archivo || typeof archivo.arrayBuffer !== 'function' || archivo.size > MAXIMO_PDF) {
    return null;
  }
  const contenido = Buffer.from(await archivo.arrayBuffer());
  if (contenido.subarray(0, 4).toString() !== '%PDF') return null;
  return { filename: nombre, content: contenido, contentType: 'application/pdf' };
};

const nombreSeguro = (texto) =>
  String(texto || '')
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 80);

export async function POST(req) {
  const noAutorizado = await requireRole(req, ROLES_PERMITIDOS);
  if (noAutorizado) return noAutorizado;
  const form = await req.formData().catch(() => null);
  const id = String(form?.get('id') || '');
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  // Sin PDF en la petición (un reintento desde la tabla), se toman los ya
  // emitidos y guardados en Storage.
  const emitidoAntes = (await getAdminDb().collection(COLECCION_MEMBRESIAS).doc(id).get()).data()
    ?.certificadoEmitido;
  const numeroRegistro = String(
    form.get('numeroRegistro') || emitidoAntes?.numeroRegistro || ''
  ).slice(0, 40);
  const facturaNumero = String(
    form.get('facturaNumero') || emitidoAntes?.facturaNumero || ''
  ).slice(0, 40);

  const db = getAdminDb();
  const referencia = db.collection(COLECCION_MEMBRESIAS).doc(id);
  const [instantanea, configDoc] = await Promise.all([
    referencia.get(),
    db.collection(COLECCION_MEMBRESIA).doc(DOC_CONFIGURACION_MEMBRESIA).get(),
  ]);
  const m = instantanea.data();
  if (!m) return Response.json({ error: 'La membresía no existe.' }, { status: 404 });
  if (m.estado !== 'confirmada') {
    return Response.json(
      { error: 'Primero confirma el pago: solo se envía con la membresía pagada.' },
      { status: 409 }
    );
  }
  const config = sanearConfiguracionMembresia(configDoc.data() || {});

  const deStorage = async (ruta, nombre) => {
    try {
      const [contenido] = await getAdminBucket().file(ruta).download();
      return { filename: nombre, content: contenido, contentType: 'application/pdf' };
    } catch {
      return null;
    }
  };
  const nombreCertificado = `certificado-${nombreSeguro(numeroRegistro || id)}.pdf`;
  const nombreFactura = `factura-${nombreSeguro(facturaNumero || id)}.pdf`;
  const adjuntos = (
    await Promise.all([
      (await pdfDe(form.get('certificado'), nombreCertificado)) ||
        (numeroRegistro && deStorage(rutaPdfOnerrd(numeroRegistro), nombreCertificado)),
      (await pdfDe(form.get('factura'), nombreFactura)) ||
        (numeroRegistro && deStorage(rutaFacturaPdfOnerrd(numeroRegistro), nombreFactura)),
    ])
  ).filter(Boolean);
  if (!adjuntos.length) {
    return Response.json(
      { error: 'Faltan los PDF del certificado y la factura.' },
      { status: 400 }
    );
  }

  const registro = await enviarDocumentosMembresia({
    desde: config.correoRemitente,
    para: m.contacto?.email,
    copia: config.correoAvisos,
    asunto: `Membresía 2027 confirmada · ${m.codigo || `Destacamento ${m.destacamento?.numero ?? id}`}`,
    html: cuerpoDelCorreo({
      destacamento: m.destacamento,
      codigo: m.codigo,
      numeroRegistro,
      facturaNumero,
      enlaceSolicitud:
        URL_LANDING && m.token
          ? `${URL_LANDING.replace(/\/$/, '')}/registro/resultado/?solicitud=${encodeURIComponent(m.token)}`
          : '',
    }),
    adjuntos,
  });

  await referencia.update({
    'correos.confirmacion': registro,
    actualizadoEn: FieldValue.serverTimestamp(),
  });
  if (registro.estado === 'enviado')
    await notificarDocumentosMembresiaEnviados(db, {
      id,
      membresia: m,
      registro,
      numeroRegistro,
      facturaNumero,
    }).catch((error) => console.error('[onerrd] no se pudo avisar el envío:', error));
  const actual = await referencia.get();
  return Response.json({ registro, membresia: membresiaParaPantalla(id, actual.data()) });
}
