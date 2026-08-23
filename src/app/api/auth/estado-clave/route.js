import 'server-only';

import { identificarSolicitante } from 'src/server/claves-miembro';
import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// ¿Sigue debiendo crear su contraseña?
//
// Se responde con lo que dice el perfil y NADA MAS. Antes se intentaba deducir
// que ya la habia cambiado por fuera comparando `tokensValidAfterTime`, pero ese
// momento se mueve por cualquier cosa —cambiarle el correo de acceso, por
// ejemplo—, y a quien entraba por primera vez la pantalla de "Crea tu
// contraseña" se le retiraba sola a los pocos segundos y acababa en el panel sin
// haber elegido ninguna.
//
// La marca solo la quita quien la puede quitar de verdad: `/api/auth/clave-
// miembro`, cuando el miembro guarda su contraseña.
// ----------------------------------------------------------------------

const COLECCION = 'usuarios_roles';

export async function POST(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ debeCambiarClave: null });

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    const db = getAdminDb();
    // Un mismo miembro puede tener su perfil guardado con su id y con su uid.
    const documentos = await Promise.all(
      [solicitante.idMiembros, solicitante.uid]
        .filter(Boolean)
        .map((id) => db.collection(COLECCION).doc(String(id)).get())
    );

    return Response.json({
      debeCambiarClave: documentos.some(
        (documento) => documento.exists && documento.data()?.debeCambiarClave === true
      ),
    });
  } catch (error) {
    console.error('[estado-clave] no se pudo revisar', error);

    // Ante la duda no se toca nada: la pantalla de primer acceso no hace daño.
    return Response.json({ debeCambiarClave: null });
  }
}
