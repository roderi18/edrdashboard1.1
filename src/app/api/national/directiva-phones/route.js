import { buscarTelefonosPorIds } from 'src/server/miembros-directorio';
import { identificarConSesionRest } from 'src/server/sesion-rest.mjs';
import { createChatFirestoreRestClient } from 'src/server/chat-firestore-rest.mjs';

export const runtime = 'nodejs';

const errorJson = (message, status) => Response.json({ error: message }, { status });

const tokenDe = (request) =>
  (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';

export async function GET(request) {
  const { error } = await identificarConSesionRest(request);
  if (error) return error;

  const token = tokenDe(request);
  const projectId = String(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
  ).trim();

  if (!token || !projectId) {
    return errorJson('No se pudo comprobar la sesión o el proyecto.', 503);
  }

  try {
    const firestore = createChatFirestoreRestClient({ projectId, token });
    const [asignaciones, permanentes] = await Promise.all([
      firestore.runQuery({
        collectionId: 'asignacionesDirectiva',
        filters: [{ field: 'activo', op: '==', value: true }],
      }),
      firestore.listCollection('directiva_nacional_permanentes'),
    ]);

    const ids = new Set(
      asignaciones
        .filter((fila) => ['nacional', 'regional', 'seccional'].includes(fila.nivel))
        .map((fila) => String(fila.idMiembro ?? '').trim())
        .filter(Boolean)
    );

    permanentes
      .filter((fila) => fila.exComandante === true)
      .forEach((fila) => ids.add(String(fila.idMiembros || fila.id || '').trim()));

    const telefonos = await buscarTelefonosPorIds([...ids]);
    return Response.json(
      { data: telefonos },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (cause) {
    console.error('[national/directiva-phones] no se pudieron cargar los teléfonos', cause);
    return errorJson('No se pudieron cargar los teléfonos de la directiva.', 502);
  }
}
