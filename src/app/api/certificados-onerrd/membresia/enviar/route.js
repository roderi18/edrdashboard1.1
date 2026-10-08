import { FieldValue } from 'firebase-admin/firestore';

import {
  COLECCION_MEMBRESIA,
  DOC_CONFIGURACION_MEMBRESIA,
  sanearConfiguracionMembresia,
} from 'src/utils/membresia-onerrd.mjs';

import { requireRole } from 'src/server/require-role';
import { getAdminDb } from 'src/server/firebase-admin';
import { COLECCION_MEMBRESIAS, membresiaParaPantalla } from 'src/server/membresias-onerrd.mjs';
import { cuerpoDelCorreo, enviarDocumentosMembresia } from 'src/server/correo-membresia-onerrd.mjs';

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
  const numeroRegistro = String(form.get('numeroRegistro') || '').slice(0, 40);
  const facturaNumero = String(form.get('facturaNumero') || '').slice(0, 40);

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

  const adjuntos = (
    await Promise.all([
      pdfDe(form.get('certificado'), `certificado-${nombreSeguro(numeroRegistro || id)}.pdf`),
      pdfDe(form.get('factura'), `factura-${nombreSeguro(facturaNumero || id)}.pdf`),
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
    }),
    adjuntos,
  });

  await referencia.update({
    'correos.confirmacion': registro,
    actualizadoEn: FieldValue.serverTimestamp(),
  });
  const actual = await referencia.get();
  return Response.json({ registro, membresia: membresiaParaPantalla(id, actual.data()) });
}
