import { authHeaders } from './member-service';

export async function obtenerTelefonosDirectivaActual() {
  const response = await fetch('/api/national/directiva-phones/', {
    headers: await authHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar los teléfonos de la directiva.');
  }

  const body = await response.json();
  return Array.isArray(body?.data) ? body.data : [];
}
