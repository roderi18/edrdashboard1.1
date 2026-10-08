import { FieldValue } from 'firebase-admin/firestore';

import { COLECCION_MEMBRESIA, DOC_SECRETOS_MEMBRESIA } from 'src/utils/membresia-onerrd.mjs';

import { requireRole } from 'src/server/require-role';
import { getAdminDb } from 'src/server/firebase-admin';

import { ROLES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// LA CLAVE SECRETA DE PAYPAL de la membresía ONERRD 2027.
//
// No puede ir en `configuracionMembresia2027/general`, que el navegador lee:
// quien la tuviera podría cobrar y reembolsar en nombre de la Oficina Nacional.
// Se guarda en `configuracionMembresia2027/secretos` (las reglas no dejan a
// nadie tocarlo) y SOLO se escribe: GET dice si está puesta, nunca la devuelve.
// La lee la landing de pago con su Admin SDK.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

const ROLES_PERMITIDOS = [ROLES.ADMINISTRADOR_GLOBAL, ROLES.OFICINA_NACIONAL];

const documento = () => getAdminDb().collection(COLECCION_MEMBRESIA).doc(DOC_SECRETOS_MEMBRESIA);

export async function GET(req) {
  const noAutorizado = await requireRole(req, ROLES_PERMITIDOS);
  if (noAutorizado) return noAutorizado;
  const datos = (await documento().get()).data() || {};
  return Response.json(
    {
      claveSecretaConfigurada: Boolean(datos.paypalClientSecret),
      webhookId: datos.paypalWebhookId || '',
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(req) {
  const noAutorizado = await requireRole(req, ROLES_PERMITIDOS);
  if (noAutorizado) return noAutorizado;
  const entrada = await req.json().catch(() => null);
  if (!entrada || typeof entrada !== 'object') {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const cambios = {};
  if (typeof entrada.claveSecreta === 'string' && entrada.claveSecreta.trim()) {
    const clave = entrada.claveSecreta.trim();
    if (clave.length < 20 || clave.length > 200 || /\s/.test(clave)) {
      return Response.json(
        { error: 'La clave secreta de PayPal no parece válida.' },
        { status: 400 }
      );
    }
    cambios.paypalClientSecret = clave;
  }
  if (entrada.borrarClave === true) cambios.paypalClientSecret = FieldValue.delete();
  if (typeof entrada.webhookId === 'string') {
    const id = entrada.webhookId.trim();
    if (id && !/^[A-Z0-9-]{8,60}$/i.test(id)) {
      return Response.json({ error: 'El Webhook ID de PayPal no parece válido.' }, { status: 400 });
    }
    cambios.paypalWebhookId = id;
  }
  if (!Object.keys(cambios).length)
    return Response.json({ error: 'Nada que guardar.' }, { status: 400 });
  await documento().set(
    { ...cambios, actualizadoEn: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return Response.json({ ok: true });
}
