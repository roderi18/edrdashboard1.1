import { leerCuentaRegresiva } from 'src/server/cuenta-regresiva.mjs';

export const dynamic = 'force-dynamic';

// La cuenta atrás elegida en el dashboard, con la hora del servidor: la página
// cuenta con ella y no con el reloj del teléfono, que puede ir adelantado o
// atrasado. Sin caché de CDN: un cambio tiene que verse en segundos.
export async function GET() {
  const config = await leerCuentaRegresiva();
  return Response.json(
    { ...config, ahora: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
