import {
  guardarEnvio,
  superaLimite,
  EsquemaEnvio,
  leerDestacamentosQueEnviaron,
} from 'src/server/envios.mjs';

export const dynamic = 'force-dynamic';

// Los destacamentos que ya enviaron su información, uno por destacamento (el
// mapa de la portada). Solo provincia y región: nada de personas.
export async function GET() {
  try {
    return Response.json(await leerDestacamentosQueEnviaron());
  } catch (error) {
    console.error('[api/envios GET]', error);
    return Response.json({ error: 'No se pudieron leer los envíos.' }, { status: 502 });
  }
}

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
    const fotoMiembro = form.get('fotoMiembro');
    const archivo = (a) => (a && typeof a === 'object' && a.size ? a : null);
    const { id } = await guardarEnvio({
      envio: resultado.data,
      logo: archivo(logo),
      fotoMiembro: archivo(fotoMiembro),
      ip,
    });

    return Response.json({ ok: true, id });
  } catch (error) {
    console.error('[api/envios]', error);
    return Response.json({ error: error.message || 'No se pudo guardar.' }, { status: 500 });
  }
}
