import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { sanearChequeoSalud } from 'src/utils/salud-sistema.mjs';

import { avisarDeLaSalud } from 'src/server/salud-sistema/avisos.mjs';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// LO QUE ENCUENTRA LA PANTALLA DE SALUD, A LA CAMPANA Y AL CHAT.
//
// La pantalla creaba sus alertas ella sola en la campana; un fallo no llegaba
// al chat de Administradores Globales, y eso solo lo puede escribir el servidor
// (como Sistema). Ahora la pantalla manda aquí lo que salió mal y el servidor
// avisa igual que la revisión automática: los mismos ids por chequeo y día, así
// lo que ya avisó la revisión de cada hora no se repite.
//
// Solo un Administrador Global (es el único que abre esa pantalla).
// ----------------------------------------------------------------------

const MAXIMO_CHEQUEOS = 60;
const ADMINISTRADOR_GLOBAL = 'administrador_global';

const errorJson = (error, status) => Response.json({ error }, { status });
const bearer = (request) =>
  (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';

const esAdministradorGlobal = async (db, token) => {
  if (token.rol === ADMINISTRADOR_GLOBAL) return true;

  const perfil = (await db.collection('usuarios_roles').doc(token.uid).get()).data() || {};

  return (
    perfil.rolId === ADMINISTRADOR_GLOBAL ||
    (Array.isArray(perfil.rolesQueEjerce) && perfil.rolesQueEjerce.includes(ADMINISTRADOR_GLOBAL))
  );
};

export async function POST(request) {
  if (!isAdminConfigured()) return errorJson('El servidor no está configurado.', 503);

  let token;
  try {
    token = await getAdminAuth().verifyIdToken(bearer(request));
  } catch {
    return errorJson('Inicia sesión de nuevo.', 401);
  }

  const db = getAdminDb();

  if (!(await esAdministradorGlobal(db, token))) {
    return errorJson('Solo el Administrador Global.', 403);
  }

  const cuerpo = await request.json().catch(() => ({}));
  const chequeos = (Array.isArray(cuerpo?.chequeos) ? cuerpo.chequeos : [])
    .slice(0, MAXIMO_CHEQUEOS)
    .map(sanearChequeoSalud);

  try {
    const { nuevos, chat } = await avisarDeLaSalud({
      db,
      FieldValue,
      chequeos,
      origen: 'pantalla',
    });

    return Response.json({ ok: true, nuevos: nuevos.length, chat });
  } catch (error) {
    console.error('[salud-sistema:avisar]', error);
    return errorJson('No se pudieron enviar los avisos.', 500);
  }
}
