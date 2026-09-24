import { leerConCache } from 'src/utils/cache-de-lecturas.mjs';

import { authHeaders } from './member-service';

// Por la caché de lecturas: la lista nacional lo pedía en cada visita.
export const obtenerTelefonosDirectivaActual = () =>
  leerConCache('directiva:telefonos', leerTelefonosDirectivaActual);

async function leerTelefonosDirectivaActual() {
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
