import { guardarEnvio, superaLimite, EsquemaEnvio } from 'src/server/envios.mjs';

export const dynamic = 'force-dynamic';

// Guarda un envío como "pendiente". Llega como multipart: `envio` (JSON) y,
// si lo hay, `logo` (archivo).
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'local';

  if (superaLimite(ip)) {
    return Response.json({ error: 'Demasiados envíos seguidos. Inténtalo más tarde.' }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const crudo = JSON.parse(String(form.get('envio') || '{}'));
    const resultado = EsquemaEnvio.safeParse(crudo);

    if (!resultado.success) {
      return Response.json(
        { error: 'Revisa los datos del formulario.', detalles: resultado.error.issues.map((i) => i.path.join('.')) },
        { status: 400 }
      );
    }
    // Un bot rellena el campo oculto: se le responde "ok" sin guardar nada.
    if (resultado.data.trampa) return Response.json({ ok: true });

    const logo = form.get('logo');
    const { id } = await guardarEnvio({
      envio: resultado.data,
      logo: logo && typeof logo === 'object' && logo.size ? logo : null,
      ip,
    });

    return Response.json({ ok: true, id });
  } catch (error) {
    console.error('[api/envios]', error);
    return Response.json({ error: error.message || 'No se pudo guardar.' }, { status: 500 });
  }
}
