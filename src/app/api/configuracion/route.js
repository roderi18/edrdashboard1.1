import { bankConfig, lanzamientoHabilitado, paypalConfig } from '@/server/configuracion.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const bank = bankConfig();
  let paypal = null;
  try { paypal = await paypalConfig(); } catch { /* Sin tasa vigente, no se ofrece PayPal. */ }
  return Response.json({ bank: lanzamientoHabilitado() ? bank : null, paypalEnabled: lanzamientoHabilitado() && Boolean(paypal), rate: paypal?.rate || null, rateDate: paypal?.date || null, lanzamientoHabilitado: lanzamientoHabilitado() }, { headers: { 'Cache-Control': 'no-store' } });
}
