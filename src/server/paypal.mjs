import { paypalBaseUrl } from './configuracion.mjs';

// Las credenciales llegan de `paypalConfig` (dashboard → Firestore), no del
// entorno: la Oficina Nacional las cambia sin redesplegar.
async function accessToken({ clientId, clientSecret, modo }) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${paypalBaseUrl(modo)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`PayPal OAuth: ${response.status}`);
  return (await response.json()).access_token;
}

export async function paypalRequest(credenciales, path, method, body, requestId) {
  const token = await accessToken(credenciales);
  const response = await fetch(`${paypalBaseUrl(credenciales.modo)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(`PayPal ${method} ${path}: ${response.status} ${data.name || ''}`);
  return data;
}
