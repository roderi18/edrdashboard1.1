import 'server-only';

import { identificarSolicitante } from 'src/server/claves-miembro';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// ¿Sigue debiendo cambiar su contraseña?
//
// La marca `debeCambiarClave` la pone la aplicacion al dar de alta al miembro o
// al generarle una clave temporal, y solo la quitaba la pantalla de primer
// acceso. Pero la contraseña se puede cambiar por fuera: con el enlace que
// Firebase envia al correo. Quien lo hacia seguia entrando a "Crea tu
// contraseña", aunque ya tuviera una suya.
//
// Firebase deja rastro de eso: al cambiar la clave invalida las sesiones
// anteriores y mueve `tokensValidAfterTime`. Si ese momento es POSTERIOR a
// cuando se le puso la clave que debia cambiar, es que ya eligio otra.
// ----------------------------------------------------------------------

const COLECCION = 'usuarios_roles';

// Margen para no confundir el propio momento en que se puso la clave: al
// ponerla, Firebase tambien mueve `tokensValidAfterTime`.
const MARGEN_MS = 60 * 1000;

const aMilisegundos = (valor) => {
  const fecha = valor ? new Date(valor) : null;

  return fecha && !Number.isNaN(fecha.getTime()) ? fecha.getTime() : 0;
};

export async function POST(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ debeCambiarClave: null });

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    const db = getAdminDb();
    const cuenta = await getAdminAuth().getUser(solicitante.uid);

    // Un mismo miembro puede tener su perfil guardado con su id y con su uid.
    const documentos = [];

    for (const id of [solicitante.idMiembros, solicitante.uid].filter(Boolean).map(String)) {
      // En serie: son dos lecturas.

      const documento = await db.collection(COLECCION).doc(id).get();

      if (documento.exists) documentos.push(documento);
    }

    const pendientes = documentos.filter((documento) => documento.data()?.debeCambiarClave === true);

    if (!pendientes.length) {
      return Response.json({ debeCambiarClave: false });
    }

    // Cuando se le puso la clave que debe cambiar: la temporal del coordinador
    // o, si nunca hubo, el alta de su cuenta.
    const puestaEn = Math.max(
      ...documentos.map((documento) => {
        const datos = documento.data() || {};

        return Math.max(aMilisegundos(datos.claveTemporalEn), aMilisegundos(datos.creadoEn));
      }),
      aMilisegundos(cuenta.metadata?.creationTime)
    );
    const cambiadaEn = aMilisegundos(cuenta.tokensValidAfterTime);
    const yaEligioOtra = cambiadaEn > puestaEn + MARGEN_MS;

    if (!yaEligioOtra) {
      return Response.json({ debeCambiarClave: true });
    }

    await Promise.all(
      pendientes.map((documento) =>
        documento.ref.set(
          {
            debeCambiarClave: false,
            claveCambiadaEn: new Date(cambiadaEn).toISOString(),
            claveTemporal: false,
          },
          { merge: true }
        )
      )
    );

    return Response.json({ debeCambiarClave: false, cambiadaFuera: true });
  } catch (error) {
    console.error('[estado-clave] no se pudo revisar', error);

    // Ante la duda no se toca nada: la pantalla de primer acceso no hace daño.
    return Response.json({ debeCambiarClave: null });
  }
}
