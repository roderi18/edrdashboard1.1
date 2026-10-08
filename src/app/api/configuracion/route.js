import { leerConfiguracion, configuracionPublica } from 'src/server/configuracion.mjs';

export const dynamic = 'force-dynamic';

// Tarifas, planes, vigencia, tasa y (con cobros abiertos) la cuenta bancaria:
// lo que la portada y los pasos pintan. Nunca claves.
export async function GET() {
  return Response.json(configuracionPublica(await leerConfiguracion()), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
