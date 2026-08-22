import 'server-only';

import { isAdminConfigured, getAdminAuth } from 'src/server/firebase-admin';
import {
  claveYaUsada,
  CLAVES_RECORDADAS,
  buscarPerfilMiembro,
  registrarHuellaClave,
  identificarSolicitante,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// El miembro elige su propia clave.
//
// Se hace en el servidor por dos razones: aqui se puede comprobar contra las
// huellas de sus claves anteriores —que solo el Admin SDK puede leer y
// escribir—, y no hace falta pedirle que vuelva a entrar, como exige Firebase
// para cambiar la clave desde el navegador.
// ----------------------------------------------------------------------

const MINIMO = 6;

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json({ error: 'El servidor no puede cambiar claves ahora mismo.' }, { status: 503 });
    }

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e intentalo de nuevo.' }, { status: 401 });
    }

    const { clave } = await req.json();
    const claveNueva = String(clave ?? '');

    if (claveNueva.length < MINIMO) {
      return Response.json(
        { error: `La contraseña debe tener al menos ${MINIMO} caracteres.` },
        { status: 400 }
      );
    }

    // Solo la suya: el uid sale del token, no de lo que mande el navegador.
    const cuenta = await getAdminAuth().getUser(solicitante.uid);
    const perfil = await buscarPerfilMiembro({
      idMiembros: solicitante.idMiembros,
      uid: solicitante.uid,
    });
    const datos = perfil?.data() ?? {};

    if (claveYaUsada(claveNueva, datos.clavesAnteriores)) {
      return Response.json(
        {
          error: `Esa contraseña ya la usaste antes. Elige una distinta de tus últimas ${CLAVES_RECORDADAS}.`,
          repetida: true,
        },
        { status: 409 }
      );
    }

    await getAdminAuth().updateUser(cuenta.uid, { password: claveNueva });

    await registrarHuellaClave({
      idMiembros: solicitante.idMiembros,
      uid: solicitante.uid,
      clave: claveNueva,
      extra: {
        debeCambiarClave: false,
        claveCambiadaEn: new Date().toISOString(),
        claveTemporal: false,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[clave-miembro] no se pudo cambiar la clave', error);

    return Response.json({ error: 'No pudimos cambiar la contraseña.' }, { status: 500 });
  }
}

// El navegador pregunta antes de enviar, para avisar en el propio campo.
export async function PUT(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ repetida: false });

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e intentalo de nuevo.' }, { status: 401 });
    }

    const { clave } = await req.json();
    const perfil = await buscarPerfilMiembro({
      idMiembros: solicitante.idMiembros,
      uid: solicitante.uid,
    });

    return Response.json({
      repetida: claveYaUsada(String(clave ?? ''), perfil?.data()?.clavesAnteriores),
    });
  } catch (error) {
    console.error('[clave-miembro] no se pudo comprobar la clave', error);

    return Response.json({ repetida: false });
  }
}

export async function GET() {
  return Response.json({ clavesRecordadas: CLAVES_RECORDADAS });
}
