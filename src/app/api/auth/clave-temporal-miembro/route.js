import 'server-only';

import { getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  buscarCuentaMiembro,
  generarClaveTemporal,
  registrarHuellaClave,
  identificarSolicitante,
  LARGO_CLAVE_TEMPORAL,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// El coordinador le devuelve el acceso a un miembro.
//
// Genera una clave temporal de ocho caracteres, la pone en su cuenta y la marca
// como "debe cambiarla": al entrar con ella, el miembro cae en "Crea tu
// contraseña" y no pasa de ahi hasta elegir una suya.
//
// La clave se devuelve UNA vez, para que el coordinador se la dicte. No queda
// guardada en ningun sitio: de ella solo se conserva una huella, para que el
// miembro no pueda volver a usarla como si fuera nueva.
// ----------------------------------------------------------------------

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede restablecer claves ahora mismo.' },
        { status: 503 }
      );
    }

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    if (!solicitante.puedeGestionarOtros) {
      return Response.json(
        { error: 'Tu rol no puede restablecer la contraseña de otros miembros.' },
        { status: 403 }
      );
    }

    const { idMiembros, codigoMiembro } = await req.json();

    if (!idMiembros && !codigoMiembro) {
      return Response.json({ error: 'Falta identificar al miembro.' }, { status: 400 });
    }

    const cuenta = await buscarCuentaMiembro({ idMiembros, codigoMiembro });

    if (!cuenta) {
      return Response.json(
        { error: 'Ese miembro todavía no tiene cuenta de acceso.' },
        { status: 404 }
      );
    }

    const clave = generarClaveTemporal();

    await getAdminAuth().updateUser(cuenta.uid, { password: clave });

    await registrarHuellaClave({
      idMiembros,
      uid: cuenta.uid,
      clave,
      extra: {
        debeCambiarClave: true,
        claveTemporal: true,
        claveTemporalEn: new Date().toISOString(),
        claveTemporalPor: solicitante.uid,
      },
    });

    return Response.json({ clave, largo: LARGO_CLAVE_TEMPORAL });
  } catch (error) {
    console.error('[clave-temporal-miembro] no se pudo restablecer', error);

    return Response.json({ error: 'No pudimos restablecer la contraseña.' }, { status: 500 });
  }
}
