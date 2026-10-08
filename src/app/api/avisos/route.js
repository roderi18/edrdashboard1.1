import * as z from 'zod';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from 'src/server/firebase.mjs';
import { avisarBloqueo } from 'src/server/correo.mjs';
import { leerElegibilidad } from 'src/server/elegibilidad.mjs';
import { leerConfiguracion } from 'src/server/configuracion.mjs';
import { notificarBloqueoAlDashboard } from 'src/server/notificar-dashboard.mjs';

// ----------------------------------------------------------------------
// "AVISAR OFICINA NACIONAL": un destacamento que no puede pagar (cualquier
// motivo) y cree que es un error lo dice aquí. Queda en
// `avisosMembresia2027/{id}`, llega a la campana de los Administradores
// Globales y la Oficina Nacional y, si hay correo de avisos, por correo.
//
// El motivo no lo manda el navegador: se vuelve a calcular. Un aviso por
// destacamento cada 6 horas, para que la página pública no sirva para
// llenar el buzón.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

const ESPERA_MS = 6 * 60 * 60 * 1000;

const schema = z.object({
  destacamentoId: z.string().regex(/^\d{1,12}$/),
  nombre: z.string().trim().min(2).max(120),
  correo: z.email(),
  telefono: z.string().trim().max(30).optional().default(''),
  comentario: z.string().trim().max(1000).optional().default(''),
});

export async function POST(request) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: 'Escribe tu nombre y un correo válido.' }, { status: 400 });
  }
  try {
    const { destacamentoId, ...contacto } = input.data;
    const elegibilidad = await leerElegibilidad(destacamentoId);
    if (!elegibilidad.destacamento) {
      return Response.json({ error: 'Destacamento no encontrado.' }, { status: 404 });
    }
    if (elegibilidad.disponible) {
      return Response.json({ error: 'Este destacamento ya puede pagar.' }, { status: 409 });
    }
    const ref = db().collection('avisosMembresia2027').doc(destacamentoId);
    const previo = (await ref.get()).data();
    if (previo?.enviadoEnMs && Date.now() - previo.enviadoEnMs < ESPERA_MS) {
      return Response.json({ ok: true, repetido: true });
    }
    const aviso = {
      id: `${destacamentoId}-${Date.now()}`,
      destacamento: elegibilidad.destacamento,
      motivo: elegibilidad.motivo || 'No cumple las condiciones para pagar.',
      validaciones: elegibilidad.validaciones,
      ...contacto,
      estado: 'pendiente',
      enviadoEnMs: Date.now(),
      enviadoEn: FieldValue.serverTimestamp(),
    };
    await ref.set(aviso);
    const { config } = await leerConfiguracion();
    // Campana del dashboard (Administradores Globales y Oficina Nacional) y,
    // si está configurado, correo. Que falle uno no tumba el otro.
    await Promise.all([
      notificarBloqueoAlDashboard(aviso).catch((e) => console.error('[avisos campana]', e)),
      avisarBloqueo(aviso, config.correoAvisos).catch(() => false),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[avisos]', error);
    return Response.json(
      { error: 'No se pudo enviar el aviso. Inténtalo más tarde.' },
      { status: 502 }
    );
  }
}
