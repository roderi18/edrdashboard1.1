import 'server-only';

import { isAdminConfigured } from 'src/server/firebase-admin';
import { identificarSolicitante } from 'src/server/claves-miembro';
import { correoUsadoPorOtroMiembro } from 'src/server/miembros-directorio';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// ¿Ese correo ya es de otro miembro?
//
// Lo pregunta el primer acceso antes de guardarlo: el correo identifica a la
// persona —con el se recupera la clave y, una vez verificado, se entra—, asi que
// dos miembros con el mismo se quedan sin forma de distinguirse.
//
// Se comprobaba en el navegador descargando el padron entero. Aqui se responde
// si o no, con la sesion del propio miembro, y el padron no sale del servidor.
// ----------------------------------------------------------------------

export async function POST(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ enUso: false });

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    const { correo } = await req.json();

    return Response.json({
      enUso: await correoUsadoPorOtroMiembro({ correo, idMiembros: solicitante.idMiembros }),
    });
  } catch (error) {
    console.error('[correo-disponible] no se pudo comprobar', error);

    // Sin respuesta no se puede afirmar que este repetido: se deja pasar y lo
    // atrapa Firebase con `auth/email-already-in-use`.
    return Response.json({ enUso: false });
  }
}
